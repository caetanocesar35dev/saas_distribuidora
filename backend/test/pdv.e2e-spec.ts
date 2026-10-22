import { createTestApp, TestApp } from './helpers/app';

describe('PDV: caixa, vendas, comandas e fiado pela API (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => t.reset());
  afterAll(() => t.close());

  const day = (n: number) => new Date(Date.now() + n * 86_400_000);

  async function scenario(org: Parameters<typeof t.factory.world>[0] = {}) {
    const w = await t.factory.world(org);
    const employee = await t.factory.member(w.company.id, [
      { storeId: w.storeA.id, role: 'EMPLOYEE' },
    ]);
    const manager = await t.factory.member(w.company.id, [
      { storeId: w.storeA.id, role: 'MANAGER' },
    ]);
    const beer = await t.factory.storeProduct(w.storeA.id, w.company.id, {
      name: 'Cerveja',
      price: 10,
      stock: 50,
    });
    return {
      w,
      beer,
      owner: await t.login(w.owner.email),
      employee: await t.login(employee.user.email),
      manager: await t.login(manager.user.email),
      base: `/api/stores/${w.storeA.id}`,
    };
  }

  it('fluxo completo: abrir caixa -> vender -> cancelar -> fechar', async () => {
    const s = await scenario();

    await t.http
      .post(`${s.base}/cash-register/open`)
      .set(s.employee)
      .send({ initialBalance: 100 })
      .expect(201);
    const sale = await t.http
      .post(`${s.base}/sales`)
      .set(s.employee)
      .send({
        paymentMethod: 'MONEY',
        items: [{ storeProductId: s.beer.id, quantity: 3 }],
      })
      .expect(201);
    expect(sale.body).toMatchObject({ total: 30, status: 'COMPLETED' });

    const current = await t.http
      .get(`${s.base}/cash-register/current`)
      .set(s.employee)
      .expect(200);
    expect(current.body.currentBalance).toBe(130);

    await t.http
      .post(`${s.base}/sales/${sale.body.id}/cancel`)
      .set(s.manager)
      .expect(200);
    const closed = await t.http
      .post(`${s.base}/cash-register/close`)
      .set(s.employee)
      .expect(200);
    expect(closed.body.register).toMatchObject({
      status: 'CLOSED',
      finalBalance: 100,
    });
  });

  it('o preço e o custo enviados pelo cliente são rejeitados (sempre vêm do banco)', async () => {
    const s = await scenario();
    await t.http
      .post(`${s.base}/cash-register/open`)
      .set(s.employee)
      .send({ initialBalance: 0 })
      .expect(201);
    const res = await t.http
      .post(`${s.base}/sales`)
      .set(s.employee)
      .send({
        paymentMethod: 'MONEY',
        items: [{ storeProductId: s.beer.id, quantity: 1, price: 0.01 }],
      })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('price');
  });

  it('papéis: funcionário vende e recebe entrada, mas não cancela venda nem faz saída de caixa', async () => {
    const s = await scenario();
    await t.http
      .post(`${s.base}/cash-register/open`)
      .set(s.employee)
      .send({ initialBalance: 100 })
      .expect(201);
    const sale = await t.http
      .post(`${s.base}/sales`)
      .set(s.employee)
      .send({
        paymentMethod: 'PIX',
        items: [{ storeProductId: s.beer.id, quantity: 1 }],
      })
      .expect(201);

    await t.http
      .post(`${s.base}/cash-register/movements`)
      .set(s.employee)
      .send({ type: 'IN', amount: 5 })
      .expect(201);
    await t.http
      .post(`${s.base}/cash-register/movements`)
      .set(s.employee)
      .send({ type: 'OUT', amount: 5 })
      .expect(403);
    await t.http
      .post(`${s.base}/cash-register/movements`)
      .set(s.manager)
      .send({ type: 'OUT', amount: 5 })
      .expect(201);
    await t.http
      .post(`${s.base}/sales/${sale.body.id}/cancel`)
      .set(s.employee)
      .expect(403);
    await t.http
      .post(`${s.base}/sales/${sale.body.id}/cancel`)
      .set(s.manager)
      .expect(200);
  });

  it('o atendente nunca recebe custo nem lucro; gerente e dono recebem', async () => {
    const s = await scenario();
    await t.http
      .post(`${s.base}/cash-register/open`)
      .set(s.employee)
      .send({ initialBalance: 0 })
      .expect(201);
    const sold = await t.http
      .post(`${s.base}/sales`)
      .set(s.employee)
      .send({
        paymentMethod: 'MONEY',
        items: [{ storeProductId: s.beer.id, quantity: 2 }],
      })
      .expect(201);
    const tab = await t.http
      .post(`${s.base}/command-tabs`)
      .set(s.employee)
      .send({ name: 'Mesa 1' })
      .expect(201);
    await t.http
      .post(`${s.base}/command-tabs/${tab.body.id}/items`)
      .set(s.employee)
      .send({ storeProductId: s.beer.id, quantity: 1 })
      .expect(201);

    const COST = /costPrice|totalCost|totalProfit|"profit"/;
    const routes = [
      `${s.base}/sales`,
      `${s.base}/sales/${sold.body.id}`,
      `${s.base}/store-products`,
      `${s.base}/store-products/${s.beer.id}`,
      `${s.base}/command-tabs/${tab.body.id}`,
      `/api/companies/${s.w.company.id}/products`,
    ];
    // a resposta da própria venda também vem sem custo
    expect(JSON.stringify(sold.body)).not.toMatch(COST);
    for (const route of routes) {
      const res = await t.http.get(route).set(s.employee).expect(200);
      expect({ route, body: JSON.stringify(res.body) }).not.toEqual({
        route,
        body: expect.stringMatching(COST),
      });
    }

    const asManager = await t.http.get(`${s.base}/sales`).set(s.manager);
    expect(asManager.body.meta.totalProfit).toBeDefined();
    expect(asManager.body.data[0].totalCost).toBeDefined();
    expect(asManager.body.data[0].items[0].costPrice).toBeDefined();
  });

  it('isolamento: quem não é da loja recebe 404 em qualquer rota do PDV', async () => {
    const s = await scenario();
    const other = await t.factory.world();
    const stranger = await t.login(other.owner.email);
    for (const [method, path] of [
      ['get', '/cash-register/current'],
      ['get', '/sales'],
      ['get', '/command-tabs'],
      ['get', '/store-products'],
    ] as const) {
      await t.http[method](`${s.base}${path}`).set(stranger).expect(404);
    }
    await t.http.post(`${s.base}/sales`).set(stranger).send({}).expect(404);
  });

  it('comanda pela API: abrir, adicionar, remover e fechar', async () => {
    const s = await scenario();
    await t.http
      .post(`${s.base}/cash-register/open`)
      .set(s.employee)
      .send({ initialBalance: 0 })
      .expect(201);

    const tab = await t.http
      .post(`${s.base}/command-tabs`)
      .set(s.employee)
      .send({ name: 'Mesa 7' })
      .expect(201);
    const item = await t.http
      .post(`${s.base}/command-tabs/${tab.body.id}/items`)
      .set(s.employee)
      .send({ storeProductId: s.beer.id, quantity: 2 })
      .expect(201);
    await t.http
      .post(`${s.base}/command-tabs/${tab.body.id}/items`)
      .set(s.employee)
      .send({ storeProductId: s.beer.id, quantity: 1 })
      .expect(201);
    await t.http
      .delete(`${s.base}/command-tabs/${tab.body.id}/items/${item.body.id}`)
      .set(s.employee)
      .expect(200);

    const detail = await t.http
      .get(`${s.base}/command-tabs/${tab.body.id}`)
      .set(s.employee)
      .expect(200);
    expect(detail.body).toMatchObject({ total: 10 });

    const sale = await t.http
      .post(`${s.base}/command-tabs/${tab.body.id}/close`)
      .set(s.employee)
      .send({ paymentMethod: 'MONEY' })
      .expect(200);
    expect(sale.body).toMatchObject({ total: 10, commandTabId: tab.body.id });
  });

  it('fiado pela API: venda a prazo e pagamento em outra loja (abatimento cruzado)', async () => {
    const s = await scenario();
    const customer = await t.http
      .post(`/api/companies/${s.w.company.id}/customers`)
      .set(s.employee)
      .send({ name: 'Zé do Bar' })
      .expect(201);
    await t.http
      .post(`${s.base}/cash-register/open`)
      .set(s.owner)
      .send({ initialBalance: 0 })
      .expect(201);
    await t.http
      .post(`${s.base}/sales`)
      .set(s.owner)
      .send({
        paymentMethod: 'CREDIT_STORE',
        customerId: customer.body.id,
        items: [{ storeProductId: s.beer.id, quantity: 6 }],
      })
      .expect(201);

    // o dono recebe o pagamento na loja B (caixa aberto lá) abatendo a dívida da loja A
    const baseB = `/api/stores/${s.w.storeB.id}`;
    await t.http
      .post(`${baseB}/cash-register/open`)
      .set(s.owner)
      .send({ initialBalance: 0 })
      .expect(201);
    await t.http
      .post(`${baseB}/customers/${customer.body.id}/payments`)
      .set(s.owner)
      .send({
        amount: 25,
        paymentMethod: 'PIX',
        allocations: [{ storeId: s.w.storeA.id, amount: 25 }],
      })
      .expect(201);

    const balances = await t.http
      .get(
        `/api/companies/${s.w.company.id}/customers/${customer.body.id}/balances`,
      )
      .set(s.owner)
      .expect(200);
    expect(balances.body.total).toBe(35);

    // o funcionário (só loja A) não vê o total, só a própria loja
    const asEmployee = await t.http
      .get(
        `/api/companies/${s.w.company.id}/customers/${customer.body.id}/balances`,
      )
      .set(s.employee)
      .expect(200);
    expect(asEmployee.body.total).toBeNull();
    expect(asEmployee.body.perStore).toHaveLength(1);
  });

  describe('assinatura em somente leitura (nunca bloqueio total)', () => {
    it('lê tudo, fecha o caixa já aberto, mas não vende, não abre caixa e não recebe fiado', async () => {
      // monta com assinatura ativa, abre o caixa e só depois vence
      const s = await scenario({ subscriptionStatus: 'ACTIVE' });
      const customer = await t.factory.customer(s.w.company.id);
      await t.factory.debt(customer.id, s.w.storeA.id, 30);
      await t.http
        .post(`${s.base}/cash-register/open`)
        .set(s.employee)
        .send({ initialBalance: 10 })
        .expect(201);

      await t.audit.runAsSystem('seed', () =>
        t.prisma.organization.update({
          where: { id: s.w.organization.id },
          data: { subscriptionStatus: 'PAST_DUE', pastDueSince: day(-8) },
        }),
      );

      // leitura continua
      await t.http
        .get(`${s.base}/cash-register/current`)
        .set(s.employee)
        .expect(200);
      await t.http.get(`${s.base}/sales`).set(s.employee).expect(200);
      await t.http.get(`${s.base}/store-products`).set(s.employee).expect(200);
      await t.http
        .get(
          `/api/companies/${s.w.company.id}/customers/${customer.id}/balances`,
        )
        .set(s.owner)
        .expect(200);

      // escrita bloqueada (402), inclusive receber fiado
      const blocked = await t.http
        .post(`${s.base}/sales`)
        .set(s.employee)
        .send({
          paymentMethod: 'MONEY',
          items: [{ storeProductId: s.beer.id, quantity: 1 }],
        })
        .expect(402);
      expect(blocked.body).toMatchObject({
        code: 'SUBSCRIPTION_READ_ONLY',
        reason: 'PAST_DUE',
      });
      await t.http
        .post(`${s.base}/command-tabs`)
        .set(s.employee)
        .send({ name: 'x' })
        .expect(402);
      await t.http
        .post(`${s.base}/customers/${customer.id}/payments`)
        .set(s.employee)
        .send({ amount: 10, paymentMethod: 'MONEY' })
        .expect(402);
      await t.http
        .post(`${s.base}/cash-register/movements`)
        .set(s.employee)
        .send({ type: 'IN', amount: 5 })
        .expect(402);

      // a exceção: fechar o caixa que já estava aberto
      const closed = await t.http
        .post(`${s.base}/cash-register/close`)
        .set(s.employee)
        .expect(200);
      expect(closed.body.register).toMatchObject({
        status: 'CLOSED',
        finalBalance: 10,
      });

      // e depois de fechado não abre outro enquanto estiver em somente leitura
      await t.http
        .post(`${s.base}/cash-register/open`)
        .set(s.employee)
        .send({ initialBalance: 0 })
        .expect(402);
    });

    it('dentro da carência (2 dias de atraso) tudo continua funcionando', async () => {
      const s = await scenario({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: day(-2),
      });
      await t.http
        .post(`${s.base}/cash-register/open`)
        .set(s.employee)
        .send({ initialBalance: 0 })
        .expect(201);
      await t.http
        .post(`${s.base}/sales`)
        .set(s.employee)
        .send({
          paymentMethod: 'MONEY',
          items: [{ storeProductId: s.beer.id, quantity: 1 }],
        })
        .expect(201);
    });

    it('assim que a assinatura volta a ficar ativa, o acesso completo retorna na hora', async () => {
      const s = await scenario({ subscriptionStatus: 'CANCELED' });
      await t.http
        .post(`${s.base}/cash-register/open`)
        .set(s.employee)
        .send({ initialBalance: 0 })
        .expect(402);
      await t.audit.runAsSystem('seed', () =>
        t.prisma.organization.update({
          where: { id: s.w.organization.id },
          data: { subscriptionStatus: 'ACTIVE', pastDueSince: null },
        }),
      );
      await t.http
        .post(`${s.base}/cash-register/open`)
        .set(s.employee)
        .send({ initialBalance: 0 })
        .expect(201);
    });
  });
});
