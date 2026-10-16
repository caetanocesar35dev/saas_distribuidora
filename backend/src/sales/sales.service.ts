import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, Prisma } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import {
  addCustomerBottleBalance,
  addStoreBottleStock,
  recordBottleMovement,
} from '../bottles/bottle-ledger';
import { lockCashShared } from '../cash-register/cash-lock';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { fromCents, roundMoney, toCents } from '../common/utils/money';
import { addDays, startOfDayInTz } from '../common/utils/time';
import { Env } from '../config/env';
import { addCustomerDebt } from '../customers/customer-ledger';
import { PrismaTx } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, ListSalesQuery } from './dto/sales.dto';

export interface SaleLineInput {
  storeProductId: string;
  quantity: number;
  /** Só para uso interno (comanda: preço do momento em que o item foi adicionado). */
  price?: number;
  costPrice?: number;
}

export interface CreateSaleInput {
  storeId: string;
  companyId: string;
  userId: string;
  paymentMethod: PaymentMethod;
  customerId?: string | null;
  discount?: number;
  lines: SaleLineInput[];
  bottleReturns?: { bottleTypeId: string; quantity: number }[];
  commandTabId?: string;
  /** O estoque já foi baixado antes (itens da comanda): não baixa de novo. */
  skipStock?: boolean;
}

