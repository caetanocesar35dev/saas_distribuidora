import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { PlatformService } from './platform.service';

describe('PlatformService', () => {
  let ctx: ServiceTestContext;
  let platform: PlatformService;
  let admin: { id: string };

  beforeAll(async () => {
    ctx = await createServiceTest([PlatformService]);
    platform = ctx.module.get(PlatformService);
  });
  beforeEach(async () => {
    await ctx.reset();
    admin = await ctx.factory.user({ platformRole: 'SUPERADMIN' });
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>) =>
    ctx.asRequest(fn, { userId: admin.id, endpoint: 'PATCH /api/platform/x' });
  const page = { page: 1, limit: 20 };
  const day = (n: number) => new Date(Date.now() + n * 86_400_000);

  describe('planos', () => {
    it('cria com limites (null = ilimitado), lista por preço e conta as organizações', async () => {
      const basic = await as(() =>
        platform.createPlan({
          name: 'Básico',
          priceInCents: 4900,
          maxCompanies: 1,
          maxStoresPerCompany: 2,
        }),
      );
      const pro = await as(() =>
        platform.createPlan({
          name: 'Pro',
          priceInCents: 9900,
          maxCompanies: null,
        }),
      );
      expect(pro).toMatchObject({
        maxCompanies: null,
        maxStoresPerCompany: null,
      });

      const owner = await ctx.factory.user();
      await ctx.factory.organization(owner.id, basic.id);

      const list = await platform.listPlans();
      expect(list.map((p) => [p.name, p.organizations])).toEqual([
        ['Básico', 1],
        ['Pro', 0],
      ]);
    });

    it('nome único, inclusive entre os excluídos', async () => {
      const p = await as(() =>
        platform.createPlan({ name: 'Único', priceInCents: 1 }),
      );
      await expect(
        as(() => platform.createPlan({ name: 'Único', priceInCents: 2 })),
      ).rejects.toBeInstanceOf(ConflictException);
      await as(() => platform.removePlan(p.id));
      await expect(
        as(() => platform.createPlan({ name: 'Único', priceInCents: 2 })),
      ).rejects.toThrow(/excluído/);
    });

    it('atualiza preço e limites, e renomear para um nome em uso é recusado', async () => {
      const a = await as(() =>
        platform.createPlan({ name: 'A', priceInCents: 1 }),
      );
      await as(() => platform.createPlan({ name: 'B', priceInCents: 2 }));
      const updated = await as(() =>
        platform.updatePlan(a.id, {
          priceInCents: 500,
          maxStoresPerCompany: 3,
        }),
      );
      expect(updated).toMatchObject({
        priceInCents: 500,
        maxStoresPerCompany: 3,
      });
      await expect(
        as(() => platform.updatePlan(a.id, { name: 'B' })),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        as(() => platform.updatePlan(a.id, { name: 'A' })),
      ).resolves.toBeTruthy(); // o próprio nome
      await expect(
        as(() => platform.updatePlan('nao-existe', { name: 'X' })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('não exclui plano em uso por organização', async () => {
      const plan = await ctx.factory.plan();
      const owner = await ctx.factory.user();
      await ctx.factory.organization(owner.id, plan.id);
      await expect(as(() => platform.removePlan(plan.id))).rejects.toThrow(
        /em uso/,
      );
      const free = await ctx.factory.plan();
      await expect(
        as(() => platform.removePlan(free.id)),
      ).resolves.toBeTruthy();
    });

    it('lista os planos excluídos e reativa', async () => {
      const kept = await ctx.factory.plan();
      const gone = await ctx.factory.plan();
      await as(() => platform.removePlan(gone.id));

      const deleted = await platform.listDeletedPlans();
      expect(deleted.map((p) => p.id)).toEqual([gone.id]);
      expect(deleted[0].deletedAt).toBeInstanceOf(Date);
      expect((await platform.listPlans()).map((p) => p.id)).toEqual([kept.id]);

      const restored = await as(() => platform.restorePlan(gone.id));
      expect(restored.id).toBe(gone.id);
      expect(await platform.listDeletedPlans()).toEqual([]);
      await expect(
        as(() => platform.restorePlan(gone.id)),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        as(() => platform.restorePlan('nao-existe')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('organizações', () => {
    it('lista com filtros por status, plano e busca (nome ou e-mail do responsável), paginada', async () => {
      const w1 = await ctx.factory.world({ subscriptionStatus: 'ACTIVE' });
      const w2 = await ctx.factory.world({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: day(-1),
      });
      await ctx.factory.world({ subscriptionStatus: 'CANCELED' });
      await ctx.audit.runAsSystem('seed', async () => {
        await ctx.prisma.organization.update({
          where: { id: w1.organization.id },
          data: { name: 'Distribuidora Alfa' },
        });
      });

      expect((await platform.listOrganizations(page)).meta.totalItems).toBe(3);
      expect(
        (
          await platform.listOrganizations({ ...page, status: 'PAST_DUE' })
        ).data.map((o) => o.id),
      ).toEqual([w2.organization.id]);
      expect(
        (
          await platform.listOrganizations({ ...page, planId: w1.plan.id })
        ).data.map((o) => o.id),
      ).toEqual([w1.organization.id]);
      expect(
        (
          await platform.listOrganizations({ ...page, search: 'alfa' })
        ).data.map((o) => o.id),
      ).toEqual([w1.organization.id]);
      expect(
        (
          await platform.listOrganizations({
            ...page,
            search: w2.owner.email.toUpperCase(),
          })
        ).data.map((o) => o.id),
      ).toEqual([w2.organization.id]);
      expect(
        (await platform.listOrganizations({ page: 2, limit: 2 })).data,
      ).toHaveLength(1);
    });

    it('detalhe traz plano, responsável, empresas, lojas e quantos usuários', async () => {
      const w = await ctx.factory.world();
      await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'MANAGER' },
      ]);
      await ctx.factory.member(w.company.id, [
        { storeId: w.storeB.id, role: 'EMPLOYEE' },
      ]);

      const detail = await platform.getOrganization(w.organization.id);
      expect(detail.owner.id).toBe(w.owner.id);
      expect(detail.companies).toHaveLength(1);
      expect(detail.companies[0].stores.map((s) => s.name).sort()).toEqual([
        'Loja A',
        'Loja B',
      ]);
      expect(detail.userCount).toBe(3); // dono + 2 membros
      await expect(
        platform.getOrganization('nao-existe'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('detalhe mostra as lojas excluídas e as pessoas removidas, com a data', async () => {
      const w = await ctx.factory.world();
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'EMPLOYEE' },
      ]);
      await ctx.audit.runAsSystem('seed', async () => {
        await ctx.prisma.store.update({
          where: { id: w.storeB.id },
          data: { deletedAt: new Date() },
        });
        await ctx.prisma.membership.update({
          where: { id: m.membership.id },
          data: { deletedAt: new Date() },
        });
      });

      const detail = await platform.getOrganization(w.organization.id);
      const stores = detail.companies[0].stores;
      expect(stores.find((s) => s.id === w.storeA.id)?.deletedAt).toBeNull();
      expect(
        stores.find((s) => s.id === w.storeB.id)?.deletedAt,
      ).toBeInstanceOf(Date);
      expect(
        detail.people.map((p) => [p.user.id, p.removedAt !== null]),
      ).toEqual([
        [w.owner.id, false],
        [m.user.id, true],
      ]);
      expect(detail.people[0].companyId).toBe(w.company.id);
    });

    it('entrar em PAST_DUE marca o início do atraso; continuar em PAST_DUE não reinicia a carência', async () => {
      const w = await ctx.factory.world({ subscriptionStatus: 'ACTIVE' });
      const first = await as(() =>
        platform.updateOrganization(w.organization.id, {
          subscriptionStatus: 'PAST_DUE',
        }),
      );
      expect(first.subscriptionStatus).toBe('PAST_DUE');
      expect(first.pastDueSince).toBeInstanceOf(Date);

      const marked = first.pastDueSince!.getTime();
      const again = await as(() =>
        platform.updateOrganization(w.organization.id, {
          subscriptionStatus: 'PAST_DUE',
        }),
      );
      expect(again.pastDueSince!.getTime()).toBe(marked);
    });

    it('sair de PAST_DUE limpa o atraso; cortesia explícita (pastDueSince null) também', async () => {
      const w = await ctx.factory.world({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: day(-3),
      });
      const active = await as(() =>
        platform.updateOrganization(w.organization.id, {
          subscriptionStatus: 'ACTIVE',
        }),
      );
      expect(active.pastDueSince).toBeNull();

      const w2 = await ctx.factory.world({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: day(-3),
      });
      const courtesy = await as(() =>
        platform.updateOrganization(w2.organization.id, { pastDueSince: null }),
      );
      expect(courtesy.pastDueSince).toBeNull();
      expect(courtesy.subscriptionStatus).toBe('PAST_DUE');
    });

    it('estende o teste, troca o plano e rejeita plano inexistente', async () => {
      const w = await ctx.factory.world({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: day(2),
      });
      const other = await ctx.factory.plan({ name: 'Outro' });
      const newEnd = day(20);
      const updated = await as(() =>
        platform.updateOrganization(w.organization.id, {
          trialEndsAt: newEnd,
          planId: other.id,
        }),
      );
      expect(updated.trialEndsAt!.getTime()).toBe(newEnd.getTime());
      expect(updated.plan.id).toBe(other.id);
      await expect(
        as(() =>
          platform.updateOrganization(w.organization.id, {
            planId: 'nao-existe',
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() =>
          platform.updateOrganization('nao-existe', { planId: other.id }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('a alteração fica no histórico com o autor da plataforma', async () => {
      const w = await ctx.factory.world();
      await as(() =>
        platform.updateOrganization(w.organization.id, {
          subscriptionStatus: 'CANCELED',
        }),
      );
      const history = await ctx.prisma.organizationHistory.findMany({
        where: { id: w.organization.id },
        orderBy: { historyStart: 'asc' },
      });
      expect(history.at(-1)).toMatchObject({
        subscriptionStatus: 'CANCELED',
        modifierId: admin.id,
      });
    });
  });

  describe('usuários', () => {
    it('busca por nome ou e-mail e filtra por situação', async () => {
      await ctx.factory.user({ name: 'Maria Silva', email: 'maria@x.com' });
      await ctx.factory.user({
        name: 'João',
        email: 'joao@x.com',
        isActive: false,
      });
      expect(
        (await platform.listUsers({ ...page, search: 'MARIA' })).data.map(
          (u) => u.email,
        ),
      ).toEqual(['maria@x.com']);
      expect(
        (await platform.listUsers({ ...page, search: 'joao@' })).data,
      ).toHaveLength(1);
      expect(
        (await platform.listUsers({ ...page, isActive: false })).data.map(
          (u) => u.email,
        ),
      ).toEqual(['joao@x.com']);
      expect((await platform.listUsers(page)).data[0]).not.toHaveProperty(
        'passwordHash',
      );
    });

    it('desativar encerra as sessões do usuário; reativar libera', async () => {
      const user = await ctx.factory.user();
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.refreshToken.create({
          data: {
            userId: user.id,
            familyId: 'f',
            tokenHash: 'h1',
            expiresAt: day(10),
          },
        }),
      );
      const off = await as(() =>
        platform.setUserActive(admin.id, user.id, false),
      );
      expect(off.isActive).toBe(false);
      expect(
        (await ctx.prisma.refreshToken.findFirstOrThrow()).revokedAt,
      ).not.toBeNull();

      const on = await as(() =>
        platform.setUserActive(admin.id, user.id, true),
      );
      expect(on.isActive).toBe(true);
    });

    it('não permite desativar a si mesmo e recusa usuário inexistente', async () => {
      await expect(
        as(() => platform.setUserActive(admin.id, admin.id, false)),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        as(() => platform.setUserActive(admin.id, 'nao-existe', false)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
