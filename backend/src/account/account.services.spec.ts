import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { buildCnpj } from '../common/utils/document';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { CompaniesService } from './companies.service';
import { MembershipsService } from './memberships.service';
import { OrganizationsService } from './organizations.service';
import { StoresService } from './stores.service';

/** Endereço obrigatório da loja (decisão do usuário): usado nos testes que criam loja. */
const ADDRESS = {
  zipCode: '50030-230',
  street: 'Rua da Aurora',
  number: '100',
  neighborhood: 'Boa Vista',
  city: 'Recife',
  state: 'PE',
};

describe('Serviços de conta (organização, empresa, lojas e membros)', () => {
  let ctx: ServiceTestContext;
  let organizations: OrganizationsService;
  let companies: CompaniesService;
  let stores: StoresService;
  let members: MembershipsService;
  let auth: AuthService;
  let w: World;

  beforeAll(async () => {
    ctx = await createServiceTest([
      OrganizationsService,
      CompaniesService,
      StoresService,
      MembershipsService,
      AuthService,
      TokenService,
    ]);
    organizations = ctx.module.get(OrganizationsService);
    companies = ctx.module.get(CompaniesService);
    stores = ctx.module.get(StoresService);
    members = ctx.module.get(MembershipsService);
    auth = ctx.module.get(AuthService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
  });
  afterAll(() => ctx.close());

  const as = <T>(userId: string, fn: () => Promise<T>) =>
    ctx.asRequest(fn, { userId, endpoint: 'POST /api/teste' });

  describe('OrganizationsService', () => {
    it('lista as organizações do responsável e dos membros, e nenhuma de estranhos', async () => {
      const manager = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'MANAGER' },
      ]);
      const stranger = await ctx.factory.user();
      const other = await ctx.factory.world();

      const forOwner = await organizations.mine(w.owner.id);
      expect(forOwner.map((o) => o.id)).toEqual([w.organization.id]);
      expect(forOwner[0]).toMatchObject({ isBillingOwner: true });
      expect(forOwner[0].companies).toHaveLength(1);

      const forManager = await organizations.mine(manager.user.id);
      expect(forManager.map((o) => o.id)).toEqual([w.organization.id]);
      expect(forManager[0].isBillingOwner).toBe(false);

      expect(await organizations.mine(stranger.id)).toEqual([]);
      expect((await organizations.mine(other.owner.id))[0].id).toBe(
        other.organization.id,
      );
    });

    it('cria nova empresa com primeira loja e dá OWNER ao criador', async () => {
      const cnpj = buildCnpj('777000000001');
      const { company, store } = await as(w.owner.id, () =>
        organizations.createCompany(w.organization.id, w.owner.id, {
          cnpj,
          razaoSocial: 'Filial LTDA',
          storeName: 'Filial 1',
        }),
      );
      const access = await ctx.prisma.membershipStore.findFirstOrThrow({
        where: {
          storeId: store.id,
          membership: { userId: w.owner.id, companyId: company.id },
        },
      });
      expect(access.role).toBe('OWNER');
      expect(company.organizationId).toBe(w.organization.id);
    });

    it('respeita maxCompanies do plano, CNPJ inválido e CNPJ repetido', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.plan.update({
          where: { id: w.plan.id },
          data: { maxCompanies: 2 },
        }),
      );
      const create = (cnpj: string) =>
        as(w.owner.id, () =>
          organizations.createCompany(w.organization.id, w.owner.id, {
            cnpj,
            razaoSocial: 'X',
            storeName: 'Y',
          }),
        );

      await expect(create('11222333000199')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await create(buildCnpj('777000000002'));
      await expect(create(buildCnpj('777000000003'))).rejects.toBeInstanceOf(
        ConflictException,
      ); // já são 2
      expect(await ctx.prisma.company.count()).toBe(2);
    });

    it('rejeita CNPJ já cadastrado', async () => {
      const company = await ctx.prisma.company.findFirstOrThrow();
      await expect(
        as(w.owner.id, () =>
          organizations.createCompany(w.organization.id, w.owner.id, {
            cnpj: company.cnpj,
            razaoSocial: 'X',
            storeName: 'Y',
          }),
        ),
      ).rejects.toThrow();
    });

    describe('troca de plano pelo responsável', () => {
      const change = (planId: string) =>
        as(w.owner.id, () =>
          organizations.changePlan(w.organization.id, planId),
        );
      const planOf = async () =>
        (
          await ctx.prisma.organization.findUniqueOrThrow({
            where: { id: w.organization.id },
          })
        ).planId;

      it('a listagem traz quantas lojas cada empresa tem', async () => {
        const [org] = await organizations.mine(w.owner.id);
        expect(org.companies[0].storeCount).toBe(2);
      });

      it('upgrade vale na hora e não mexe na situação da assinatura', async () => {
        const before = await ctx.prisma.organization.findUniqueOrThrow({
          where: { id: w.organization.id },
        });
        const rede = await ctx.factory.plan({ priceInCents: 59900 });
        const result = await change(rede.id);
        expect(result.plan.id).toBe(rede.id);
        const after = await ctx.prisma.organization.findUniqueOrThrow({
          where: { id: w.organization.id },
        });
        expect(after.planId).toBe(rede.id);
        expect(after.subscriptionStatus).toBe(before.subscriptionStatus);
        expect(after.trialEndsAt).toEqual(before.trialEndsAt);

        const history = await ctx.prisma.organizationHistory.findMany({
          where: { id: w.organization.id },
          orderBy: { historyStart: 'desc' },
          take: 1,
        });
        expect(history[0]).toMatchObject({
          planId: rede.id,
          modifierId: w.owner.id,
        });
      });

      it('downgrade é recusado se a empresa tem mais lojas que o plano novo', async () => {
        const essencial = await ctx.factory.plan({ maxStoresPerCompany: 1 });
        await expect(change(essencial.id)).rejects.toThrow(
          /1 loja\(s\) por empresa .* tem 2/,
        );
        expect(await planOf()).toBe(w.plan.id);

        await as(w.owner.id, () => stores.remove(w.company.id, w.storeB.id));
        await change(essencial.id);
        expect(await planOf()).toBe(essencial.id);
      });

      it('downgrade é recusado se a organização tem mais empresas que o plano novo', async () => {
        await ctx.factory.company(w.organization.id);
        const single = await ctx.factory.plan({ maxCompanies: 1 });
        await expect(change(single.id)).rejects.toThrow(
          /1 empresa\(s\) e você tem 2/,
        );
        expect(await planOf()).toBe(w.plan.id);
      });

      it('recusa o plano gratuito (só do teste), o mesmo plano e plano inexistente', async () => {
        const trial = await ctx.factory.plan({ priceInCents: 0 });
        await expect(change(trial.id)).rejects.toThrow(/período de teste/);
        await expect(change(w.plan.id)).rejects.toBeInstanceOf(
          ConflictException,
        );
        await expect(
          change('00000000-0000-4000-8000-000000000000'),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(await planOf()).toBe(w.plan.id);
      });
    });
  });

  describe('CompaniesService', () => {
    it('atualiza nome e razão social, mas nunca o CNPJ', async () => {
      const before = await companies.get(w.company.id);
      const updated = await as(w.owner.id, () =>
        companies.update(w.company.id, {
          razaoSocial: 'Nova Razão',
          nomeFantasia: 'Novo Fantasia',
          ...({ cnpj: '1' } as object),
        }),
      );
      expect(updated).toMatchObject({
        razaoSocial: 'Nova Razão',
        nomeFantasia: 'Novo Fantasia',
        cnpj: before.cnpj,
      });
    });

    it('não encontra empresa inexistente', async () => {
      await expect(companies.get('nao-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('StoresService', () => {
    it('cria loja dando OWNER a todos os donos da empresa e a ninguém mais', async () => {
      const owner2 = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'OWNER' },
      ]);
      const manager = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'MANAGER' },
      ]);

      const store = await as(w.owner.id, () =>
        stores.create(w.company.id, {
          ...ADDRESS,
          name: 'Loja C',
          city: 'Recife',
        }),
      );

      const access = await ctx.prisma.membershipStore.findMany({
        where: { storeId: store.id },
        select: { role: true, membership: { select: { userId: true } } },
      });
      expect(access.map((a) => a.membership.userId).sort()).toEqual(
        [w.owner.id, owner2.user.id].sort(),
      );
      expect(access.every((a) => a.role === 'OWNER')).toBe(true);
      expect(access.some((a) => a.membership.userId === manager.user.id)).toBe(
        false,
      );
    });

    it('confere o CNPJ opcional da loja e grava sem máscara, em maiúsculas', async () => {
      const store = await as(w.owner.id, () =>
        stores.create(w.company.id, {
          ...ADDRESS,
          name: 'Loja C',
          cnpj: '12.abc.345/01de-35',
        }),
      );
      expect(store.cnpj).toBe('12ABC34501DE35');
      await expect(
        as(w.owner.id, () =>
          stores.update(w.company.id, store.id, { cnpj: '12.345' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        as(w.owner.id, () =>
          stores.create(w.company.id, {
            ...ADDRESS,
            name: 'Loja D',
            cnpj: 'qualquer',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      const updated = await as(w.owner.id, () =>
        stores.update(w.company.id, store.id, { cnpj: '11.222.333/0001-81' }),
      );
      expect(updated.cnpj).toBe('11222333000181');
    });

    it('respeita maxStoresPerCompany do plano', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.plan.update({
          where: { id: w.plan.id },
          data: { maxStoresPerCompany: 3 },
        }),
      );
      await as(w.owner.id, () =>
        stores.create(w.company.id, {
          ...ADDRESS,
          name: 'Loja C',
        }),
      );
      await expect(
        as(w.owner.id, () =>
          stores.create(w.company.id, {
            ...ADDRESS,
            name: 'Loja D',
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lojas de outra empresa não são encontradas', async () => {
      const other = await ctx.factory.world();
      await expect(
        stores.get(w.company.id, other.storeA.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(w.owner.id, () =>
          stores.update(w.company.id, other.storeA.id, { name: 'X' }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((await stores.list(w.company.id)).map((s) => s.id).sort()).toEqual(
        [w.storeA.id, w.storeB.id].sort(),
      );
    });

    it('exclui por soft delete e some da listagem; histórico guarda a exclusão', async () => {
      await as(w.owner.id, () => stores.remove(w.company.id, w.storeB.id));
      expect((await stores.list(w.company.id)).map((s) => s.id)).toEqual([
        w.storeA.id,
      ]);
      const row = await ctx.audit.withDeleted(() =>
        ctx.prisma.store.findUniqueOrThrow({ where: { id: w.storeB.id } }),
      );
      expect(row.deletedAt).not.toBeNull();
      const history = await ctx.prisma.storeHistory.findMany({
        where: { id: w.storeB.id },
        orderBy: { historyStart: 'asc' },
      });
      expect(history[history.length - 1].deletedAt).not.toBeNull();
    });

    it('bloqueia a exclusão com caixa aberto ou comanda aberta', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.cashRegister.create({ data: { storeId: w.storeA.id } }),
      );
      await expect(
        as(w.owner.id, () => stores.remove(w.company.id, w.storeA.id)),
      ).rejects.toThrow(/caixa/);

      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.commandTab.create({
          data: { storeId: w.storeB.id, name: 'Mesa 1' },
        }),
      );
      await expect(
        as(w.owner.id, () => stores.remove(w.company.id, w.storeB.id)),
      ).rejects.toThrow(/comandas/);
    });

    it('lista as lojas excluídas e reativa com os acessos de antes', async () => {
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeB.id, role: 'MANAGER' },
      ]);
      await as(w.owner.id, () => stores.remove(w.company.id, w.storeB.id));
      const deleted = await stores.listDeleted(w.company.id);
      expect(deleted.map((s) => s.id)).toEqual([w.storeB.id]);
      expect(deleted[0].deletedAt).toBeInstanceOf(Date);

      const restored = await as(w.owner.id, () =>
        stores.restore(w.company.id, w.storeB.id),
      );
      expect(restored.id).toBe(w.storeB.id);
      expect(await stores.listDeleted(w.company.id)).toEqual([]);
      expect((await stores.list(w.company.id)).map((s) => s.id).sort()).toEqual(
        [w.storeA.id, w.storeB.id].sort(),
      );
      const view = (await members.list(w.company.id)).find(
        (x) => x.membershipId === m.membership.id,
      )!;
      expect(view.stores).toEqual([
        { storeId: w.storeB.id, storeName: 'Loja B', role: 'MANAGER' },
      ]);

      await expect(
        as(w.owner.id, () => stores.restore(w.company.id, w.storeB.id)),
      ).rejects.toBeInstanceOf(ConflictException);
      const other = await ctx.factory.world();
      await expect(
        as(w.owner.id, () => stores.restore(w.company.id, other.storeA.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reativar respeita o limite de lojas do plano', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.plan.update({
          where: { id: w.plan.id },
          data: { maxStoresPerCompany: 2 },
        }),
      );
      await as(w.owner.id, () => stores.remove(w.company.id, w.storeB.id));
      await as(w.owner.id, () =>
        stores.create(w.company.id, { ...ADDRESS, name: 'Loja C' }),
      );
      await expect(
        as(w.owner.id, () => stores.restore(w.company.id, w.storeB.id)),
      ).rejects.toThrow(/plano/);
      expect((await stores.listDeleted(w.company.id)).map((s) => s.id)).toEqual(
        [w.storeB.id],
      );
    });
  });

  describe('MembershipsService', () => {
    const inviter = () => ({ id: w.owner.id, name: 'Dono' });

    it('convida usuário novo: cria conta sem senha utilizável e envia link de 7 dias', async () => {
      const result = await as(w.owner.id, () =>
        members.invite(w.company.id, inviter(), {
          email: 'novo@teste.com',
          name: 'Novo Funcionário',
          stores: [{ storeId: w.storeA.id, role: 'EMPLOYEE' }],
        }),
      );
      expect(result.invitedNewUser).toBe(true);

      const list = await members.list(w.company.id);
      const novo = list.find((m) => m.user.email === 'novo@teste.com')!;
      expect(novo.stores).toEqual([
        { storeId: w.storeA.id, storeName: 'Loja A', role: 'EMPLOYEE' },
      ]);

      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe('novo@teste.com');
      const token = decodeURIComponent(
        ctx.mail.lastLinkTo('novo@teste.com')!.split('token=')[1],
      );

      // sem o link ninguém entra; com ele, define a senha e loga
      await expect(
        ctx.asRequest(() =>
          auth.login({ email: 'novo@teste.com', password: 'qualquer-coisa' }),
        ),
      ).rejects.toThrow();
      await ctx.asRequest(() =>
        auth.resetPassword({ token, newPassword: 'MinhaSenha@1' }),
      );
      await expect(
        ctx.asRequest(() =>
          auth.login({ email: 'novo@teste.com', password: 'MinhaSenha@1' }),
        ),
      ).resolves.toBeTruthy();
    });

    it('convida usuário que já existe sem duplicá-lo', async () => {
      const existing = await ctx.factory.user({ email: 'ja@teste.com' });
      const result = await as(w.owner.id, () =>
        members.invite(w.company.id, inviter(), {
          email: 'ja@teste.com',
          name: 'Qualquer',
          stores: [{ storeId: w.storeB.id, role: 'MANAGER' }],
        }),
      );
      expect(result).toMatchObject({
        userId: existing.id,
        invitedNewUser: false,
      });
      expect(
        await ctx.prisma.user.count({ where: { email: 'ja@teste.com' } }),
      ).toBe(1);
    });

    it('rejeita loja de outra empresa e loja repetida', async () => {
      const other = await ctx.factory.world();
      const invite = (stores: { storeId: string; role: 'MANAGER' }[]) =>
        as(w.owner.id, () =>
          members.invite(w.company.id, inviter(), {
            email: 'x@x.com',
            name: 'X',
            stores,
          }),
        );
      await expect(
        invite([{ storeId: other.storeA.id, role: 'MANAGER' }]),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        invite([
          { storeId: w.storeA.id, role: 'MANAGER' },
          { storeId: w.storeA.id, role: 'MANAGER' },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await ctx.prisma.user.count({ where: { email: 'x@x.com' } })).toBe(
        0,
      );
    });

    it('um papel por loja: MANAGER na A e EMPLOYEE na B, e revogar só a B não afeta a A', async () => {
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'MANAGER' },
      ]);
      const actor = await ctx.prisma.membership.findFirstOrThrow({
        where: { userId: w.owner.id },
      });

      await as(w.owner.id, () =>
        members.setRole(
          w.company.id,
          actor.id,
          m.membership.id,
          w.storeB.id,
          'EMPLOYEE',
        ),
      );
      let view = (await members.list(w.company.id)).find(
        (x) => x.membershipId === m.membership.id,
      )!;
      expect(view.stores.map((s) => `${s.storeName}:${s.role}`)).toEqual([
        'Loja A:MANAGER',
        'Loja B:EMPLOYEE',
      ]);

      await as(w.owner.id, () =>
        members.removeFromStore(w.company.id, m.membership.id, w.storeB.id),
      );
      view = (await members.list(w.company.id)).find(
        (x) => x.membershipId === m.membership.id,
      )!;
      expect(view.stores.map((s) => `${s.storeName}:${s.role}`)).toEqual([
        'Loja A:MANAGER',
      ]);
    });

    it('revogar a última loja encerra o vínculo com a empresa; convidar de novo reativa', async () => {
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'EMPLOYEE' },
      ]);
      await as(w.owner.id, () =>
        members.removeFromStore(w.company.id, m.membership.id, w.storeA.id),
      );
      expect(
        (await members.list(w.company.id)).some(
          (x) => x.membershipId === m.membership.id,
        ),
      ).toBe(false);

      const result = await as(w.owner.id, () =>
        members.invite(w.company.id, inviter(), {
          email: m.user.email,
          name: m.user.name,
          stores: [{ storeId: w.storeB.id, role: 'MANAGER' }],
        }),
      );
      expect(result.membershipId).toBe(m.membership.id); // mesmo vínculo, reativado
      expect(
        (await members.list(w.company.id)).some(
          (x) => x.membershipId === m.membership.id,
        ),
      ).toBe(true);
    });

    it('não permite alterar o próprio papel nem deixar a empresa sem OWNER', async () => {
      const actor = await ctx.prisma.membership.findFirstOrThrow({
        where: { userId: w.owner.id },
      });
      await expect(
        as(w.owner.id, () =>
          members.setRole(
            w.company.id,
            actor.id,
            actor.id,
            w.storeA.id,
            'EMPLOYEE',
          ),
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      // único dono: rebaixar (por outra pessoa) ou remover deve falhar e nada muda
      await expect(
        as(w.owner.id, () =>
          members.setRole(
            w.company.id,
            'outro-membro',
            actor.id,
            w.storeA.id,
            'MANAGER',
          ),
        ),
      ).resolves.toBeTruthy(); // ainda sobra OWNER na loja B
      await expect(
        as(w.owner.id, () =>
          members.setRole(
            w.company.id,
            'outro-membro',
            actor.id,
            w.storeB.id,
            'MANAGER',
          ),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        as(w.owner.id, () => members.remove(w.company.id, actor.id)),
      ).rejects.toBeInstanceOf(ConflictException);

      const roles = await ctx.prisma.membershipStore.findMany({
        where: { membershipId: actor.id },
        select: { role: true },
      });
      expect(roles.map((r) => r.role).sort()).toEqual(['MANAGER', 'OWNER']);
    });

    it('remover o membro encerra todos os acessos dele', async () => {
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'MANAGER' },
        { storeId: w.storeB.id, role: 'EMPLOYEE' },
      ]);
      await as(w.owner.id, () => members.remove(w.company.id, m.membership.id));
      expect(
        await ctx.prisma.membershipStore.count({
          where: { membershipId: m.membership.id },
        }),
      ).toBe(0);
      await expect(
        as(w.owner.id, () => members.remove(w.company.id, 'nao-existe')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lista os removidos com os papéis de antes e reativa com os mesmos acessos', async () => {
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'MANAGER' },
        { storeId: w.storeB.id, role: 'EMPLOYEE' },
      ]);
      await as(w.owner.id, () => members.remove(w.company.id, m.membership.id));

      const removed = await members.listRemoved(w.company.id);
      expect(removed).toHaveLength(1);
      expect(removed[0]).toMatchObject({
        membershipId: m.membership.id,
        user: { id: m.user.id, email: m.user.email },
      });
      expect(removed[0].removedAt).toBeInstanceOf(Date);
      expect(removed[0].stores.map((s) => `${s.storeName}:${s.role}`)).toEqual([
        'Loja A:MANAGER',
        'Loja B:EMPLOYEE',
      ]);

      await as(w.owner.id, () =>
        members.restore(w.company.id, m.membership.id),
      );
      expect(await members.listRemoved(w.company.id)).toEqual([]);
      const view = (await members.list(w.company.id)).find(
        (x) => x.membershipId === m.membership.id,
      )!;
      expect(view.stores.map((s) => `${s.storeName}:${s.role}`)).toEqual([
        'Loja A:MANAGER',
        'Loja B:EMPLOYEE',
      ]);
      await expect(
        as(w.owner.id, () => members.restore(w.company.id, m.membership.id)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('a reativação não devolve loja revogada antes nem loja excluída', async () => {
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'MANAGER' },
        { storeId: w.storeB.id, role: 'EMPLOYEE' },
      ]);
      // Loja B revogada um dia antes da remoção.
      await as(w.owner.id, () =>
        members.removeFromStore(w.company.id, m.membership.id, w.storeB.id),
      );
      await ctx.audit.runAsSystem('seed', () =>
        ctx.audit.withDeleted(() =>
          ctx.prisma.membershipStore.updateMany({
            where: { membershipId: m.membership.id, storeId: w.storeB.id },
            data: { deletedAt: new Date(Date.now() - 86_400_000) },
          }),
        ),
      );
      await as(w.owner.id, () => members.remove(w.company.id, m.membership.id));
      expect(
        (await members.listRemoved(w.company.id))[0].stores.map(
          (s) => s.storeName,
        ),
      ).toEqual(['Loja A']);

      // Com a loja A excluída, não sobra acesso para devolver.
      await as(w.owner.id, () => stores.remove(w.company.id, w.storeA.id));
      await expect(
        as(w.owner.id, () => members.restore(w.company.id, m.membership.id)),
      ).rejects.toThrow(/Convide/);
      expect(
        (await members.listRemoved(w.company.id)).map((x) => x.membershipId),
      ).toEqual([m.membership.id]);
    });

    it('registra no histórico quem mudou cada papel', async () => {
      const m = await ctx.factory.member(w.company.id, [
        { storeId: w.storeA.id, role: 'EMPLOYEE' },
      ]);
      await ctx.asRequest(
        () =>
          members.setRole(
            w.company.id,
            'actor',
            m.membership.id,
            w.storeA.id,
            'MANAGER',
          ),
        {
          userId: w.owner.id,
          endpoint:
            'PUT /api/companies/:companyId/members/:membershipId/stores/:targetStoreId',
        },
      );
      const history = await ctx.prisma.membershipStoreHistory.findMany({
        where: { membershipId: m.membership.id, storeId: w.storeA.id },
        orderBy: { historyStart: 'asc' },
      });
      expect(history.map((h) => h.role)).toEqual(['EMPLOYEE', 'MANAGER']);
      expect(history[1]).toMatchObject({
        modifierId: w.owner.id,
        modifiedEndpoint:
          'PUT /api/companies/:companyId/members/:membershipId/stores/:targetStoreId',
      });
    });
  });
});
