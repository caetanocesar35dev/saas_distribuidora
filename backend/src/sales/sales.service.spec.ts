import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { Role } from '@prisma/client';
import { World } from '../../test/helpers/factory';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let ctx: ServiceTestContext;
  let sales: SalesService;
  let w: World;
  let beer: { id: string }; // Cerveja R$10 (custo 6), estoque 100, SEM vasilhame
  let crate: { id: string }; // Engradado R$50 (custo 30), estoque 20, COM vasilhame
  let litrao: { id: string };

  beforeAll(async () => {
    ctx = await createServiceTest([SalesService]);
    sales = ctx.module.get(SalesService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
    litrao = await ctx.factory.bottleType(w.company.id, 'Litrão');
    beer = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
      name: 'Cerveja',
      price: 10,
      costPrice: 6,
      stock: 100,
    });
    crate = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
      name: 'Engradado',
      price: 50,
      costPrice: 30,
      stock: 20,
      bottleTypeId: litrao.id,
    });
    await ctx.factory.openCash(w.storeA.id, 100);
  });
  afterAll(() => ctx.close());

  const sell = (
    dto: Partial<Parameters<SalesService['create']>[3]> & {
      items: { storeProductId: string; quantity: number; packs?: number }[];
    },
    storeId = w.storeA.id,
    role: Role = 'OWNER',
  ) =>
    ctx.asRequest(
      () =>
        sales.create(
          storeId,
          w.company.id,
          w.owner.id,
          { paymentMethod: 'MONEY', ...dto },
          role,
        ),
      { userId: w.owner.id, endpoint: 'POST /api/stores/:storeId/sales' },
    );
  const cancel = (id: string, storeId = w.storeA.id) =>
    ctx.asRequest(() => sales.cancel(storeId, id), {
      userId: w.owner.id,
      endpoint: 'POST /api/stores/:storeId/sales/:id/cancel',
    });

  const stockOf = async (id: string) =>
    (await ctx.prisma.storeProduct.findUniqueOrThrow({ where: { id } })).stock;
  const bottleStock = async (storeId = w.storeA.id) =>
    (
      await ctx.prisma.storeBottleType.findUnique({
        where: { storeId_bottleTypeId: { storeId, bottleTypeId: litrao.id } },
      })
    )?.stock;
  const bottleDebt = async (customerId: string, storeId = w.storeA.id) =>
    (
      await ctx.prisma.customerStoreBottleBalance.findUnique({
        where: {
          customerId_storeId_bottleTypeId: {
            customerId,
            storeId,
            bottleTypeId: litrao.id,
          },
        },
      })
    )?.balance;
  const fiado = async (customerId: string, storeId = w.storeA.id) =>
    (
      await ctx.prisma.customerStoreBalance.findUnique({
        where: { customerId_storeId: { customerId, storeId } },
      })
    )?.balance;
  const cashBalance = async () => {
    const rows = await ctx.prisma.cashMovement.findMany();
    return (
      100 +
      rows.reduce((s, m) => s + (m.type === 'OUT' ? -m.amount : m.amount), 0)
    );
  };

  describe('venda à vista', () => {
    it('grava a venda e os itens, baixa o estoque e registra a entrada no caixa', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 3 }],
      });

      expect(sale).toMatchObject({
        total: 30,
        totalCost: 18,
        discount: 0,
        status: 'COMPLETED',
        paymentMethod: 'MONEY',
        userId: w.owner.id,
      });
      expect(sale.items).toHaveLength(1);
      expect(sale.items[0]).toMatchObject({
        quantity: 3,
        price: 10,
        costPrice: 6,
      });
      expect(sale.items[0].storeProduct.product.name).toBe('Cerveja');
      expect(await stockOf(beer.id)).toBe(97);

      const movement = await ctx.prisma.cashMovement.findFirstOrThrow();
      expect(movement).toMatchObject({ type: 'SALE', amount: 30 });
      expect(await cashBalance()).toBe(130);
    });

    it('usa SEMPRE o preço e o custo do banco', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { price: 12.5, costPrice: 7.25 },
        }),
      );
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 2 }],
      });
      expect(sale.total).toBe(25);
      expect(sale.totalCost).toBe(14.5);
      // linhas com preço/custo informados só existem no caminho interno (comanda); a venda comum nunca os aceita
      expect(Object.keys(sale.items[0])).not.toContain('priceFromClient');
    });

    it('soma itens repetidos numa linha só', async () => {
      const sale = await sell({
        items: [
          { storeProductId: beer.id, quantity: 2 },
          { storeProductId: beer.id, quantity: 3 },
        ],
      });
      expect(sale.items).toHaveLength(1);
      expect(sale.items[0].quantity).toBe(5);
      expect(await stockOf(beer.id)).toBe(95);
    });

    it('aplica desconto e arredonda em centavos', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { price: 3.33 },
        }),
      );
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 3 }],
        discount: 0.99,
      });
      expect(sale.total).toBe(9); // 9,99 - 0,99
      expect(sale.discount).toBe(0.99);
    });

    it('desconto igual ao total é aceito (venda de R$ 0) e maior que o total é recusado sem gravar nada', async () => {
      const free = await sell({
        items: [{ storeProductId: beer.id, quantity: 1 }],
        discount: 10,
      });
      expect(free.total).toBe(0);
      expect(await ctx.prisma.cashMovement.count()).toBe(0); // sem dinheiro, sem movimento

      await expect(
        sell({
          items: [{ storeProductId: beer.id, quantity: 1 }],
          discount: 10.01,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await stockOf(beer.id)).toBe(99); // só a venda de R$ 0 baixou
      expect(await ctx.prisma.sale.count()).toBe(1);
    });

    it('PIX e cartão também entram no caixa como SALE (o movimento não guarda a forma)', async () => {
      await sell({
        paymentMethod: 'PIX',
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      await sell({
        paymentMethod: 'CREDIT',
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      expect(
        (await ctx.prisma.cashMovement.findMany()).map((m) => m.type),
      ).toEqual(['SALE', 'SALE']);
    });

    it('exige caixa aberto na PRÓPRIA loja', async () => {
      const other = await ctx.factory.storeProduct(w.storeB.id, w.company.id);
      await expect(
        sell(
          { items: [{ storeProductId: other.id, quantity: 1 }] },
          w.storeB.id,
        ),
      ).rejects.toThrow(/caixa aberto/);
      expect(await stockOf(other.id)).toBe(100);
    });

    it('registra autor e rota na venda, nos itens e no estoque', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      const row = await ctx.prisma.sale.findUniqueOrThrow({
        where: { id: sale.id },
      });
      expect(row).toMatchObject({
        modifierId: w.owner.id,
        modifiedEndpoint: 'POST /api/stores/:storeId/sales',
      });
      const history = await ctx.prisma.storeProductHistory.findMany({
        where: { id: beer.id },
        orderBy: { historyStart: 'asc' },
      });
      expect(history[history.length - 1]).toMatchObject({
        stock: 99,
        modifiedEndpoint: 'POST /api/stores/:storeId/sales',
      });
    });
  });

  describe('produtos e estoque', () => {
    it('estoque insuficiente: 409 com o nome do produto e NADA é gravado (nem a baixa dos outros itens)', async () => {
      await expect(
        sell({
          items: [
            { storeProductId: beer.id, quantity: 10 },
            { storeProductId: crate.id, quantity: 21 },
          ],
        }),
      ).rejects.toThrow(/Estoque insuficiente para o produto "Engradado"/);

      expect(await stockOf(beer.id)).toBe(100);
      expect(await stockOf(crate.id)).toBe(20);
      expect(await ctx.prisma.sale.count()).toBe(0);
      expect(await ctx.prisma.cashMovement.count()).toBe(0);
    });

    it('pode vender exatamente o que há em estoque', async () => {
      await sell({
        items: [{ storeProductId: crate.id, quantity: 20 }],
        customerId: (await ctx.factory.customer(w.company.id)).id,
      });
      expect(await stockOf(crate.id)).toBe(0);
    });

    it('duas vendas simultâneas da última unidade: uma passa e a outra recebe 409', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { stock: 1 },
        }),
      );
      const results = await Promise.allSettled([
        sell({ items: [{ storeProductId: beer.id, quantity: 1 }] }),
        sell({ items: [{ storeProductId: beer.id, quantity: 1 }] }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find(
        (r) => r.status === 'rejected',
      ) as PromiseRejectedResult;
      expect(failed.reason).toBeInstanceOf(ConflictException);
      expect(await stockOf(beer.id)).toBe(0);
      expect(await ctx.prisma.sale.count()).toBe(1);
    });

    it('muitas vendas simultâneas nunca deixam o estoque negativo', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { stock: 5 },
        }),
      );
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
          sell({ items: [{ storeProductId: beer.id, quantity: 1 }] }),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
      expect(await stockOf(beer.id)).toBe(0);
    });

    it('vendas simultâneas com os mesmos produtos em ordem diferente não dão deadlock', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) =>
          sell({
            items:
              i % 2 === 0
                ? [
                    { storeProductId: beer.id, quantity: 1 },
                    { storeProductId: crate.id, quantity: 1 },
                  ]
                : [
                    { storeProductId: crate.id, quantity: 1 },
                    { storeProductId: beer.id, quantity: 1 },
                  ],
            customerId: undefined,
            bottleReturns: [{ bottleTypeId: litrao.id, quantity: 1 }],
          }),
        ),
      );
      // sem cliente e com devolução igual ao que levou (1 = 1), todas devem passar
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(8);
      expect(await stockOf(beer.id)).toBe(92);
      expect(await stockOf(crate.id)).toBe(12);
    });

    it('produto inativo, de outra loja ou inexistente: 404', async () => {
      const inactive = await ctx.factory.storeProduct(
        w.storeA.id,
        w.company.id,
        { isActive: false },
      );
      const otherStore = await ctx.factory.storeProduct(
        w.storeB.id,
        w.company.id,
      );
      for (const id of [inactive.id, otherStore.id, 'nao-existe']) {
        await expect(
          sell({ items: [{ storeProductId: id, quantity: 1 }] }),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      expect(await ctx.prisma.sale.count()).toBe(0);
    });

    it('produto excluído do catálogo não pode ser vendido', async () => {
      await ctx.audit.runAsSystem('seed', async () => {
        const sp = await ctx.prisma.storeProduct.findUniqueOrThrow({
          where: { id: beer.id },
        });
        await ctx.prisma.product.update({
          where: { id: sp.productId },
          data: { deletedAt: new Date() },
        });
      });
      await expect(
        sell({ items: [{ storeProductId: beer.id, quantity: 1 }] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('venda em lote (fardos)', () => {
    let fardo: { id: string };
    beforeEach(async () => {
      // Fardo de 12 litrões: unidade R$ 5, cada unidade leva 1 vasilhame
      fardo = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
        name: 'Litrão',
        price: 5,
        costPrice: 3,
        stock: 100,
        packQuantity: 12,
        bottleTypeId: litrao.id,
      });
    });

    it('2 fardos + 3 unidades = 27 unidades: preço, estoque, vasilhames e o item guarda os fardos', async () => {
      const sale = await sell({
        items: [{ storeProductId: fardo.id, quantity: 3, packs: 2 }],
        bottleReturns: [{ bottleTypeId: litrao.id, quantity: 27 }],
      });
      expect(sale.total).toBe(135); // 27 × R$ 5 (preço do fardo = unidade × 12)
      expect(sale.items).toEqual([
        expect.objectContaining({ quantity: 27, packs: 2, packSize: 12 }),
      ]);
      const stock = await ctx.prisma.storeProduct.findUniqueOrThrow({
        where: { id: fardo.id },
      });
      expect(stock.stock).toBe(73);
      const borrowed = await ctx.prisma.bottleMovement.findFirstOrThrow({
        where: { saleId: sale.id, type: 'CUSTOMER_BORROW' },
      });
      expect(borrowed.quantity).toBe(-27);
    });

    it('junta linhas repetidas do mesmo produto somando fardos e unidades', async () => {
      const sale = await sell({
        items: [
          { storeProductId: fardo.id, quantity: 2, packs: 1 },
          { storeProductId: fardo.id, quantity: 0, packs: 1 },
        ],
        bottleReturns: [{ bottleTypeId: litrao.id, quantity: 26 }],
      });
      expect(sale.items).toEqual([
        expect.objectContaining({ quantity: 26, packs: 2, packSize: 12 }),
      ]);
    });

    it('venda só por unidade continua igual (sem fardos)', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 2 }],
      });
      expect(sale.items).toEqual([
        expect.objectContaining({ quantity: 2, packs: 0, packSize: null }),
      ]);
    });

    it('recusa fardo de produto sem tamanho de fardo e quantidade zerada', async () => {
      await expect(
        sell({ items: [{ storeProductId: beer.id, quantity: 0, packs: 1 }] }),
      ).rejects.toThrow(/não é vendido em fardo/);
      await expect(
        sell({ items: [{ storeProductId: fardo.id, quantity: 0, packs: 0 }] }),
      ).rejects.toThrow(/deve ser maior que zero/);
    });

    it('estoque insuficiente conta os fardos em unidades', async () => {
      await expect(
        sell({ items: [{ storeProductId: fardo.id, quantity: 0, packs: 9 }] }),
      ).rejects.toThrow(/Disponível: 100, solicitado: 108/);
    });
  });

  describe('venda antiga lançada depois', () => {
    const late = (
      soldAt: string,
      dto: Partial<Parameters<SalesService['createLate']>[3]> = {},
    ) =>
      ctx.asRequest(
        () =>
          sales.createLate(
            w.storeA.id,
            w.company.id,
            w.owner.id,
            {
              paymentMethod: 'MONEY',
              items: [{ storeProductId: beer.id, quantity: 2 }],
              soldAt,
              ...dto,
            },
            'MANAGER',
          ),
        {
          userId: w.owner.id,
          endpoint: 'POST /api/stores/:storeId/sales/late',
        },
      );

    it('fica com a data em que aconteceu, marca quando foi lançada e o dinheiro entra no caixa aberto agora', async () => {
      const before = Date.now();
      const sale = await late('2026-03-10T15:30:00.000Z');
      expect(sale.createdAt.toISOString()).toBe('2026-03-10T15:30:00.000Z');
      expect(sale.registeredAt!.getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
      expect(sale.total).toBe(20);

      const stock = await ctx.prisma.storeProduct.findUniqueOrThrow({
        where: { id: beer.id },
      });
      expect(stock.stock).toBe(98);

      const movement = await ctx.prisma.cashMovement.findFirstOrThrow({
        where: { type: 'SALE' },
      });
      expect(movement.amount).toBe(20);
      expect(movement.description).toMatch(
        /^Venda #\w+ lançada depois \(de 10\/03\/2026 12:30\)$/,
      );

      // aparece no dia em que aconteceu
      const day = await sales.list(w.storeA.id, {
        page: 1,
        limit: 20,
        startDate: '2026-03-10',
        endDate: '2026-03-10',
      });
      expect(day.data.map((s) => s.id)).toEqual([sale.id]);
    });

    it('venda normal não tem registeredAt', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      expect(sale.registeredAt).toBeNull();
    });

    it('recusa data no futuro; sem limite para trás', async () => {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      await expect(late(tomorrow)).rejects.toThrow(
        'A data da venda não pode ser no futuro.',
      );
      const old = await late('2020-01-01T12:00:00.000Z');
      expect(old.createdAt.getUTCFullYear()).toBe(2020);
    });

    it('no fiado soma na dívida e não mexe no caixa', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await late('2026-03-10T15:30:00.000Z', {
        paymentMethod: 'CREDIT_STORE',
        customerId: customer.id,
      });
      expect(await fiado(customer.id)).toBe(20);
      expect(await ctx.prisma.cashMovement.count()).toBe(0);
    });
  });

  describe('venda a prazo (fiado)', () => {
    it('aumenta a dívida do cliente NA LOJA da venda e não mexe no caixa', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.factory.debt(customer.id, w.storeA.id, 20);

      await sell({
        paymentMethod: 'CREDIT_STORE',
        customerId: customer.id,
        items: [{ storeProductId: beer.id, quantity: 4 }],
      });
      expect(await fiado(customer.id)).toBe(60);
      expect(await fiado(customer.id, w.storeB.id)).toBeUndefined();
      expect(await ctx.prisma.cashMovement.count()).toBe(0);
    });

    it('limite de crédito: soma todas as lojas; atendente é barrado e gerente/dono confirmam', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.customer.update({
          where: { id: customer.id },
          data: { creditLimit: 50 },
        }),
      );
      await ctx.factory.debt(customer.id, w.storeA.id, 25);
      await ctx.factory.debt(customer.id, w.storeB.id, 15); // outra loja também conta
      const fiadoSale = (
        role: Role,
        extra: { allowOverCreditLimit?: boolean } = {},
      ) =>
        sell(
          {
            paymentMethod: 'CREDIT_STORE',
            customerId: customer.id,
            items: [{ storeProductId: beer.id, quantity: 1 }], // R$ 10
            ...extra,
          },
          w.storeA.id,
          role,
        );

      // 40 + 10 = 50: chega exatamente ao limite, passa
      await fiadoSale('EMPLOYEE');
      expect(await fiado(customer.id)).toBe(35);

      // 50 + 10 = 60: atendente barrado, mesmo pedindo para passar
      await expect(
        fiadoSale('EMPLOYEE', { allowOverCreditLimit: true }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // gerente sem confirmar: aviso (409) com os valores
      await expect(fiadoSale('MANAGER')).rejects.toThrow(
        /limite de crédito do cliente é R\$ 50,00; ele deve R\$ 50,00 e, com esta venda, passaria a dever R\$ 60,00/,
      );
      await expect(fiadoSale('MANAGER')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(await fiado(customer.id)).toBe(35);
      expect(await ctx.prisma.sale.count()).toBe(1);

      // gerente confirmando: vende
      await fiadoSale('MANAGER', { allowOverCreditLimit: true });
      expect(await fiado(customer.id)).toBe(45);

      // venda à vista não olha o limite
      await sell(
        {
          customerId: customer.id,
          items: [{ storeProductId: beer.id, quantity: 1 }],
        },
        w.storeA.id,
        'EMPLOYEE',
      );
    });

    it('cria o saldo na primeira venda a prazo do cliente', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await sell({
        paymentMethod: 'CREDIT_STORE',
        customerId: customer.id,
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      expect(await fiado(customer.id)).toBe(10);
    });

    it('exige cliente e recusa cliente de outra empresa', async () => {
      await expect(
        sell({
          paymentMethod: 'CREDIT_STORE',
          items: [{ storeProductId: beer.id, quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const other = await ctx.factory.world();
      const foreign = await ctx.factory.customer(other.company.id);
      await expect(
        sell({
          customerId: foreign.id,
          items: [{ storeProductId: beer.id, quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await stockOf(beer.id)).toBe(100);
    });

    it('vendas a prazo simultâneas somam corretamente a dívida', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await Promise.all(
        Array.from({ length: 6 }, () =>
          sell({
            paymentMethod: 'CREDIT_STORE',
            customerId: customer.id,
            items: [{ storeProductId: beer.id, quantity: 1 }],
          }),
        ),
      );
      expect(await fiado(customer.id)).toBe(60);
    });
  });

  describe('vasilhames na venda', () => {
    it('produto com vasilhame: tira do estoque da loja, vira dívida do cliente e registra o movimento', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 50);

      const sale = await sell({
        customerId: customer.id,
        items: [
          { storeProductId: beer.id, quantity: 2 },
          { storeProductId: crate.id, quantity: 3 },
        ],
      });

      expect(await bottleStock()).toBe(47);
      expect(await bottleDebt(customer.id)).toBe(3);
      expect(sale.bottleMovements).toHaveLength(1);
      expect(sale.bottleMovements[0]).toMatchObject({
        type: 'CUSTOMER_BORROW',
        quantity: -3,
        bottleTypeId: litrao.id,
      });
      // a venda inteira continua numa só transação: venda, itens, estoque de produto e caixa
      expect(sale.total).toBe(170);
      expect(await stockOf(crate.id)).toBe(17);
      expect(await cashBalance()).toBe(270);
    });

    it('devolução na hora abate da dívida e volta ao estoque', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 10);
      await ctx.factory.bottleDebt(customer.id, w.storeA.id, litrao.id, 5);

      const sale = await sell({
        customerId: customer.id,
        items: [{ storeProductId: crate.id, quantity: 2 }],
        bottleReturns: [{ bottleTypeId: litrao.id, quantity: 4 }],
      });

      expect(await bottleDebt(customer.id)).toBe(3); // 5 + 2 levados - 4 devolvidos
      expect(await bottleStock()).toBe(12); // 10 - 2 + 4
      expect(
        sale.bottleMovements.map((m) => [m.type, m.quantity]).sort(),
      ).toEqual([
        ['CUSTOMER_BORROW', -2],
        ['CUSTOMER_RETURN', 4],
      ]);
    });

    it('quem sai devendo ou com crédito de vasilhame precisa estar identificado; nada é gravado', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 10);
      await expect(
        sell({ items: [{ storeProductId: crate.id, quantity: 2 }] }),
      ).rejects.toThrow(/selecionar um cliente/);
      await expect(
        sell({
          items: [{ storeProductId: beer.id, quantity: 1 }],
          bottleReturns: [{ bottleTypeId: litrao.id, quantity: 1 }],
        }),
      ).rejects.toThrow(/selecionar um cliente/);

      expect(await stockOf(crate.id)).toBe(20);
      expect(await stockOf(beer.id)).toBe(100);
      expect(await bottleStock()).toBe(10);
      expect(await ctx.prisma.sale.count()).toBe(0);
    });

    it('troca 1 por 1 sem cliente é permitida (levou e devolveu a mesma quantidade)', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 10);
      await sell({
        items: [{ storeProductId: crate.id, quantity: 2 }],
        bottleReturns: [{ bottleTypeId: litrao.id, quantity: 2 }],
      });
      expect(await bottleStock()).toBe(10);
    });

    it('o estoque de vasilhame pode ficar negativo na venda: não se barra a venda por isso', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await sell({
        customerId: customer.id,
        items: [{ storeProductId: crate.id, quantity: 2 }],
      });
      expect(await bottleStock()).toBe(-2);
      expect(await bottleDebt(customer.id)).toBe(2);
    });

    it('devolver mais do que levou deixa crédito (saldo negativo) para o cliente', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await sell({
        customerId: customer.id,
        items: [{ storeProductId: beer.id, quantity: 1 }],
        bottleReturns: [{ bottleTypeId: litrao.id, quantity: 3 }],
      });
      expect(await bottleDebt(customer.id)).toBe(-3);
    });

    it('recusa devolução de vasilhame de outra empresa', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.bottleType(other.company.id);
      await expect(
        sell({
          customerId: customer.id,
          items: [{ storeProductId: beer.id, quantity: 1 }],
          bottleReturns: [{ bottleTypeId: foreign.id, quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await ctx.prisma.sale.count()).toBe(0);
    });

    it('vasilhame por loja: a venda na loja A não mexe no estoque de vasilhame da B', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.factory.bottleStock(w.storeB.id, litrao.id, 9);
      await sell({
        customerId: customer.id,
        items: [{ storeProductId: crate.id, quantity: 1 }],
      });
      expect(await bottleStock(w.storeB.id)).toBe(9);
      expect(await bottleDebt(customer.id, w.storeB.id)).toBeUndefined();
    });
  });

  describe('consulta', () => {
    it('get devolve a venda completa e não a vê de outra loja', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      expect((await sales.get(w.storeA.id, sale.id)).id).toBe(sale.id);
      await expect(sales.get(w.storeB.id, sale.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lista com filtros e traz receita e lucro só das vendas concluídas', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      const s1 = await sell({
        items: [{ storeProductId: beer.id, quantity: 2 }],
      }); // 20, custo 12
      await sell({
        paymentMethod: 'PIX',
        items: [{ storeProductId: beer.id, quantity: 1 }],
      }); // 10, custo 6
      const s3 = await sell({
        paymentMethod: 'CREDIT_STORE',
        customerId: customer.id,
        items: [{ storeProductId: beer.id, quantity: 5 }],
      }); // 50, custo 30
      await cancel(s3.id);

      const all = await sales.list(w.storeA.id, { page: 1, limit: 20 });
      expect(all.meta).toMatchObject({
        totalItems: 3,
        totalRevenue: 30,
        totalProfit: 12,
      }); // cancelada fora
      expect(all.data.map((s) => s.id)).toContain(s1.id);

      expect(
        (
          await sales.list(w.storeA.id, {
            page: 1,
            limit: 20,
            paymentMethod: 'PIX',
          })
        ).data,
      ).toHaveLength(1);
      expect(
        (
          await sales.list(w.storeA.id, {
            page: 1,
            limit: 20,
            status: 'CANCELED',
          })
        ).data.map((s) => s.id),
      ).toEqual([s3.id]);
      expect(
        (
          await sales.list(w.storeA.id, {
            page: 1,
            limit: 20,
            customerId: customer.id,
          })
        ).data,
      ).toHaveLength(1);
      expect(
        (
          await sales.list(w.storeA.id, {
            page: 1,
            limit: 20,
            userId: w.owner.id,
          })
        ).meta.totalItems,
      ).toBe(3);
      expect(
        (
          await sales.list(w.storeA.id, {
            page: 1,
            limit: 20,
            search: s1.id.slice(0, 8),
          })
        ).data[0].id,
      ).toBe(s1.id);
      expect(
        (await sales.list(w.storeA.id, { page: 2, limit: 2 })).data,
      ).toHaveLength(1);
      expect(
        (await sales.list(w.storeB.id, { page: 1, limit: 20 })).meta.totalItems,
      ).toBe(0);
    });

    it('filtra por período usando o dia no fuso da aplicação (America/Sao_Paulo)', async () => {
      // 21/10 às 01:30 em São Paulo = 04:30 UTC; 22/10 às 00:30 em São Paulo = 03:30 UTC
      const make = (createdAt: string) =>
        ctx.audit.runAsSystem('seed', () =>
          ctx.prisma.sale.create({
            data: {
              storeId: w.storeA.id,
              total: 1,
              paymentMethod: 'MONEY',
              createdAt: new Date(createdAt),
            },
          }),
        );
      await make('2026-10-21T04:30:00Z');
      await make('2026-10-22T03:30:00Z');
      await make('2026-10-21T02:30:00Z'); // 20/10 23:30 em SP: ainda é dia 20

      const day21 = await sales.list(w.storeA.id, {
        page: 1,
        limit: 20,
        startDate: '2026-10-21',
        endDate: '2026-10-21',
      });
      expect(day21.meta.totalItems).toBe(1);
      const range = await sales.list(w.storeA.id, {
        page: 1,
        limit: 20,
        startDate: '2026-10-21',
        endDate: '2026-10-22',
      });
      expect(range.meta.totalItems).toBe(2);
    });
  });

  describe('cancelamento', () => {
    it('devolve o estoque, estorna o caixa e marca como cancelada', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 4 }],
      });
      expect(await cashBalance()).toBe(140);

      const canceled = await cancel(sale.id);
      expect(canceled.status).toBe('CANCELED');
      expect(await stockOf(beer.id)).toBe(100);
      expect(await cashBalance()).toBe(100); // a entrada foi estornada por uma saída
      const out = await ctx.prisma.cashMovement.findFirstOrThrow({
        where: { type: 'OUT' },
      });
      expect(out.amount).toBe(40);
      expect(out.description).toContain('Cancelamento');
    });

    it('venda a prazo: reduz a dívida do cliente e não mexe no caixa', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      const sale = await sell({
        paymentMethod: 'CREDIT_STORE',
        customerId: customer.id,
        items: [{ storeProductId: beer.id, quantity: 3 }],
      });
      await cancel(sale.id);
      expect(await fiado(customer.id)).toBe(0);
      expect(await ctx.prisma.cashMovement.count()).toBe(0);
    });

    it('venda a prazo já paga em parte NÃO pode ser cancelada: 409 e nada muda', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      const sale = await sell({
        paymentMethod: 'CREDIT_STORE',
        customerId: customer.id,
        items: [{ storeProductId: beer.id, quantity: 5 }],
      }); // 50
      await ctx.factory.debt(customer.id, w.storeA.id, -30); // o cliente pagou R$30
      await expect(cancel(sale.id)).rejects.toThrow(/já pagou parte/);

      expect((await sales.get(w.storeA.id, sale.id)).status).toBe('COMPLETED');
      expect(await stockOf(beer.id)).toBe(95);
      expect(await fiado(customer.id)).toBe(20);
    });

    it('vasilhames: movimentos COMPENSATÓRIOS (os originais ficam) e saldos de volta ao que eram', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 10);
      await ctx.factory.bottleDebt(customer.id, w.storeA.id, litrao.id, 5);
      const sale = await sell({
        customerId: customer.id,
        items: [{ storeProductId: crate.id, quantity: 2 }],
        bottleReturns: [{ bottleTypeId: litrao.id, quantity: 4 }],
      });
      expect(await bottleDebt(customer.id)).toBe(3);
      expect(await bottleStock()).toBe(12);

      await cancel(sale.id);

      expect(await bottleDebt(customer.id)).toBe(5);
      expect(await bottleStock()).toBe(10);
      const movements = await ctx.prisma.bottleMovement.findMany({
        where: { saleId: sale.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(movements).toHaveLength(4); // 2 originais + 2 estornos
      expect(
        movements.filter((m) => m.description?.startsWith('Estorno')),
      ).toHaveLength(2);
      // os originais continuam lá, intactos
      expect(
        movements.some(
          (m) =>
            m.type === 'CUSTOMER_BORROW' &&
            m.quantity === -2 &&
            !m.description?.startsWith('Estorno'),
        ),
      ).toBe(true);
      expect(movements.reduce((sum, m) => sum + m.quantity, 0)).toBe(0); // somam zero: estoque líquido inalterado
    });

    it('não cancela duas vezes, nem venda de outra loja, nem sem caixa aberto', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      await cancel(sale.id);
      await expect(cancel(sale.id)).rejects.toThrow(/já está cancelada/);
      expect(await stockOf(beer.id)).toBe(100); // estoque devolvido uma vez só

      const second = await sell({
        items: [{ storeProductId: beer.id, quantity: 1 }],
      });
      await expect(cancel(second.id, w.storeB.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.cashRegister.updateMany({
          where: { storeId: w.storeA.id },
          data: { status: 'CLOSED' },
        }),
      );
      await expect(cancel(second.id)).rejects.toThrow(
        /caixa precisa estar aberto/,
      );
      expect((await sales.get(w.storeA.id, second.id)).status).toBe(
        'COMPLETED',
      );
    });

    it('dois cancelamentos simultâneos: só um vence e o estoque volta uma vez só', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 10 }],
      });
      const results = await Promise.allSettled([
        cancel(sale.id),
        cancel(sale.id),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await stockOf(beer.id)).toBe(100);
      expect(
        await ctx.prisma.cashMovement.count({ where: { type: 'OUT' } }),
      ).toBe(1);
    });

    it('devolve o estoque mesmo se a oferta do produto foi removida da loja depois', async () => {
      const sale = await sell({
        items: [{ storeProductId: beer.id, quantity: 5 }],
      });
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { deletedAt: new Date() },
        }),
      );
      await cancel(sale.id);
      const row = await ctx.audit.withDeleted(() =>
        ctx.prisma.storeProduct.findUniqueOrThrow({ where: { id: beer.id } }),
      );
      expect(row.stock).toBe(100);
    });
  });
});
