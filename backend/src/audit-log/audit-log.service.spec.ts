import { NotFoundException } from '@nestjs/common';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { AuditLogService, AUDITABLE } from './audit-log.service';

describe('AuditLogService', () => {
  let ctx: ServiceTestContext;
  let log: AuditLogService;
  let w: World;
  let manager: { id: string; name: string };
  let membershipId: string;

  beforeAll(async () => {
    ctx = await createServiceTest([AuditLogService]);
    log = ctx.module.get(AuditLogService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
    const m = await ctx.factory.member(w.company.id, [
      { storeId: w.storeA.id, role: 'MANAGER' },
    ]);
    manager = m.user;
    membershipId = m.membership.id;
  });
  afterAll(() => ctx.close());

  const asUser = <T>(userId: string, endpoint: string, fn: () => Promise<T>) =>
    ctx.asRequest(fn, { userId, endpoint });
  const pause = () => new Promise((r) => setTimeout(r, 15));

  async function storeProductWithTwoPriceChanges() {
    const sp = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
      name: 'Cerveja',
      price: 10,
      costPrice: 6,
      stock: 5,
    });
    await pause();
    await asUser(
      w.owner.id,
      'PATCH /api/stores/:storeId/store-products/:id',
      () =>
        ctx.prisma.storeProduct.update({
          where: { id: sp.id },
          data: { price: 12 },
        }),
    );
    await pause();
    await asUser(
      manager.id,
      'PATCH /api/stores/:storeId/store-products/:id',
      () =>
        ctx.prisma.storeProduct.update({
          where: { id: sp.id },
          data: { price: 15, costPrice: 7 },
        }),
    );
    return sp;
  }

  it('CRITÉRIO DO PLANO: alterar o preço duas vezes mostra 3 versões, com autor, rota e diff', async () => {
    const sp = await storeProductWithTwoPriceChanges();
    const result = await log.history(
      'store',
      w.storeA.id,
      'store-products',
      sp.id,
    );

    expect(result.versions).toHaveLength(3);
    const [v1, v2, v3] = result.versions;

    expect(v1).toMatchObject({
      version: 1,
      action: 'CREATED',
      changes: null,
      author: { id: 'system', name: 'Sistema' },
      endpoint: 'seed',
    });
    expect(v1.snapshot).toMatchObject({ price: 10, costPrice: 6, stock: 5 });

    expect(v2).toMatchObject({
      version: 2,
      action: 'UPDATED',
      author: { id: w.owner.id },
      endpoint: 'PATCH /api/stores/:storeId/store-products/:id',
    });
    expect(v2.changes).toEqual([{ field: 'price', from: 10, to: 12 }]); // só o que mudou

    expect(v3).toMatchObject({
      version: 3,
      author: { id: manager.id, name: manager.name },
    });
    expect(v3.changes).toEqual([
      { field: 'price', from: 12, to: 15 },
      { field: 'costPrice', from: 6, to: 7 },
    ]);

    // as vigências encaixam e só a última está aberta
    expect(v1.historyEnd!.getTime()).toBe(v2.historyStart.getTime());
    expect(v2.historyEnd!.getTime()).toBe(v3.historyStart.getTime());
    expect(v3.historyEnd).toBeNull();
  });

  it('o diff não mostra campos de controle (autor, rota, datas de vigência)', async () => {
    const sp = await storeProductWithTwoPriceChanges();
    const { versions } = await log.history(
      'store',
      w.storeA.id,
      'store-products',
      sp.id,
    );
    for (const v of versions.slice(1)) {
      const fields = v.changes!.map((c) => c.field);
      for (const meta of [
        'modifierId',
        'modifiedEndpoint',
        'historyStart',
        'historyEnd',
        'historyId',
        'id',
      ]) {
        expect(fields).not.toContain(meta);
      }
    }
  });

  describe('?at (viagem no tempo)', () => {
    it('devolve a versão que valia no instante pedido', async () => {
      const sp = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
        price: 10,
      });
      await pause();
      const beforeChange = new Date();
      await pause();
      await asUser(w.owner.id, 'PATCH /api/x', () =>
        ctx.prisma.storeProduct.update({
          where: { id: sp.id },
          data: { price: 99 },
        }),
      );
      await pause();

      const old = await log.at(
        'store',
        w.storeA.id,
        'store-products',
        sp.id,
        beforeChange,
      );
      expect(old.version.snapshot).toMatchObject({ price: 10 });
      expect(old.version.version).toBe(1);

      const now = await log.at(
        'store',
        w.storeA.id,
        'store-products',
        sp.id,
        new Date(),
      );
      expect(now.version.snapshot).toMatchObject({ price: 99 });
    });

    it('antes da criação do registro: 404', async () => {
      const before = new Date();
      await pause();
      const sp = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      await expect(
        log.at('store', w.storeA.id, 'store-products', sp.id, before),
      ).rejects.toThrow(/não existia/);
    });
  });

  describe('exclusão e restauração', () => {
    it('registro excluído continua com o histórico acessível, com as ações DELETED e RESTORED', async () => {
      const c = await asUser(
        w.owner.id,
        'POST /api/companies/:companyId/customers',
        () =>
          ctx.prisma.customer.create({
            data: { companyId: w.company.id, name: 'Zé' },
          }),
      );
      await pause();
      await asUser(
        w.owner.id,
        'DELETE /api/companies/:companyId/customers/:id',
        () =>
          ctx.prisma.customer.update({
            where: { id: c.id },
            data: { deletedAt: new Date() },
          }),
      );
      await pause();
      await asUser(
        w.owner.id,
        'POST /api/companies/:companyId/customers/:id/restore',
        () =>
          ctx.audit.withDeleted(() =>
            ctx.prisma.customer.update({
              where: { id: c.id },
              data: { deletedAt: null },
            }),
          ),
      );

      const { versions } = await log.history(
        'company',
        w.company.id,
        'customers',
        c.id,
      );
      expect(versions.map((v) => v.action)).toEqual([
        'CREATED',
        'DELETED',
        'RESTORED',
      ]);
      expect(versions[1].changes!.map((x) => x.field)).toEqual(['deletedAt']);
    });

    it('excluído e ainda excluído: o histórico responde', async () => {
      const sp = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      await asUser(w.owner.id, 'DELETE /x', () =>
        ctx.prisma.storeProduct.update({
          where: { id: sp.id },
          data: { deletedAt: new Date() },
        }),
      );
      const { versions } = await log.history(
        'store',
        w.storeA.id,
        'store-products',
        sp.id,
      );
      expect(versions.at(-1)!.action).toBe('DELETED');
    });
  });

  describe('autor', () => {
    it('resolve o nome do usuário, mesmo que ele tenha sido excluído depois', async () => {
      const sp = await storeProductWithTwoPriceChanges();
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.user.update({
          where: { id: manager.id },
          data: { deletedAt: new Date() },
        }),
      );
      const { versions } = await log.history(
        'store',
        w.storeA.id,
        'store-products',
        sp.id,
      );
      expect(versions[2].author).toEqual({
        id: manager.id,
        name: manager.name,
      });
    });

    it('autor desconhecido fica com id e sem nome (não quebra)', async () => {
      const sp = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      await asUser('usuario-que-nao-existe', 'PATCH /x', () =>
        ctx.prisma.storeProduct.update({
          where: { id: sp.id },
          data: { price: 1 },
        }),
      );
      const { versions } = await log.history(
        'store',
        w.storeA.id,
        'store-products',
        sp.id,
      );
      expect(versions[1].author).toEqual({
        id: 'usuario-que-nao-existe',
        name: null,
      });
    });
  });

  describe('isolamento e lista fechada', () => {
    it('registro de outra loja ou outra empresa: 404 (igual a inexistente)', async () => {
      const sp = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      const other = await ctx.factory.world();

      await expect(
        log.history('store', w.storeB.id, 'store-products', sp.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        log.history('store', other.storeA.id, 'store-products', sp.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        log.history('store', w.storeA.id, 'store-products', 'nao-existe'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        log.at('store', w.storeB.id, 'store-products', sp.id, new Date()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cliente de outra empresa: 404', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.customer(other.company.id);
      await expect(
        log.history('company', w.company.id, 'customers', foreign.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        log.history('company', other.company.id, 'customers', foreign.id),
      ).resolves.toBeTruthy();
    });

    it('só aceita entidades da lista, e no escopo certo', async () => {
      const sp = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      await expect(
        log.history('store', w.storeA.id, 'users', sp.id),
      ).rejects.toThrow(/não auditável/);
      await expect(
        log.history('store', w.storeA.id, 'refresh-tokens', sp.id),
      ).rejects.toThrow(/não auditável/);
      await expect(
        log.history('company', w.company.id, 'store-products', sp.id),
      ).rejects.toThrow(/não auditável/); // é de loja
      await expect(
        log.history('store', w.storeA.id, 'customers', sp.id),
      ).rejects.toThrow(/não auditável/); // é de empresa
    });

    it('nomes perigosos de entidade não passam (prototype, injeção de nome de tabela)', async () => {
      for (const entity of [
        '__proto__',
        'constructor',
        'toString',
        'hasOwnProperty',
        'tb_users',
        'th_user_history; DROP TABLE tb_users',
        'storeProductHistory',
      ]) {
        await expect(
          log.history('store', w.storeA.id, entity, 'x'),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          log.history('company', w.company.id, entity, 'x'),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
    });

    it('a lista cobre exatamente as entidades do plano', () => {
      const byScope = (scope: string) =>
        Object.keys(AUDITABLE)
          .filter((k) => AUDITABLE[k].scope === scope)
          .sort();
      expect(byScope('store')).toEqual([
        'bottle-movements',
        'cash-registers',
        'command-tabs',
        'sales',
        'store-products',
      ]);
      expect(byScope('company')).toEqual([
        'bottle-types',
        'customers',
        'membership-stores',
        'memberships',
        'products',
        'stores',
      ]);
    });
  });

  describe('outras entidades', () => {
    it('empresa: papel do membro por loja, com id composto membershipId:storeId', async () => {
      await asUser(
        w.owner.id,
        'PUT /api/companies/:companyId/members/:membershipId/stores/:targetStoreId',
        () =>
          ctx.prisma.membershipStore.update({
            where: {
              membershipId_storeId: { membershipId, storeId: w.storeA.id },
            },
            data: { role: 'EMPLOYEE' },
          }),
      );
      const { versions } = await log.history(
        'company',
        w.company.id,
        'membership-stores',
        `${membershipId}:${w.storeA.id}`,
      );
      expect(versions.map((v) => v.snapshot.role)).toEqual([
        'MANAGER',
        'EMPLOYEE',
      ]);
      expect(versions[1].changes).toEqual([
        { field: 'role', from: 'MANAGER', to: 'EMPLOYEE' },
      ]);

      await expect(
        log.history(
          'company',
          w.company.id,
          'membership-stores',
          'sem-dois-pontos',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        log.history(
          'company',
          w.company.id,
          'membership-stores',
          `${membershipId}:${w.storeA.id}:x`,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      // membro de outra empresa
      const other = await ctx.factory.world();
      const m = await ctx.factory.member(other.company.id, [
        { storeId: other.storeA.id, role: 'OWNER' },
      ]);
      await expect(
        log.history(
          'company',
          w.company.id,
          'membership-stores',
          `${m.membership.id}:${other.storeA.id}`,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('loja: venda cancelada mostra a mudança de status', async () => {
      const sale = await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.sale.create({
          data: { storeId: w.storeA.id, total: 10, paymentMethod: 'MONEY' },
        }),
      );
      await asUser(
        manager.id,
        'POST /api/stores/:storeId/sales/:id/cancel',
        () =>
          ctx.prisma.sale.update({
            where: { id: sale.id },
            data: { status: 'CANCELED' },
          }),
      );
      const { versions } = await log.history(
        'store',
        w.storeA.id,
        'sales',
        sale.id,
      );
      expect(versions[1].changes).toEqual([
        { field: 'status', from: 'COMPLETED', to: 'CANCELED' },
      ]);
      expect(versions[1].endpoint).toBe(
        'POST /api/stores/:storeId/sales/:id/cancel',
      );
    });

    it('empresa: produto e loja', async () => {
      const product = await asUser(w.owner.id, 'POST /x', () =>
        ctx.prisma.product.create({
          data: { companyId: w.company.id, code: 'A1', name: 'Antigo' },
        }),
      );
      await asUser(w.owner.id, 'PATCH /x', () =>
        ctx.prisma.product.update({
          where: { id: product.id },
          data: { name: 'Novo' },
        }),
      );
      const p = await log.history(
        'company',
        w.company.id,
        'products',
        product.id,
      );
      expect(p.versions[1].changes).toEqual([
        { field: 'name', from: 'Antigo', to: 'Novo' },
      ]);
      expect(
        (await log.history('company', w.company.id, 'stores', w.storeA.id))
          .versions.length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
