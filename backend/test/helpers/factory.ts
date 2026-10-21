import { Prisma, PlatformRole, Role, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditContext } from '../../src/audit/audit-context';
import { buildCnpj } from '../../src/common/utils/document';
import {
  addCustomerBottleBalance,
  addStoreBottleStock,
} from '../../src/bottles/bottle-ledger';
import { addCustomerDebt } from '../../src/customers/customer-ledger';
import { ExtendedPrismaClient } from '../../src/prisma/prisma.extension';

export const DEFAULT_PASSWORD = 'Senha@123';

let sequence = 0;
const next = () => ++sequence;

export interface World {
  plan: { id: string };
  owner: { id: string; email: string };
  organization: { id: string };
  company: { id: string };
  storeA: { id: string };
  storeB: { id: string };
}

/** Cria dados de teste direto no banco (como 'seed'), sem passar pelos services. */
export class Factory {
  constructor(
    private readonly prisma: ExtendedPrismaClient,
    private readonly audit: AuditContext,
  ) {}

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return this.audit.runAsSystem('seed', fn);
  }

  plan(data: Partial<Prisma.PlanUncheckedCreateInput> = {}) {
    return this.run(() =>
      this.prisma.plan.create({
        data: { name: `Plano ${next()}`, priceInCents: 9900, ...data },
      }),
    );
  }

  user(
    data: {
      email?: string;
      name?: string;
      password?: string;
      platformRole?: PlatformRole;
      isActive?: boolean;
    } = {},
  ) {
    const n = next();
    return this.run(() =>
      this.prisma.user.create({
        data: {
          name: data.name ?? `Usuário ${n}`,
          email: data.email ?? `usuario${n}@teste.com`,
          passwordHash: bcrypt.hashSync(data.password ?? DEFAULT_PASSWORD, 4),
          platformRole: data.platformRole,
          isActive: data.isActive ?? true,
        },
      }),
    );
  }

  organization(
    ownerUserId: string,
    planId: string,
    data: {
      subscriptionStatus?: SubscriptionStatus;
      trialEndsAt?: Date | null;
      pastDueSince?: Date | null;
    } = {},
  ) {
    return this.run(() =>
      this.prisma.organization.create({
        data: {
          name: `Organização ${next()}`,
          ownerUserId,
          planId,
          subscriptionStatus: data.subscriptionStatus ?? 'ACTIVE',
          trialEndsAt: data.trialEndsAt,
          pastDueSince: data.pastDueSince,
        },
      }),
    );
  }

  company(organizationId: string, data: { nomeFantasia?: string } = {}) {
    const n = next();
    return this.run(() =>
      this.prisma.company.create({
        data: {
          cnpj: buildCnpj(String(1000 + n)),
          razaoSocial: `Distribuidora ${n} LTDA`,
          nomeFantasia: data.nomeFantasia,
          organizationId,
        },
      }),
    );
  }

  store(companyId: string, name?: string) {
    return this.run(() =>
      this.prisma.store.create({
        data: { companyId, name: name ?? `Loja ${next()}` },
      }),
    );
  }

  /** Vincula o usuário à company com um papel em cada loja informada. */
  async membership(
    userId: string,
    companyId: string,
    stores: { storeId: string; role: Role }[],
  ) {
    return this.run(async () => {
      const membership = await this.prisma.membership.create({
        data: { userId, companyId },
      });
      for (const s of stores) {
        await this.prisma.membershipStore.create({
          data: {
            membershipId: membership.id,
            storeId: s.storeId,
            role: s.role,
          },
        });
      }
      return membership;
    });
  }

  customer(companyId: string, name?: string) {
    return this.run(() =>
      this.prisma.customer.create({
        data: { companyId, name: name ?? `Cliente ${next()}` },
      }),
    );
  }

  bottleType(companyId: string, name?: string) {
    return this.run(() =>
      this.prisma.bottleType.create({
        data: { companyId, name: name ?? `Vasilhame ${next()}` },
      }),
    );
  }

  /** Abre o caixa da loja (um por loja). */
  openCash(storeId: string, initialBalance = 0) {
    return this.run(() =>
      this.prisma.cashRegister.create({ data: { storeId, initialBalance } }),
    );
  }

  /** Cria dívida de fiado do cliente na loja (pelo mesmo caminho que a aplicação usa). */
  debt(customerId: string, storeId: string, amount: number) {
    return this.run(() =>
      this.prisma.$transaction((tx) =>
        addCustomerDebt(tx, customerId, storeId, amount),
      ),
    );
  }

  /**
   * Venda fiada (sem itens: só para montar o cenário) que soma o valor à dívida do cliente na
   * loja, como a venda de verdade faz.
   */
  async creditSale(
    customerId: string,
    storeId: string,
    total: number,
    createdAt = new Date(),
  ) {
    const sale = await this.run(() =>
      this.prisma.sale.create({
        data: {
          storeId,
          customerId,
          total,
          paymentMethod: 'CREDIT_STORE',
          createdAt,
        },
      }),
    );
    await this.debt(customerId, storeId, total);
    return sale;
  }

  /** Estoque de vasilhame da loja (sem registrar movimento: só para montar o cenário). */
  bottleStock(storeId: string, bottleTypeId: string, stock: number) {
    return this.run(() =>
      this.prisma.$transaction((tx) =>
        addStoreBottleStock(tx, storeId, bottleTypeId, stock, true),
      ),
    );
  }

  /** Saldo de vasilhame que o cliente deve na loja (sem registrar movimento: só para montar o cenário). */
  bottleDebt(
    customerId: string,
    storeId: string,
    bottleTypeId: string,
    quantity: number,
  ) {
    return this.run(() =>
      this.prisma.$transaction((tx) =>
        addCustomerBottleBalance(
          tx,
          customerId,
          storeId,
          bottleTypeId,
          quantity,
        ),
      ),
    );
  }

  /** Produto do catálogo já ofertado na loja. */
  async storeProduct(
    storeId: string,
    companyId: string,
    data: {
      name?: string;
      code?: string;
      price?: number;
      costPrice?: number;
      stock?: number;
      bottleTypeId?: string;
      isActive?: boolean;
    } = {},
  ) {
    const n = next();
    return this.run(async () => {
      const product = await this.prisma.product.create({
        data: {
          companyId,
          code: data.code ?? `COD${n}`,
          name: data.name ?? `Produto ${n}`,
          bottleTypeId: data.bottleTypeId,
        },
      });
      return this.prisma.storeProduct.create({
        data: {
          storeId,
          productId: product.id,
          price: data.price ?? 10,
          costPrice: data.costPrice ?? 6,
          stock: data.stock ?? 100,
          isActive: data.isActive ?? true,
        },
      });
    });
  }

  /** Organização com uma company, duas lojas e um dono (OWNER nas duas). */
  async world(
    orgData: Parameters<Factory['organization']>[2] = {},
  ): Promise<World> {
    const plan = await this.plan();
    const owner = await this.user();
    const organization = await this.organization(owner.id, plan.id, orgData);
    const company = await this.company(organization.id);
    const storeA = await this.store(company.id, 'Loja A');
    const storeB = await this.store(company.id, 'Loja B');
    await this.membership(owner.id, company.id, [
      { storeId: storeA.id, role: 'OWNER' },
      { storeId: storeB.id, role: 'OWNER' },
    ]);
    return { plan, owner, organization, company, storeA, storeB };
  }

  /** Novo usuário com o papel informado nas lojas indicadas da company. */
  async member(companyId: string, stores: { storeId: string; role: Role }[]) {
    const user = await this.user();
    const membership = await this.membership(user.id, companyId, stores);
    return { user, membership };
  }
}
