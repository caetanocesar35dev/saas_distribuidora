import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  addCustomerBottleBalance,
  addStoreBottleStock,
  recordBottleMovement,
  returnCustomerBottles,
} from './bottle-ledger';
import {
  CustomerBottleDto,
  ListBottleMovementsQuery,
  ManualBottleMovementDto,
} from './dto/bottles.dto';

const MOVEMENT_SELECT = {
  id: true,
  storeId: true,
  bottleTypeId: true,
  bottleType: { select: { id: true, name: true } },
  quantity: true,
  type: true,
  unitPrice: true,
  description: true,
  customerId: true,
  customer: { select: { id: true, name: true } },
  supplierId: true,
  supplier: { select: { id: true, name: true } },
  saleId: true,
  createdAt: true,
} satisfies Prisma.BottleMovementSelect;

@Injectable()
export class BottleMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  /**
   * Movimentação manual da loja (envio/recebimento do fornecedor e ajuste). A quantidade é gravada
   * COM SINAL: positivo entra na loja, negativo sai. O estoque nunca pode ficar negativo aqui.
   */
  async registerManual(
    storeId: string,
    companyId: string,
    dto: ManualBottleMovementDto,
  ) {
    if (dto.type !== 'MANUAL_ADJUSTMENT' && dto.quantity < 0) {
      throw new BadRequestException(
        'Informe a quantidade como número positivo.',
      );
    }
    if (dto.supplierId && dto.type === 'MANUAL_ADJUSTMENT') {
      throw new BadRequestException(
        'O fornecedor só vale no envio e no recebimento de vasilhames.',
      );
    }
    await this.assertBottleType(companyId, dto.bottleTypeId);
    if (dto.supplierId) await this.assertSupplier(companyId, dto.supplierId);

    const signed = dto.type === 'SUPPLIER_SEND' ? -dto.quantity : dto.quantity;

    return this.prisma.$transaction(async (tx) => {
      await addStoreBottleStock(tx, storeId, dto.bottleTypeId, signed, false);
      const movement = await recordBottleMovement(tx, {
        storeId,
        bottleTypeId: dto.bottleTypeId,
        quantity: signed,
        type: dto.type,
        description: dto.description,
        supplierId: dto.supplierId,
      });
      return tx.bottleMovement.findUniqueOrThrow({
        where: { id: movement.id },
        select: MOVEMENT_SELECT,
      });
    });
  }

  /**
   * Empréstimo avulso (fora de venda): o cliente leva vasilhames da loja. O estoque da loja não
   * pode ficar negativo.
   */
  async customerBorrow(
    storeId: string,
    companyId: string,
    customerId: string,
    dto: CustomerBottleDto,
  ) {
    await this.assertBottleType(companyId, dto.bottleTypeId);
    await this.assertCustomer(companyId, customerId);

    return this.prisma.$transaction(async (tx) => {
      await addStoreBottleStock(
        tx,
        storeId,
        dto.bottleTypeId,
        -dto.quantity,
        false,
      );
      await addCustomerBottleBalance(
        tx,
        customerId,
        storeId,
        dto.bottleTypeId,
        dto.quantity,
      );
      const movement = await recordBottleMovement(tx, {
        storeId,
        bottleTypeId: dto.bottleTypeId,
        quantity: -dto.quantity,
        type: 'CUSTOMER_BORROW',
        customerId,
        description: dto.description ?? 'Empréstimo de vasilhame',
      });
      return tx.bottleMovement.findUniqueOrThrow({
        where: { id: movement.id },
        select: MOVEMENT_SELECT,
      });
    });
  }

  /**
   * Devolução do cliente. Regra do produto: só abate a dívida da PRÓPRIA loja (o movimento só
   * registra uma loja), e nunca mais do que o cliente deve nela.
   */
  async customerReturn(
    storeId: string,
    companyId: string,
    customerId: string,
    dto: CustomerBottleDto,
  ) {
    await this.assertBottleType(companyId, dto.bottleTypeId);
    await this.assertCustomer(companyId, customerId);

    return this.prisma.$transaction(async (tx) => {
      await returnCustomerBottles(
        tx,
        customerId,
        storeId,
        dto.bottleTypeId,
        dto.quantity,
      );
      await addStoreBottleStock(
        tx,
        storeId,
        dto.bottleTypeId,
        dto.quantity,
        true,
      );
      const movement = await recordBottleMovement(tx, {
        storeId,
        bottleTypeId: dto.bottleTypeId,
        quantity: dto.quantity,
        type: 'CUSTOMER_RETURN',
        customerId,
        description: dto.description ?? 'Devolução de vasilhame',
      });
      return tx.bottleMovement.findUniqueOrThrow({
        where: { id: movement.id },
        select: MOVEMENT_SELECT,
      });
    });
  }

  async list(storeId: string, query: ListBottleMovementsQuery) {
    const where: Prisma.BottleMovementWhereInput = {
      storeId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.bottleTypeId ? { bottleTypeId: query.bottleTypeId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.bottleMovement.findMany({
        where,
        select: MOVEMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.bottleMovement.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  /** Estoque de cada tipo de vasilhame da empresa nesta loja (0 para os que nunca movimentaram). */
  async stock(storeId: string, companyId: string) {
    const types = await this.prisma.bottleType.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        price: true,
        storeStocks: {
          where: { storeId, deletedAt: null },
          select: { stock: true, price: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return types.map((t) => {
      const storePrice = t.storeStocks[0]?.price ?? null;
      return {
        bottleTypeId: t.id,
        bottleTypeName: t.name,
        /** Preço do casco que vale nesta loja (null = não é vendido). */
        price: storePrice ?? t.price,
        /** Preço da empresa (Vasilhames › Tipos). */
        companyPrice: t.price,
        /** Preço próprio desta loja (null = vale o da empresa). */
        storePrice,
        stock: t.storeStocks[0]?.stock ?? 0,
      };
    });
  }

  /**
   * Preço próprio do casco nesta loja (decidido pelo usuário, 2026-11-24); `null` volta ao preço da
   * empresa. Não mexe no estoque (a linha da loja é criada com estoque zero, se ainda não existir).
   */
  async setStorePrice(
    storeId: string,
    companyId: string,
    bottleTypeId: string,
    price: number | null,
  ) {
    await this.assertBottleType(companyId, bottleTypeId);
    await this.prisma.storeBottleType.upsert({
      where: { storeId_bottleTypeId: { storeId, bottleTypeId } },
      create: { storeId, bottleTypeId, price },
      update: { price, deletedAt: null },
    });
    const row = (await this.stock(storeId, companyId)).find(
      (t) => t.bottleTypeId === bottleTypeId,
    );
    return row!;
  }

  /**
   * Saldo de cascos com cada fornecedor nesta loja: o que a loja recebeu dele menos o que enviou,
   * por tipo de vasilhame. Positivo = a loja deve cascos ao fornecedor; negativo = o fornecedor deve
   * à loja. Conta só os envios e recebimentos que têm fornecedor; fornecedor excluído continua
   * aparecendo enquanto o saldo não for zero.
   */
  async supplierBalances(storeId: string) {
    const groups = await this.prisma.bottleMovement.groupBy({
      by: ['supplierId', 'bottleTypeId', 'type'],
      where: {
        storeId,
        supplierId: { not: null },
        type: { in: ['SUPPLIER_SEND', 'SUPPLIER_RECEIVE'] },
      },
      _sum: { quantity: true },
    });
    if (groups.length === 0) return [];

    const supplierIds = [...new Set(groups.map((g) => g.supplierId!))];
    const typeIds = [...new Set(groups.map((g) => g.bottleTypeId))];
    const [suppliers, types] = await this.audit.withDeleted(() =>
      Promise.all([
        this.prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, name: true, deletedAt: true },
        }),
        this.prisma.bottleType.findMany({
          where: { id: { in: typeIds } },
          select: { id: true, name: true },
        }),
      ]),
    );
    const typeName = new Map(types.map((t) => [t.id, t.name]));

    return suppliers
      .map((s) => {
        const byType = new Map<string, { sent: number; received: number }>();
        for (const g of groups.filter((x) => x.supplierId === s.id)) {
          const line = byType.get(g.bottleTypeId) ?? { sent: 0, received: 0 };
          const qty = g._sum.quantity ?? 0;
          if (g.type === 'SUPPLIER_SEND') line.sent += -qty;
          else line.received += qty;
          byType.set(g.bottleTypeId, line);
        }
        const bottleTypes = [...byType.entries()]
          .map(([bottleTypeId, l]) => ({
            bottleTypeId,
            bottleTypeName: typeName.get(bottleTypeId) ?? '',
            sent: l.sent,
            received: l.received,
            balance: l.received - l.sent,
          }))
          .sort((a, b) => a.bottleTypeName.localeCompare(b.bottleTypeName));
        return {
          supplierId: s.id,
          supplierName: s.name,
          deleted: s.deletedAt !== null,
          bottleTypes,
        };
      })
      .filter((s) => !s.deleted || s.bottleTypes.some((t) => t.balance !== 0))
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }

  private async assertSupplier(companyId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
    });
    if (!supplier)
      throw new NotFoundException('Fornecedor não encontrado nesta empresa.');
  }

  private async assertBottleType(companyId: string, bottleTypeId: string) {
    const bottleType = await this.prisma.bottleType.findFirst({
      where: { id: bottleTypeId, companyId },
    });
    if (!bottleType)
      throw new NotFoundException(
        'Tipo de vasilhame não encontrado nesta empresa.',
      );
  }

  private async assertCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer)
      throw new NotFoundException('Cliente não encontrado nesta empresa.');
  }
}
