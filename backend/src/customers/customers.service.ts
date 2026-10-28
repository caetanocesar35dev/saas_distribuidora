import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { hasMinRole } from '../common/decorators/access.decorators';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { roundMoney, toCents, fromCents } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  ListCustomersQuery,
  UpdateCustomerDto,
} from './dto/customers.dto';

const CUSTOMER_SELECT = {
  id: true,
  companyId: true,
  name: true,
  phone: true,
  creditLimit: true,
  zipCode: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

const ADDRESS_FIELDS = [
  'zipCode',
  'street',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
] as const;

/**
 * Endereço (opcional) do DTO para o banco: campo ausente não mexe; texto vazio apaga (null); a
 * UF vai em maiúsculas.
 */
function addressData(
  dto: Partial<Record<(typeof ADDRESS_FIELDS)[number], string>>,
) {
  const data: Partial<Record<(typeof ADDRESS_FIELDS)[number], string | null>> =
    {};
  for (const key of ADDRESS_FIELDS) {
    const value = dto[key];
    if (value === undefined) continue;
    const text = value.trim();
    data[key] =
      text === '' ? null : key === 'state' ? text.toUpperCase() : text;
  }
  return data;
}

/** O limite de crédito do fiado só é definido por gerente ou dono (decisão do usuário). */
function assertCanSetCreditLimit(
  dto: { creditLimit?: number | null },
  role: Role,
) {
  if (dto.creditLimit !== undefined && !hasMinRole(role, Role.MANAGER)) {
    throw new ForbiddenException(
      'Só gerente ou dono pode definir o limite de crédito do cliente.',
    );
  }
}

/** `undefined` = não mexe; `null` = sem limite; número = limite em reais (centavos). */
const creditLimitValue = (value: number | null | undefined) =>
  value === undefined || value === null ? value : roundMoney(value);

/** Quem está pedindo: define o que pode ver nos saldos e pagamentos. */
export interface Viewer {
  role: Role;
  /** Lojas da empresa às quais o usuário tem acesso. */
  storeIds: string[];
}

export interface CustomerBalances {
  /** Soma das dívidas em todas as lojas. Só gerente e dono enxergam (funcionário recebe null). */
  total: number | null;
  /** Limite de crédito do fiado (soma de todas as lojas); null = sem limite. */
  creditLimit: number | null;
  perStore: {
    storeId: string;
    storeName: string;
    balance: number;
    /**
     * Vendas fiadas ainda em aberto que compõem a dívida. O pagamento não é ligado a uma venda
     * (abate o saldo da loja), então conta-se como se ele quitasse primeiro as mais antigas: as
     * vendas mais recentes cuja soma cobre o saldo. Uma venda paga em parte conta como aberta.
     */
    openCreditSales: number;
    /** Data da venda fiada em aberto mais antiga (null se não há dívida). */
    oldestOpenCreditSaleAt: Date | null;
  }[];
  bottles: {
    storeId: string;
    storeName: string;
    bottleTypeId: string;
    bottleTypeName: string;
    balance: number;
  }[];
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  /**
   * Lista os clientes já com a dívida de fiado de cada um (`debts`, por loja), para a tela não
   * precisar abrir cliente por cliente. Como nos saldos, o funcionário só vê as lojas dele.
   */
  async list(companyId: string, query: ListCustomersQuery, viewer: Viewer) {
    const storeFilter = hasMinRole(viewer.role, Role.MANAGER)
      ? {}
      : { storeId: { in: viewer.storeIds } };
    const debtWhere = {
      balance: { gt: 0 },
      store: { deletedAt: null, companyId },
      ...storeFilter,
    } satisfies Prisma.CustomerStoreBalanceWhereInput;

    const where: Prisma.CustomerWhereInput = {
      companyId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.withDebt ? { storeBalances: { some: debtWhere } } : {}),
    };
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: { name: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.customer.count({ where }),
    ]);

    const debts = customers.length
      ? await this.prisma.customerStoreBalance.findMany({
          where: {
            ...debtWhere,
            customerId: { in: customers.map((c) => c.id) },
          },
          select: { customerId: true, storeId: true, balance: true },
        })
      : [];
    const data = customers.map((c) => ({
      ...c,
      debts: debts
        .filter((d) => d.customerId === c.id)
        .map((d) => ({ storeId: d.storeId, balance: roundMoney(d.balance) })),
    }));
    return paginate(data, total, query.page, query.limit);
  }

  async get(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
      select: CUSTOMER_SELECT,
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    return customer;
  }

  async create(companyId: string, dto: CreateCustomerDto, role: Role) {
    assertCanSetCreditLimit(dto, role);
    return this.prisma.customer.create({
      data: {
        companyId,
        name: dto.name,
        phone: dto.phone,
        creditLimit: creditLimitValue(dto.creditLimit),
        ...addressData(dto),
      },
      select: CUSTOMER_SELECT,
    });
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateCustomerDto,
    role: Role,
  ) {
    assertCanSetCreditLimit(dto, role);
    await this.get(companyId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        creditLimit: creditLimitValue(dto.creditLimit),
        ...addressData(dto),
      },
      select: CUSTOMER_SELECT,
    });
  }

  /** Não exclui cliente que ainda deve dinheiro ou vasilhame em qualquer loja. */
  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    const [debt, bottles] = await Promise.all([
      this.prisma.customerStoreBalance.count({
        where: { customerId: id, balance: { gt: 0 } },
      }),
      this.prisma.customerStoreBottleBalance.count({
        where: { customerId: id, balance: { gt: 0 } },
      }),
    ]);
    if (debt > 0)
      throw new ConflictException(
        'O cliente tem dívida (fiado) e não pode ser excluído.',
      );
    if (bottles > 0)
      throw new ConflictException(
        'O cliente deve vasilhames e não pode ser excluído.',
      );

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Cliente excluído.' };
  }

  async restore(companyId: string, id: string) {
    const customer = await this.audit.withDeleted(() =>
      this.prisma.customer.findFirst({ where: { id, companyId } }),
    );
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    if (!customer.deletedAt)
      throw new ConflictException('O cliente não está excluído.');
    await this.audit.withDeleted(() =>
      this.prisma.customer.update({ where: { id }, data: { deletedAt: null } }),
    );
    return this.get(companyId, id);
  }

  /**
   * Saldos do cliente. O total é SEMPRE calculado na hora (soma das lojas), nunca armazenado.
   * Funcionário só enxerga as lojas a que tem acesso e não recebe o total; gerente e dono veem tudo.
   */
  async balances(
    companyId: string,
    customerId: string,
    viewer: Viewer,
  ): Promise<CustomerBalances> {
    const customer = await this.get(companyId, customerId);
    const seesAll = hasMinRole(viewer.role, Role.MANAGER);
    const storeFilter = seesAll ? {} : { storeId: { in: viewer.storeIds } };

    const [debts, bottles] = await Promise.all([
      this.prisma.customerStoreBalance.findMany({
        where: {
          customerId,
          balance: { not: 0 },
          store: { deletedAt: null, companyId },
          ...storeFilter,
        },
        select: {
          storeId: true,
          balance: true,
          store: { select: { name: true } },
        },
      }),
      this.prisma.customerStoreBottleBalance.findMany({
        where: {
          customerId,
          balance: { not: 0 },
          store: { deletedAt: null, companyId },
          ...storeFilter,
        },
        select: {
          storeId: true,
          bottleTypeId: true,
          balance: true,
          store: { select: { name: true } },
          bottleType: { select: { name: true } },
        },
      }),
    ]);

    const perStore = (
      await Promise.all(
        debts.map(async (d) => ({
          storeId: d.storeId,
          storeName: d.store.name,
          balance: roundMoney(d.balance),
          ...(await this.openCreditSales(customerId, d.storeId, d.balance)),
        })),
      )
    ).sort((a, b) => a.storeName.localeCompare(b.storeName));

    return {
      creditLimit: customer.creditLimit,
      total: seesAll
        ? fromCents(perStore.reduce((sum, d) => sum + toCents(d.balance), 0))
        : null,
      perStore,
      bottles: bottles
        .map((b) => ({
          storeId: b.storeId,
          storeName: b.store.name,
          bottleTypeId: b.bottleTypeId,
          bottleTypeName: b.bottleType.name,
          balance: b.balance,
        }))
        .sort(
          (a, b) =>
            a.storeName.localeCompare(b.storeName) ||
            a.bottleTypeName.localeCompare(b.bottleTypeName),
        ),
    };
  }

  /**
   * Quantas vendas fiadas (não canceladas) da loja ainda compõem a dívida: percorre das mais
   * recentes para as mais antigas até a soma cobrir o saldo (pagamento quita as mais antigas).
   */
  private async openCreditSales(
    customerId: string,
    storeId: string,
    balance: number,
  ): Promise<{ openCreditSales: number; oldestOpenCreditSaleAt: Date | null }> {
    const owed = toCents(balance);
    if (owed <= 0) return { openCreditSales: 0, oldestOpenCreditSaleAt: null };

    const BATCH = 200;
    let covered = 0;
    let count = 0;
    let oldest: Date | null = null;
    for (let skip = 0; covered < owed; skip += BATCH) {
      const sales = await this.prisma.sale.findMany({
        where: {
          customerId,
          storeId,
          paymentMethod: 'CREDIT_STORE',
          status: 'COMPLETED',
          total: { gt: 0 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { total: true, createdAt: true },
        skip,
        take: BATCH,
      });
      for (const sale of sales) {
        covered += toCents(sale.total);
        count += 1;
        oldest = sale.createdAt;
        if (covered >= owed) break;
      }
      if (sales.length < BATCH) break;
    }
    return { openCreditSales: count, oldestOpenCreditSaleAt: oldest };
  }
}
