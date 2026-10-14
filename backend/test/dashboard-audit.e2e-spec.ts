import { createTestApp, TestApp } from './helpers/app';

describe('Dashboard e auditoria pela API (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => t.reset());
  afterAll(() => t.close());

  async function scenario() {
    const w = await t.factory.world();
    const employee = await t.factory.member(w.company.id, [
      { storeId: w.storeA.id, role: 'EMPLOYEE' },
    ]);
    const manager = await t.factory.member(w.company.id, [
      { storeId: w.storeA.id, role: 'MANAGER' },
    ]);
    const product = await t.factory.storeProduct(w.storeA.id, w.company.id, {
      price: 10,
      stock: 5,
    });
    return {
      w,
      product,
      owner: await t.login(w.owner.email),
      employee: await t.login(employee.user.email),
      manager: await t.login(manager.user.email),
      other: await t.login((await t.factory.world()).owner.email),
    };
  }

  describe('dashboard', () => {
    it('painel da loja: gerente e dono veem; funcionário não (403)', async () => {
      const s = await scenario();
      const url = `/api/stores/${s.w.storeA.id}/dashboard`;
      await t.http.get(url).set(s.employee).expect(403);
      const res = await t.http.get(url).set(s.manager).expect(200);
      expect(res.body).toMatchObject({
        today: { revenue: 0, count: 0 },
        debt: 0,
      });
      expect(res.body.chart).toHaveLength(7);
      await t.http.get(url).set(s.owner).expect(200);
    });

    it('painel da empresa: só o dono (gerente 403) e traz a quebra por loja', async () => {
      const s = await scenario();
      const url = `/api/companies/${s.w.company.id}/dashboard`;
      await t.http.get(url).set(s.manager).expect(403);
      const res = await t.http.get(url).set(s.owner).expect(200);
      expect(
        res.body.byStore.map((b: { storeName: string }) => b.storeName),
      ).toEqual(['Loja A', 'Loja B']);
    });

    it('de outra empresa: 404', async () => {
      const s = await scenario();
      await t.http
        .get(`/api/stores/${s.w.storeA.id}/dashboard`)
        .set(s.other)
        .expect(404);
      await t.http
        .get(`/api/companies/${s.w.company.id}/dashboard`)
        .set(s.other)
        .expect(404);
    });

    it('continua funcionando com a assinatura em somente leitura (é leitura)', async () => {
      const w = await t.factory.world({ subscriptionStatus: 'CANCELED' });
      const auth = await t.login(w.owner.email);
      await t.http
        .get(`/api/stores/${w.storeA.id}/dashboard`)
        .set(auth)
        .expect(200);
    });
  });

  describe('auditoria', () => {
    it('histórico de um item da loja: gerente vê, funcionário não', async () => {
      const s = await scenario();
      await t.http
        .patch(`/api/stores/${s.w.storeA.id}/store-products/${s.product.id}`)
        .set(s.manager)
        .send({ price: 12.5 })
        .expect(200);

      const url = `/api/stores/${s.w.storeA.id}/audit/store-products/${s.product.id}`;
      await t.http.get(url).set(s.employee).expect(403);

      const res = await t.http.get(url).set(s.manager).expect(200);
      expect(res.body.versions).toHaveLength(2);
      expect(res.body.versions[1]).toMatchObject({
        action: 'UPDATED',
        endpoint: 'PATCH /api/stores/:storeId/store-products/:id',
        changes: [{ field: 'price', from: 10, to: 12.5 }],
      });
      expect(res.body.versions[1].author.name).toBeTruthy();
    });

    it('a rota gravada vem do interceptor (padrão da rota, sem ids)', async () => {
      const s = await scenario();
      await t.http
        .post(
          `/api/stores/${s.w.storeA.id}/store-products/${s.product.id}/stock-entries`,
        )
        .set(s.manager)
        .send({ quantity: 3 })
        .expect(200);
      const res = await t.http
        .get(
          `/api/stores/${s.w.storeA.id}/audit/store-products/${s.product.id}`,
        )
        .set(s.manager)
        .expect(200);
      expect(res.body.versions.at(-1).endpoint).toBe(
        'POST /api/stores/:storeId/store-products/:id/stock-entries',
      );
      expect(res.body.versions.at(-1).changes).toEqual([
        { field: 'stock', from: 5, to: 8 },
      ]);
    });

    it('?at devolve a versão daquele momento e valida o formato', async () => {
      const s = await scenario();
      const url = `/api/stores/${s.w.storeA.id}/audit/store-products/${s.product.id}`;
      const res = await t.http
        .get(`${url}?at=${encodeURIComponent(new Date().toISOString())}`)
        .set(s.manager)
        .expect(200);
      expect(res.body.version.snapshot).toMatchObject({ price: 10 });
      await t.http.get(`${url}?at=ontem`).set(s.manager).expect(400);
      await t.http
        .get(`${url}?at=2000-01-01T00:00:00Z`)
        .set(s.manager)
        .expect(404);
    });

    it('histórico da empresa (cliente): só o dono; gerente 403', async () => {
      const s = await scenario();
      const customer = await t.http
        .post(`/api/companies/${s.w.company.id}/customers`)
        .set(s.manager)
        .send({ name: 'Zé' })
        .expect(201);
      const url = `/api/companies/${s.w.company.id}/audit/customers/${customer.body.id}`;
      await t.http.get(url).set(s.manager).expect(403);
      const res = await t.http.get(url).set(s.owner).expect(200);
      expect(res.body.versions[0]).toMatchObject({
        action: 'CREATED',
        endpoint: 'POST /api/companies/:companyId/customers',
      });
    });

    it('usuário de outra empresa recebe 404; entidade fora da lista e escopo errado também', async () => {
      const s = await scenario();
      await t.http
        .get(
          `/api/stores/${s.w.storeA.id}/audit/store-products/${s.product.id}`,
        )
        .set(s.other)
        .expect(404);
      await t.http
        .get(`/api/stores/${s.w.storeA.id}/audit/users/${s.w.owner.id}`)
        .set(s.owner)
        .expect(404);
      await t.http
        .get(`/api/stores/${s.w.storeA.id}/audit/refresh-tokens/x`)
        .set(s.owner)
        .expect(404);
      await t.http
        .get(
          `/api/companies/${s.w.company.id}/audit/store-products/${s.product.id}`,
        )
        .set(s.owner)
        .expect(404);
    });

    it('o histórico nunca expõe segredos (hash de senha, token)', async () => {
      const s = await scenario();
      const res = await t.http
        .get(
          `/api/companies/${s.w.company.id}/audit/memberships/${(await t.prisma.membership.findFirstOrThrow()).id}`,
        )
        .set(s.owner)
        .expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash/);
    });
  });
});