const SALE_SELECT = {
  id: true,
  storeId: true,
  total: true,
  totalCost: true,
  discount: true,
  paymentMethod: true,
  status: true,
  createdAt: true,
  userId: true,
  user: { select: { id: true, name: true } },
  customerId: true,
  customer: { select: { id: true, name: true, phone: true } },
  commandTabId: true,
  items: {
    where: { deletedAt: null },
    select: {
      id: true,
      storeProductId: true,
      quantity: true,
      price: true,
      costPrice: true,
      storeProduct: {
        select: { product: { select: { code: true, name: true } } },
      },
    },
  },
  bottleMovements: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      quantity: true,
      bottleTypeId: true,
      bottleType: { select: { name: true } },
      description: true,
    },
  },
} satisfies Prisma.SaleSelect;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async create(
    storeId: string,
    companyId: string,
    userId: string,
    dto: CreateSaleDto,
  ) {
    // Itens repetidos viram uma linha só.
    const merged = new Map<string, number>();
    for (const item of dto.items) {
      merged.set(
        item.storeProductId,
        (merged.get(item.storeProductId) ?? 0) + item.quantity,
      );
    }

    const saleId = await this.prisma.$transaction((tx) =>
      this.createInTx(tx, {
        storeId,
        companyId,
        userId,
        paymentMethod: dto.paymentMethod,
        customerId: dto.customerId,
        discount: dto.discount,
        lines: [...merged].map(([storeProductId, quantity]) => ({
          storeProductId,
          quantity,
        })),
        bottleReturns: dto.bottleReturns,
      }),
    );
    return this.get(storeId, saleId);
  }

  /**
   * Cria a venda DENTRO de uma transação já aberta (também usada para fechar comanda).
   * Tudo ou nada: estoque, venda, itens, caixa ou fiado e vasilhames.
   * Preço e custo vêm sempre do banco (ou do item da comanda), nunca do cliente.
   */
  async createInTx(tx: PrismaTx, input: CreateSaleInput): Promise<string> {
    const { storeId, companyId } = input;

    await lockCashShared(tx, storeId);
    const cash = await tx.cashRegister.findFirst({
      where: { storeId, status: 'OPEN' },
    });
    if (!cash)
      throw new ConflictException(
        'Não há caixa aberto. Abra o caixa antes de realizar vendas.',
      );

    const customerId = input.customerId ?? null;
    if (input.paymentMethod === 'CREDIT_STORE' && !customerId) {
      throw new BadRequestException(
        'Para vendas a prazo (fiado) é obrigatório informar o cliente.',
      );
    }
    if (customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId },
      });
      if (!customer)
        throw new NotFoundException('Cliente não encontrado nesta empresa.');
    }

    // ---- produtos e estoque ----------------------------------------------------------------
    const productIds = [...new Set(input.lines.map((l) => l.storeProductId))];
    const products = await tx.storeProduct.findMany({
      where: {
        id: { in: productIds },
        storeId,
        product: { deletedAt: null },
        ...(input.skipStock ? {} : { isActive: true }),
      },
      select: {
        id: true,
        price: true,
        costPrice: true,
        stock: true,
        product: { select: { name: true, bottleTypeId: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    if (byId.size !== productIds.length) {
      throw new NotFoundException(
        'Produto não encontrado, inativo ou de outra loja.',
      );
    }

    if (!input.skipStock) {
      const wanted = new Map<string, number>();
      for (const l of input.lines)
        wanted.set(
          l.storeProductId,
          (wanted.get(l.storeProductId) ?? 0) + l.quantity,
        );
      // Ordem fixa evita deadlock entre vendas simultâneas que tocam os mesmos produtos.
      for (const [id, quantity] of [...wanted].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const result = await tx.storeProduct.updateMany({
          where: { id, storeId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (result.count === 0) {
          const p = byId.get(id)!;
          throw new ConflictException(
            `Estoque insuficiente para o produto "${p.product.name}". Disponível: ${p.stock}, solicitado: ${quantity}.`,
          );
        }
      }
    }

    // ---- totais ----------------------------------------------------------------------------
    let subtotalCents = 0;
    let costCents = 0;
    const itemRows = input.lines.map((line) => {
      const p = byId.get(line.storeProductId)!;
      const price = roundMoney(line.price ?? p.price);
      const costPrice = roundMoney(line.costPrice ?? p.costPrice);
      subtotalCents += toCents(roundMoney(price * line.quantity));
      costCents += toCents(roundMoney(costPrice * line.quantity));
      return {
        storeProductId: line.storeProductId,
        quantity: line.quantity,
        price,
        costPrice,
      };
    });
    const discountCents = toCents(input.discount ?? 0);
    if (discountCents > subtotalCents) {
      throw new BadRequestException(
        'O desconto não pode ser maior que o valor total da venda.',
      );
    }
    const total = fromCents(subtotalCents - discountCents);

    // ---- venda e itens ---------------------------------------------------------------------
    const sale = await tx.sale.create({
      data: {
        storeId,
        total,
        totalCost: fromCents(costCents),
        discount: fromCents(discountCents),
        paymentMethod: input.paymentMethod,
        status: 'COMPLETED',
        userId: input.userId,
        customerId,
        commandTabId: input.commandTabId,
      },
    });
    await tx.saleItem.createMany({
      data: itemRows.map((r) => ({ ...r, saleId: sale.id })),
    });

    // ---- caixa ou fiado --------------------------------------------------------------------
    if (input.paymentMethod === 'CREDIT_STORE') {
      if (total > 0) await addCustomerDebt(tx, customerId!, storeId, total);
    } else if (total > 0) {
      await tx.cashMovement.create({
        data: {
          cashRegisterId: cash.id,
          type: 'SALE',
          amount: total,
          description: `Venda #${sale.id.slice(0, 8)}`,
        },
      });
    }

    await this.registerBottles(tx, input, byId, sale.id, customerId);
    return sale.id;
  }

  /**
   * Vasilhames da venda: cada produto com vasilhame leva `quantidade` vasilhames emprestados (sai
   * do estoque da loja e vira dívida do cliente) e o cliente pode devolver na hora. Quem sai
   * devendo (ou com crédito) precisa estar identificado na venda.
   */
  private async registerBottles(
    tx: PrismaTx,
    input: CreateSaleInput,
    products: Map<string, { product: { bottleTypeId: string | null } }>,
    saleId: string,
    customerId: string | null,
  ) {
    // TODO(decisão-produto): cada produto com vasilhame leva `quantity` vasilhames (como no sistema antigo),
    // e não `quantity × packQuantity`. Confirmar com o usuário.
    const taken = new Map<string, number>();
    for (const line of input.lines) {
      const bottleTypeId = products.get(line.storeProductId)!.product
        .bottleTypeId;
      if (bottleTypeId)
        taken.set(bottleTypeId, (taken.get(bottleTypeId) ?? 0) + line.quantity);
    }
    const returned = new Map<string, number>();
    for (const r of input.bottleReturns ?? []) {
      returned.set(
        r.bottleTypeId,
        (returned.get(r.bottleTypeId) ?? 0) + r.quantity,
      );
    }

    const typeIds = [...new Set([...taken.keys(), ...returned.keys()])].sort();
    if (typeIds.length === 0) return;

    const valid = await tx.bottleType.count({
      where: { id: { in: typeIds }, companyId: input.companyId },
    });
    if (valid !== typeIds.length)
      throw new NotFoundException(
        'Tipo de vasilhame não encontrado nesta empresa.',
      );

    const { storeId } = input;
    const shortId = saleId.slice(0, 8);
    for (const typeId of typeIds) {
      const took = taken.get(typeId) ?? 0;
      const gave = returned.get(typeId) ?? 0;
      if (took !== gave && !customerId) {
        throw new BadRequestException(
          'Para ficar com saldo devedor ou credor de vasilhames, é obrigatório selecionar um cliente na venda.',
        );
      }

      // TODO(decisão-produto): o estoque de vasilhame pode ficar negativo numa venda (não se barra o PDV);
      // nas movimentações manuais ele nunca fica negativo.
      // Na venda o estoque de vasilhame pode ficar negativo: não se barra a venda por isso.
      if (took > 0) {
        await addStoreBottleStock(tx, storeId, typeId, -took, true);
        if (customerId)
          await addCustomerBottleBalance(tx, customerId, storeId, typeId, took);
        await recordBottleMovement(tx, {
          storeId,
          bottleTypeId: typeId,
          quantity: -took,
          type: 'CUSTOMER_BORROW',
          customerId,
          saleId,
          description: `Empréstimo automático (venda #${shortId})`,
        });
      }
      if (gave > 0) {
        await addStoreBottleStock(tx, storeId, typeId, gave, true);
        if (customerId)
          await addCustomerBottleBalance(
            tx,
            customerId,
            storeId,
            typeId,
            -gave,
          );
        await recordBottleMovement(tx, {
          storeId,
          bottleTypeId: typeId,
          quantity: gave,
          type: 'CUSTOMER_RETURN',
          customerId,
          saleId,
          description: `Devolução no PDV (venda #${shortId})`,
        });
      }
    }
  }

  async get(storeId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, storeId },
      select: SALE_SELECT,
    });
    if (!sale) throw new NotFoundException('Venda não encontrada.');
    return sale;
  }

  async list(storeId: string, query: ListSalesQuery) {
    const tz = this.config.get('APP_TIMEZONE', { infer: true });
    const where: Prisma.SaleWhereInput = {
      storeId,
      ...(query.search ? { id: { startsWith: query.search } } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate
                ? { gte: dayStart(query.startDate, tz) }
                : {}),
              ...(query.endDate
                ? { lt: addDays(dayStart(query.endDate, tz), 1) }
                : {}),
            },
          }
        : {}),
    };

    const [data, totalItems, totals] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        select: SALE_SELECT,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.sale.count({ where }),
      // Receita e lucro: só vendas concluídas dentro do mesmo filtro.
      this.prisma.sale.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { total: true, totalCost: true },
      }),
    ]);

    const revenue = roundMoney(totals._sum.total ?? 0);
    const cost = roundMoney(totals._sum.totalCost ?? 0);
    const result = paginate(data, totalItems, query.page, query.limit);
    return {
      ...result,
      meta: {
        ...result.meta,
        totalRevenue: revenue,
        totalProfit: roundMoney(revenue - cost),
      },
    };
  }

  /**
   * Cancela a venda: devolve o estoque, estorna caixa ou fiado e desfaz os vasilhames com
   * movimentos COMPENSATÓRIOS (os originais permanecem no histórico). Exige caixa aberto.
   */
  async cancel(storeId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockCashShared(tx, storeId);

      const sale = await tx.sale.findFirst({
        where: { id, storeId },
        include: { items: { where: { deletedAt: null } } },
      });
      if (!sale) throw new NotFoundException('Venda não encontrada.');
      if (sale.status === 'CANCELED')
        throw new ConflictException('Esta venda já está cancelada.');

      const cash = await tx.cashRegister.findFirst({
        where: { storeId, status: 'OPEN' },
      });
      if (!cash) {
        throw new ConflictException(
          'Para cancelar uma venda, o caixa precisa estar aberto para registrar o estorno.',
        );
      }

      // TODO(decisão-produto): venda a prazo já paga em parte NÃO pode ser cancelada (409, estorno manual).
      // A alternativa seria deixar o saldo do cliente ficar negativo (crédito).
      const isCredit = sale.paymentMethod === 'CREDIT_STORE' && sale.customerId;
      if (isCredit) {
        const debt = await tx.customerStoreBalance.findFirst({
          where: { customerId: sale.customerId!, storeId },
        });
        if (!debt || toCents(debt.balance) < toCents(sale.total)) {
          throw new ConflictException(
            'Não é possível cancelar: o cliente já pagou parte desta venda a prazo. Faça o estorno manualmente.',
          );
        }
      }

      // Reivindica o cancelamento de forma atômica: dois cancelamentos simultâneos, só um vence.
      const claimed = await tx.sale.updateMany({
        where: { id, storeId, status: 'COMPLETED' },
        data: { status: 'CANCELED' },
      });
      if (claimed.count === 0)
        throw new ConflictException('Esta venda já está cancelada.');

      // Estoque dos produtos (a oferta pode ter sido removida da loja depois da venda).
      const back = new Map<string, number>();
      for (const item of sale.items)
        back.set(
          item.storeProductId,
          (back.get(item.storeProductId) ?? 0) + item.quantity,
        );
      for (const [storeProductId, quantity] of [...back].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        await this.audit.withDeleted(() =>
          tx.storeProduct.updateMany({
            where: { id: storeProductId, storeId },
            data: { stock: { increment: quantity } },
          }),
        );
      }

      // Vasilhames: movimento inverso para cada movimento da venda.
      const movements = await tx.bottleMovement.findMany({
        where: {
          saleId: id,
          type: { in: ['CUSTOMER_BORROW', 'CUSTOMER_RETURN'] },
        },
        orderBy: { createdAt: 'asc' },
      });
      for (const m of movements) {
        await addStoreBottleStock(
          tx,
          storeId,
          m.bottleTypeId,
          -m.quantity,
          true,
        );
        if (m.customerId)
          await addCustomerBottleBalance(
            tx,
            m.customerId,
            storeId,
            m.bottleTypeId,
            m.quantity,
          );
        await recordBottleMovement(tx, {
          storeId,
          bottleTypeId: m.bottleTypeId,
          quantity: -m.quantity,
          type:
            m.type === 'CUSTOMER_BORROW'
              ? 'CUSTOMER_RETURN'
              : 'CUSTOMER_BORROW',
          customerId: m.customerId,
          saleId: id,
          description: `Estorno (cancelamento da venda #${id.slice(0, 8)})`,
        });
      }

      if (isCredit) {
        await addCustomerDebt(tx, sale.customerId!, storeId, -sale.total);
      } else if (sale.total > 0) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: cash.id,
            type: 'OUT',
            amount: sale.total,
            description: `Cancelamento da venda #${id.slice(0, 8)}`,
          },
        });
      }
    });
    return this.get(storeId, id);
  }
}

/** Instante em que começa o dia (AAAA-MM-DD) no fuso da aplicação. */
function dayStart(day: string, timeZone: string): Date {
  return startOfDayInTz(new Date(`${day}T12:00:00Z`), timeZone);
}
