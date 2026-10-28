import { NotFoundException } from '@nestjs/common';
import { PaymentMethod, SaleStatus } from '@prisma/client';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { DashboardService } from './dashboard.service';

// "Agora" fixo: 14/10/2026 12:00 em São Paulo (UTC-3) = 15:00 UTC.
const NOW = new Date('2026-10-14T15:00:00Z');

describe('DashboardService', () => {
  let ctx: ServiceTestContext;
  let dashboard: DashboardService;
  let w: World;

  beforeAll(async () => {
    ctx = await createServiceTest([DashboardService]);
    dashboard = ctx.module.get(DashboardService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
  });
  afterAll(() => ctx.close());

  describe('primeiros passos (onboarding)', () => {
    it('loja nova: nada feito; cada item marca sozinho quando a tarefa é feita', async () => {
      const store = await ctx.factory.store(w.company.id, 'Loja Nova');
      const check = () => dashboard.onboarding(store.id, w.company.id);
      // o "world" já tem gerente/atendente? conta só os vínculos da empresa
      const members = await ctx.prisma.membership.count({
        where: { companyId: w.company.id },
      });
      expect(await check()).toEqual({
        address: false,
        products: false,
        cashOpened: false,
        team: members > 1,
      });

      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.store.update({
          where: { id: store.id },
          data: { street: 'Rua A', city: 'Recife' },
        }),
      );
      await ctx.factory.storeProduct(store.id, w.company.id);
      await ctx.factory.openCash(store.id, 0);
      await ctx.factory.member(w.company.id, [
        { storeId: store.id, role: 'EMPLOYEE' },
      ]);
      expect(await check()).toEqual({
        address: true,
        products: true,
        cashOpened: true,
        team: true,
      });
    });

    it('só a rua não basta para o endereço: precisa da cidade', async () => {
      const store = await ctx.factory.store(w.company.id, 'Loja Rua');
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.store.update({
          where: { id: store.id },
          data: { street: 'Rua A' },
        }),
      );
      expect((await dashboard.onboarding(store.id, w.company.id)).address).toBe(
        false,
      );
    });
  });

  /** Cria uma venda (com um item) numa data específica, direto no banco. */
  async function sale(opts: {
    storeId: string;
    storeProductId: string;
    at: string;
    quantity?: number;
    price?: number;
    cost?: number;
    status?: SaleStatus;
    paymentMethod?: PaymentMethod;
  }) {
    const quantity = opts.quantity ?? 1;
    const price = opts.price ?? 10;
    const cost = opts.cost ?? 6;
    return ctx.audit.runAsSystem('seed', async () => {
      const s = await ctx.prisma.sale.create({
        data: {
          storeId: opts.storeId,
          total: price * quantity,
          totalCost: cost * quantity,
          paymentMethod: opts.paymentMethod ?? 'MONEY',
          status: opts.status ?? 'COMPLETED',
          createdAt: new Date(opts.at),
        },
      });
      await ctx.prisma.saleItem.create({
        data: {
          saleId: s.id,
          storeProductId: opts.storeProductId,
          quantity,
          price,
          costPrice: cost,
        },
      });
      return s;
    });
  }

  describe('painel da loja', () => {
    it('loja sem vendas: tudo zerado, com o gráfico dos 7 dias', async () => {
      const d = await dashboard.forStore(w.storeA.id, NOW);
      expect(d).toMatchObject({
        today: { revenue: 0, profit: 0, count: 0 },
        week: { revenue: 0, profit: 0, count: 0 },
        month: { revenue: 0, profit: 0, count: 0 },
        topProducts: [],
        lowStock: [],
        debt: 0,
      });
      expect(d.chart.map((c) => c.date)).toEqual([
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
      ]);
      expect(d.chart.every((c) => c.revenue === 0 && c.count === 0)).toBe(true);
      expect(d.byStore).toBeUndefined();
    });

    it('loja inexistente: 404', async () => {
      await expect(
        dashboard.forStore('nao-existe', NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('receita, lucro e contagem de hoje, 7 dias e mês, no fuso de São Paulo', async () => {
      const p = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
        name: 'Cerveja',
      });
      const make = (
        at: string,
        extra: Partial<Parameters<typeof sale>[0]> = {},
      ) => sale({ storeId: w.storeA.id, storeProductId: p.id, at, ...extra });

      await make('2026-10-14T10:00:00Z'); // hoje (07:00 SP)               -> hoje, semana, mês
      await make('2026-10-14T14:00:00Z', { quantity: 2 }); // hoje        -> hoje, semana, mês (20 / lucro 8)
      await make('2026-10-14T02:59:00Z'); // 13/10 23:59 SP: ONTEM         -> semana, mês
      await make('2026-10-08T03:00:00Z'); // 08/10 00:00 SP: 1º dia da janela de 7 dias
      await make('2026-10-08T02:59:00Z'); // 07/10 23:59 SP: fora da semana, dentro do mês
      await make('2026-10-01T03:00:00Z'); // 01/10 00:00 SP: 1º instante do mês
      await make('2026-10-01T02:59:00Z'); // 30/09 23:59 SP: fora do mês
      await make('2026-10-14T11:00:00Z', { status: 'CANCELED', price: 999 }); // cancelada: ignorada

      const d = await dashboard.forStore(w.storeA.id, NOW);
      expect(d.today).toMatchObject({ revenue: 30, profit: 12, count: 2 });
      expect(d.week).toMatchObject({ revenue: 50, profit: 20, count: 4 });
      expect(d.month).toMatchObject({ revenue: 70, profit: 28, count: 6 });
    });

    it('fiado: entra no faturamento e no lucro, mas sai separado, com o recebido no período', async () => {
      const p = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      await sale({
        storeId: w.storeA.id,
        storeProductId: p.id,
        at: '2026-10-14T10:00:00Z',
      }); // à vista: 10 / lucro 4
      await sale({
        storeId: w.storeA.id,
        storeProductId: p.id,
        at: '2026-10-14T11:00:00Z',
        quantity: 2,
        paymentMethod: 'CREDIT_STORE',
      }); // fiado: 20 / lucro 8
      await sale({
        storeId: w.storeA.id,
        storeProductId: p.id,
        at: '2026-10-14T12:00:00Z',
        paymentMethod: 'CREDIT_STORE',
        status: 'CANCELED',
      }); // cancelada: fora de tudo
      const customer = await ctx.factory.customer(w.company.id);
      const pay = (storeId: string, amount: number, at: string) =>
        ctx.audit.runAsSystem('seed', () =>
          ctx.prisma.customerPayment.create({
            data: {
              customerId: customer.id,
              storeId,
              amount,
              paymentMethod: 'MONEY',
              createdAt: new Date(at),
            },
          }),
        );
      await pay(w.storeA.id, 7.5, '2026-10-14T13:00:00Z'); // hoje
      await pay(w.storeA.id, 100, '2026-09-20T13:00:00Z'); // mês passado
      await pay(w.storeB.id, 50, '2026-10-14T13:00:00Z'); // outra loja

      const d = await dashboard.forStore(w.storeA.id, NOW);
      expect(d.today).toEqual({
        revenue: 30,
        profit: 12,
        count: 2,
        fiado: { revenue: 20, profit: 8 },
        fiadoReceived: 7.5,
      });
      const company = await dashboard.forCompany(w.company.id, NOW);
      expect(company.today.fiadoReceived).toBe(57.5);
      expect(company.byStore?.[1].today.fiadoReceived).toBe(50);
    });

    it('não mistura vendas de outra loja', async () => {
      const a = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      const b = await ctx.factory.storeProduct(w.storeB.id, w.company.id);
      await sale({
        storeId: w.storeA.id,
        storeProductId: a.id,
        at: '2026-10-14T10:00:00Z',
      });
      await sale({
        storeId: w.storeB.id,
        storeProductId: b.id,
        at: '2026-10-14T10:00:00Z',
        price: 500,
      });
      expect((await dashboard.forStore(w.storeA.id, NOW)).today.revenue).toBe(
        10,
      );
    });

    it('soma centavos sem erro de ponto flutuante', async () => {
      const p = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      for (const price of [0.1, 0.2, 0.3]) {
        await sale({
          storeId: w.storeA.id,
          storeProductId: p.id,
          at: '2026-10-14T10:00:00Z',
          price,
          cost: 0,
        });
      }
      expect((await dashboard.forStore(w.storeA.id, NOW)).today.revenue).toBe(
        0.6,
      );
    });

    it('gráfico: agrupa por dia no fuso local e zera os dias sem venda', async () => {
      const p = await ctx.factory.storeProduct(w.storeA.id, w.company.id);
      const make = (at: string, price: number) =>
        sale({
          storeId: w.storeA.id,
          storeProductId: p.id,
          at,
          price,
          cost: 4,
        });
      await make('2026-10-14T10:00:00Z', 10); // 14
      await make('2026-10-14T20:00:00Z', 5); //  14
      await make('2026-10-14T02:30:00Z', 7); //  13 (23:30 SP)
      await make('2026-10-10T15:00:00Z', 20); // 10
      await make('2026-10-01T15:00:00Z', 999); // fora da janela

      const chart = (await dashboard.forStore(w.storeA.id, NOW)).chart;
      const byDate = Object.fromEntries(chart.map((c) => [c.date, c]));
      expect(byDate['2026-10-14']).toEqual({
        date: '2026-10-14',
        revenue: 15,
        profit: 7,
        count: 2,
      });
      expect(byDate['2026-10-13']).toEqual({
        date: '2026-10-13',
        revenue: 7,
        profit: 3,
        count: 1,
      });
      expect(byDate['2026-10-10']).toEqual({
        date: '2026-10-10',
        revenue: 20,
        profit: 16,
        count: 1,
      });
      expect(byDate['2026-10-12']).toEqual({
        date: '2026-10-12',
        revenue: 0,
        profit: 0,
        count: 0,
      });
      expect(chart).toHaveLength(7);
    });

    it('top 5 produtos por quantidade nos últimos 7 dias, com desempate por nome', async () => {
      const names = ['F', 'E', 'D', 'C', 'B', 'A'];
      const products: { id: string }[] = [];
      for (const [i, name] of names.entries()) {
        const p = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
          name,
          code: `C${i}`,
        });
        products.push(p);
        await sale({
          storeId: w.storeA.id,
          storeProductId: p.id,
          at: '2026-10-14T10:00:00Z',
          quantity: 10 - i,
        });
      }
      // produto antigo (fora dos 7 dias) não conta
      await sale({
        storeId: w.storeA.id,
        storeProductId: products[5].id,
        at: '2026-10-01T10:00:00Z',
        quantity: 500,
      });

      const top = (await dashboard.forStore(w.storeA.id, NOW)).topProducts;
      expect(top.map((t) => [t.name, t.quantity])).toEqual([
        ['F', 10],
        ['E', 9],
        ['D', 8],
        ['C', 7],
        ['B', 6],
      ]);
      expect(top[0]).toHaveProperty('code', 'C0');
    });

    it('estoque baixo: só ativos, do menor para o maior, no máximo 10', async () => {
      for (let i = 0; i < 12; i++) {
        await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
          name: `P${String(i).padStart(2, '0')}`,
          stock: i,
        });
      }
      await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
        name: 'Inativo',
        stock: 0,
        isActive: false,
      });
      await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
        name: 'Cheio',
        stock: 500,
      });

      const low = (await dashboard.forStore(w.storeA.id, NOW)).lowStock;
      expect(low).toHaveLength(10);
      expect(low.map((l) => l.stock)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(low.some((l) => l.name === 'Inativo' || l.name === 'Cheio')).toBe(
        false,
      );
    });

    it('fiado em aberto soma só as dívidas da loja', async () => {
      const c1 = await ctx.factory.customer(w.company.id);
      const c2 = await ctx.factory.customer(w.company.id);
      await ctx.factory.debt(c1.id, w.storeA.id, 40.1);
      await ctx.factory.debt(c2.id, w.storeA.id, 9.9);
      await ctx.factory.debt(c1.id, w.storeB.id, 1000);
      expect((await dashboard.forStore(w.storeA.id, NOW)).debt).toBe(50);
    });
  });

  describe('painel da empresa', () => {
    it('consolida as lojas e traz a quebra por loja', async () => {
      const a = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
        name: 'Cerveja',
        code: 'X1',
      });
      const b = await ctx.factory.storeProduct(w.storeB.id, w.company.id, {
        name: 'Refri',
        code: 'X2',
      });
      await sale({
        storeId: w.storeA.id,
        storeProductId: a.id,
        at: '2026-10-14T10:00:00Z',
        quantity: 3,
      }); // 30
      await sale({
        storeId: w.storeB.id,
        storeProductId: b.id,
        at: '2026-10-14T10:00:00Z',
        quantity: 5,
        price: 4,
        cost: 1,
      }); // 20
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.factory.debt(customer.id, w.storeA.id, 15);
      await ctx.factory.debt(customer.id, w.storeB.id, 25);

      const d = await dashboard.forCompany(w.company.id, NOW);
      expect(d.today).toMatchObject({
        revenue: 50,
        profit: 12 + 15,
        count: 2,
      });
      expect(d.debt).toBe(40);
      expect(d.byStore).toMatchObject([
        {
          storeId: w.storeA.id,
          storeName: 'Loja A',
          today: { revenue: 30, profit: 12, count: 1 },
          week: { revenue: 30, profit: 12, count: 1 },
          month: { revenue: 30, profit: 12, count: 1 },
          debt: 15,
        },
        {
          storeId: w.storeB.id,
          storeName: 'Loja B',
          today: { revenue: 20, profit: 15, count: 1 },
          week: { revenue: 20, profit: 15, count: 1 },
          month: { revenue: 20, profit: 15, count: 1 },
          debt: 25,
        },
      ]);
    });

    it('o mesmo produto do catálogo vendido em duas lojas soma no ranking da empresa', async () => {
      const product = await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.product.create({
          data: {
            companyId: w.company.id,
            code: 'SHARED',
            name: 'Compartilhado',
          },
        }),
      );
      const [spA, spB] = await ctx.audit.runAsSystem('seed', () =>
        Promise.all(
          [w.storeA.id, w.storeB.id].map((storeId) =>
            ctx.prisma.storeProduct.create({
              data: { storeId, productId: product.id, price: 10, stock: 100 },
            }),
          ),
        ),
      );
      await sale({
        storeId: w.storeA.id,
        storeProductId: spA.id,
        at: '2026-10-14T10:00:00Z',
        quantity: 4,
      });
      await sale({
        storeId: w.storeB.id,
        storeProductId: spB.id,
        at: '2026-10-14T10:00:00Z',
        quantity: 3,
      });

      const top = (await dashboard.forCompany(w.company.id, NOW)).topProducts;
      expect(top).toHaveLength(1);
      expect(top[0]).toMatchObject({ name: 'Compartilhado', quantity: 7 });
    });

    it('não inclui lojas de outra empresa nem lojas excluídas', async () => {
      const other = await ctx.factory.world();
      const spOther = await ctx.factory.storeProduct(
        other.storeA.id,
        other.company.id,
      );
      await sale({
        storeId: other.storeA.id,
        storeProductId: spOther.id,
        at: '2026-10-14T10:00:00Z',
        price: 777,
      });

      const sp = await ctx.factory.storeProduct(w.storeB.id, w.company.id);
      await sale({
        storeId: w.storeB.id,
        storeProductId: sp.id,
        at: '2026-10-14T10:00:00Z',
        price: 55,
      });
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.store.update({
          where: { id: w.storeB.id },
          data: { deletedAt: new Date() },
        }),
      );

      const d = await dashboard.forCompany(w.company.id, NOW);
      expect(d.today.revenue).toBe(0);
      expect(d.byStore!.map((s) => s.storeId)).toEqual([w.storeA.id]);
    });

    it('empresa sem lojas devolve o painel vazio', async () => {
      const lonely = await ctx.factory.world();
      await ctx.audit.runAsSystem('seed', async () => {
        await ctx.prisma.store.update({
          where: { id: lonely.storeA.id },
          data: { deletedAt: new Date() },
        });
        await ctx.prisma.store.update({
          where: { id: lonely.storeB.id },
          data: { deletedAt: new Date() },
        });
      });
      const d = await dashboard.forCompany(lonely.company.id, NOW);
      expect(d).toMatchObject({
        today: { revenue: 0 },
        topProducts: [],
        chart: [],
        debt: 0,
        byStore: [],
      });
    });
  });
});
