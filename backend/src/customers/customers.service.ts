import {
  ConflictException,
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
  createdAt: true,
} satisfies Prisma.CustomerSelect;

/** Quem está pedindo: define o que pode ver nos saldos e pagamentos. */
export interface Viewer {
  role: Role;
  /** Lojas da empresa às quais o usuário tem acesso. */
  storeIds: string[];
}

export interface CustomerBalances {
  /** Soma das dívidas em todas as lojas. Só gerente e dono enxergam (funcionário recebe null). */
  total: number | null;
  perStore: { storeId: string; storeName: string; balance: number }[];
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

  async list(companyId: string, query: ListCustomersQuery) {
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
    };
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: { name: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.customer.count({ where }),
    ]);
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

  create(companyId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: { companyId, name: dto.name, phone: dto.phone },
      select: CUSTOMER_SELECT,
    });
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto) {
    await this.get(companyId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { name: dto.name, phone: dto.phone },
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
    await this.get(companyId, customerId);
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

    const perStore = debts
      .map((d) => ({
        storeId: d.storeId,
        storeName: d.store.name,
        balance: roundMoney(d.balance),
      }))
      .sort((a, b) => a.storeName.localeCompare(b.storeName));

    return {
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
}
