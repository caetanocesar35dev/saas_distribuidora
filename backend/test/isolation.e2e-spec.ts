import { createTestApp, TestApp } from './helpers/app';

/**
 * Isolamento entre empresas em TODOS os módulos: um usuário da empresa A, mesmo sendo OWNER,
 * nunca lê nem altera nada da empresa B, nem sabendo os ids, seja na rota ou no corpo.
 */
describe('Isolamento entre empresas em todos os módulos (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => t.reset());
  afterAll(() => t.close());

  async function twoCompanies() {
    const a = await t.factory.world();
    const b = await t.factory.world();
    const attacker = await t.login(a.owner.email); // OWNER da A

    // Dados da empresa B (a vítima)
    const bottle = await t.factory.bottleType(b.company.id);
    const sp = await t.factory.storeProduct(b.storeA.id, b.company.id, {
      bottleTypeId: bottle.id,
    });
    const customer = await t.factory.customer(b.company.id);
    await t.factory.openCash(b.storeA.id, 100);
    await t.factory.debt(customer.id, b.storeA.id, 50);
    const member = await t.factory.member(b.company.id, [
      { storeId: b.storeA.id, role: 'MANAGER' },
    ]);
    const tab = await t.audit.runAsSystem('seed', () =>
      t.prisma.commandTab.create({
        data: { storeId: b.storeA.id, name: 'Mesa B' },
      }),
    );
    const sale = await t.audit.runAsSystem('seed', () =>
      t.prisma.sale.create({
        data: { storeId: b.storeA.id, total: 10, paymentMethod: 'MONEY' },
      }),
    );
    const register = await t.prisma.cashRegister.findFirstOrThrow({
      where: { storeId: b.storeA.id },
    });
    return {
      a,
      b,
      attacker,
      bottle,
      sp,
      customer,
      member,
      tab,
      sale,
      register,
    };
  }

  type Call = [
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    url: string,
    body?: object,
  ];

  it('rotas com o tenant da vítima na URL: 404 em todas', async () => {
    const x = await twoCompanies();
    const bs = `/api/stores/${x.b.storeA.id}`;
    const bc = `/api/companies/${x.b.company.id}`;
    const calls: Call[] = [
      // empresa
      ['get', bc],
      ['patch', bc, { razaoSocial: 'Invadida' }],
      ['get', `${bc}/stores`],
      ['post', `${bc}/stores`, { name: 'X' }],
      ['get', `${bc}/members`],
      [
        'post',
        `${bc}/members`,
        {
          email: 'x@x.com',
          name: 'X',
          stores: [{ storeId: x.b.storeA.id, role: 'OWNER' }],
        },
      ],
      ['delete', `${bc}/members/${x.member.membership.id}`],
      ['get', `${bc}/dashboard`],
      // catálogo e clientes
      ['get', `${bc}/products`],
      ['post', `${bc}/products`, { name: 'X' }],
      ['get', `${bc}/bottle-types`],
      ['get', `${bc}/customers`],
      ['get', `${bc}/customers/${x.customer.id}/balances`],
      ['get', `${bc}/audit/customers/${x.customer.id}`],
      // loja
      ['get', `${bs}/dashboard`],
      ['get', `${bs}/store-products`],
      ['get', `${bs}/sales`],
      ['post', `${bs}/sales`, { paymentMethod: 'MONEY', items: [] }],
      ['get', `${bs}/sales/${x.sale.id}`],
      ['post', `${bs}/sales/${x.sale.id}/cancel`],
      ['get', `${bs}/command-tabs`],
      ['get', `${bs}/cash-register/current`],
      ['post', `${bs}/cash-register/close`],
      ['get', `${bs}/cash-register/${x.register.id}`],
      ['get', `${bs}/bottle-movements`],
      ['get', `${bs}/bottle-stock`],
      [
        'post',
        `${bs}/customers/${x.customer.id}/payments`,
        { amount: 10, paymentMethod: 'MONEY' },
      ],
      ['get', `${bs}/audit/sales/${x.sale.id}`],
    ];

    for (const [method, url, body] of calls) {
      const res = await t.http[method](url).set(x.attacker).send(body);
      expect({ url, status: res.status }).toEqual({ url, status: 404 });
    }
  });

  it('ids da vítima dentro de rotas e corpos da PRÓPRIA empresa: nunca funcionam', async () => {
    const x = await twoCompanies();
    await t.factory.openCash(x.a.storeA.id, 0);
    const own = await t.factory.storeProduct(x.a.storeA.id, x.a.company.id, {
      stock: 10,
    });
    const ac = `/api/companies/${x.a.company.id}`;
    const as = `/api/stores/${x.a.storeA.id}`;

    // [chamada, status aceitáveis]: 404 (não encontrado) ou 400 (id inválido para a empresa)
    const calls: [Call, number[]][] = [
      [['get', `${ac}/customers/${x.customer.id}`], [404]],
      [['patch', `${ac}/customers/${x.customer.id}`, { name: 'X' }], [404]],
      [['delete', `${ac}/customers/${x.customer.id}`], [404]],
      [['get', `${ac}/customers/${x.customer.id}/balances`], [404]],
      [['get', `${ac}/customers/${x.customer.id}/payments`], [404]],
      [['get', `${ac}/products/${x.sp.productId}`], [404]],
      [['patch', `${ac}/products/${x.sp.productId}`, { name: 'X' }], [404]],
      [['delete', `${ac}/products/${x.sp.productId}`], [404]],
      [
        [
          'post',
          `${ac}/products`,
          { name: 'P', stores: [{ storeId: x.b.storeA.id, price: 1 }] },
        ],
        [400],
      ],
      [
        ['post', `${ac}/products`, { name: 'P', bottleTypeId: x.bottle.id }],
        [400],
      ],
      [['patch', `${ac}/bottle-types/${x.bottle.id}`, { name: 'X' }], [404]],
      [['delete', `${ac}/bottle-types/${x.bottle.id}`], [404]],
      [['get', `${ac}/stores/${x.b.storeA.id}`], [404]],
      [['patch', `${ac}/stores/${x.b.storeA.id}`, { name: 'X' }], [404]],
      [['delete', `${ac}/stores/${x.b.storeA.id}`], [404]],
      [
        [
          'put',
          `${ac}/members/${x.member.membership.id}/stores/${x.a.storeA.id}`,
          { role: 'OWNER' },
        ],
        [404],
      ],
      [['delete', `${ac}/members/${x.member.membership.id}`], [404]],
      [
        [
          'post',
          `${ac}/members`,
          {
            email: 'x@x.com',
            name: 'X',
            stores: [{ storeId: x.b.storeA.id, role: 'OWNER' }],
          },
        ],
        [400],
      ],
      [['get', `${ac}/audit/customers/${x.customer.id}`], [404]],
      [['get', `${ac}/audit/products/${x.sp.productId}`], [404]],
      [['get', `${as}/store-products/${x.sp.id}`], [404]],
      [['patch', `${as}/store-products/${x.sp.id}`, { price: 1 }], [404]],
      [
        [
          'post',
          `${as}/store-products/${x.sp.id}/stock-entries`,
          { quantity: 5 },
        ],
        [404],
      ],
      [
        [
          'post',
          `${as}/store-products`,
          { productId: x.sp.productId, price: 5 },
        ],
        [404],
      ],
      [
        [
          'post',
          `${as}/sales`,
          {
            paymentMethod: 'MONEY',
            items: [{ storeProductId: x.sp.id, quantity: 1 }],
          },
        ],
        [404],
      ],
      [
        [
          'post',
          `${as}/sales`,
          {
            paymentMethod: 'CREDIT_STORE',
            customerId: x.customer.id,
            items: [{ storeProductId: own.id, quantity: 1 }],
          },
        ],
        [404],
      ],
      [['get', `${as}/sales/${x.sale.id}`], [404]],
      [['post', `${as}/sales/${x.sale.id}/cancel`], [404]],
      [
        [
          'post',
          `${as}/command-tabs`,
          { name: 'X', customerId: x.customer.id },
        ],
        [404],
      ],
      [['get', `${as}/command-tabs/${x.tab.id}`], [404]],
      [
        [
          'post',
          `${as}/command-tabs/${x.tab.id}/items`,
          { storeProductId: own.id, quantity: 1 },
        ],
        [404],
      ],
      [
        [
          'post',
          `${as}/command-tabs/${x.tab.id}/close`,
          { paymentMethod: 'MONEY' },
        ],
        [404],
      ],
      [['post', `${as}/command-tabs/${x.tab.id}/cancel`], [404]],
      [['get', `${as}/cash-register/${x.register.id}`], [404]],
      [
        [
          'post',
          `${as}/bottle-movements`,
          { bottleTypeId: x.bottle.id, type: 'SUPPLIER_RECEIVE', quantity: 5 },
        ],
        [404],
      ],
      [
        [
          'post',
          `${as}/customers/${x.customer.id}/bottle-returns`,
          { bottleTypeId: x.bottle.id, quantity: 1 },
        ],
        [404],
      ],
      [
        [
          'post',
          `${as}/customers/${x.customer.id}/bottle-loans`,
          { bottleTypeId: x.bottle.id, quantity: 1 },
        ],
        [404],
      ],
      [
        [
          'post',
          `${as}/customers/${x.customer.id}/payments`,
          { amount: 10, paymentMethod: 'MONEY' },
        ],
        [404],
      ],
      [['get', `${as}/audit/sales/${x.sale.id}`], [404]],
      [['get', `${as}/audit/store-products/${x.sp.id}`], [404]],
    ];

    for (const [[method, url, body], accepted] of calls) {
      const res = await t.http[method](url).set(x.attacker).send(body);
      expect({
        url,
        method,
        ok: accepted.includes(res.status),
        status: res.status,
      }).toEqual({
        url,
        method,
        ok: true,
        status: res.status,
      });
    }

    // e nada da vítima foi alterado por nenhuma dessas tentativas
    const victim = await t.prisma.customer.findUniqueOrThrow({
      where: { id: x.customer.id },
    });
    expect(victim.name).toBe(x.customer.name);
    expect(
      (
        await t.prisma.cashRegister.findUniqueOrThrow({
          where: { id: x.register.id },
        })
      ).status,
    ).toBe('OPEN');
    expect(
      (
        await t.prisma.storeProduct.findUniqueOrThrow({
          where: { id: x.sp.id },
        })
      ).stock,
    ).toBe(100);
    expect(
      (await t.prisma.sale.findUniqueOrThrow({ where: { id: x.sale.id } }))
        .status,
    ).toBe('COMPLETED');
    expect(
      (await t.prisma.commandTab.findUniqueOrThrow({ where: { id: x.tab.id } }))
        .status,
    ).toBe('OPEN');
  });

  it('listagens da própria empresa nunca trazem registros da vítima', async () => {
    const x = await twoCompanies();
    const ac = `/api/companies/${x.a.company.id}`;
    const as = `/api/stores/${x.a.storeA.id}`;
    const ids = (body: { data?: { id: string }[] } | { id: string }[]) =>
      (Array.isArray(body) ? body : (body.data ?? [])).map((r) => r.id);

    for (const path of [
      `${ac}/customers`,
      `${ac}/products`,
      `${ac}/bottle-types`,
      `${ac}/stores`,
      `${as}/store-products`,
      `${as}/sales`,
      `${as}/command-tabs`,
    ]) {
      const res = await t.http.get(path).set(x.attacker).expect(200);
      const victimIds = [
        x.customer.id,
        x.sp.productId,
        x.sp.id,
        x.bottle.id,
        x.b.storeA.id,
        x.sale.id,
        x.tab.id,
      ];
      expect({
        path,
        leaked: ids(res.body).filter((id) => victimIds.includes(id)),
      }).toEqual({ path, leaked: [] });
    }
    const members = await t.http
      .get(`${ac}/members`)
      .set(x.attacker)
      .expect(200);
    expect(JSON.stringify(members.body)).not.toContain(x.member.user.email);
    const mine = await t.http
      .get('/api/organizations/mine')
      .set(x.attacker)
      .expect(200);
    expect(mine.body.map((o: { id: string }) => o.id)).toEqual([
      x.a.organization.id,
    ]);
    const memberships = await t.http
      .get('/api/me/memberships')
      .set(x.attacker)
      .expect(200);
    expect(
      memberships.body.map((m: { companyId: string }) => m.companyId),
    ).toEqual([x.a.company.id]);
  });

  it('papel de uma empresa não vale na outra: OWNER da A é só um estranho na B', async () => {
    const x = await twoCompanies();
    // o atacante também é EMPLOYEE na B? Não: continua sem acesso a nada da B, mesmo com papel alto na A.
    await t.http
      .get(`/api/stores/${x.b.storeA.id}/cash-register/current`)
      .set(x.attacker)
      .expect(404);
    // e o responsável pela cobrança da A não gere a organização da B
    await t.http
      .post(`/api/organizations/${x.b.organization.id}/companies`)
      .set(x.attacker)
      .send({ cnpj: '11222333000181', razaoSocial: 'X', storeName: 'Y' })
      .expect(404);
  });
});
