import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { CommandTabsService } from './command-tabs.service';
import { SalesService } from './sales.service';

describe('CommandTabsService', () => {
  let ctx: ServiceTestContext;
  let tabs: CommandTabsService;
  let sales: SalesService;
  let w: World;
  let beer: { id: string };
  let crate: { id: string };
  let litrao: { id: string };

  beforeAll(async () => {
    ctx = await createServiceTest([CommandTabsService, SalesService]);
    tabs = ctx.module.get(CommandTabsService);
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
      stock: 50,
    });
    crate = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
      name: 'Engradado',
      price: 50,
      costPrice: 30,
      stock: 10,
      bottleTypeId: litrao.id,
    });
    await ctx.factory.openCash(w.storeA.id, 0);
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>, endpoint = 'POST /api/teste') =>
    ctx.asRequest(fn, { userId: w.owner.id, endpoint });
  const open = (name = 'Mesa 1', customerId?: string) =>
    as(() => tabs.create(w.storeA.id, w.company.id, { name, customerId }));
  const add = (tabId: string, storeProductId: string, quantity: number) =>
    as(() => tabs.addItem(w.storeA.id, tabId, { storeProductId, quantity }));
  const close = (
    tabId: string,
    over: Partial<Parameters<CommandTabsService['close']>[4]> = {},
  ) =>
    as(
      () =>
        tabs.close(
          w.storeA.id,
          w.company.id,
          w.owner.id,
          tabId,
          { paymentMethod: 'MONEY', ...over },
          'OWNER',
        ),
      'POST /api/stores/:storeId/command-tabs/:id/close',
    );
  const stockOf = async (id: string) =>
    (await ctx.prisma.storeProduct.findUniqueOrThrow({ where: { id } })).stock;

  describe('abrir e consultar', () => {
    it('cria comanda vazia, com ou sem cliente', async () => {
      const customer = await ctx.factory.customer(w.company.id, 'Zé');
      const a = await open('Mesa 1');
      const b = await open('Balcão', customer.id);
      expect(a).toMatchObject({
        name: 'Mesa 1',
        status: 'OPEN',
        total: 0,
        items: [],
        customer: null,
      });
      expect(b.customer).toMatchObject({ name: 'Zé' });
    });

    it('recusa cliente de outra empresa', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.customer(other.company.id);
      await expect(open('X', foreign.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lista só as abertas por padrão, só da loja, e filtra por status', async () => {
      const a = await open('A');
      const b = await open('B');
      await add(b.id, beer.id, 1);
      await close(b.id);
      await as(() =>
        tabs.create(w.storeB.id, w.company.id, { name: 'Outra loja' }),
      );

      expect((await tabs.list(w.storeA.id)).map((t) => t.id)).toEqual([a.id]);
      expect((await tabs.list(w.storeA.id, 'CLOSED')).map((t) => t.id)).toEqual(
        [b.id],
      );
    });

    it('não enxerga comanda de outra loja', async () => {
      const tab = await open();
      await expect(tabs.get(w.storeB.id, tab.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('itens', () => {
    it('adicionar baixa o estoque na hora e usa o preço do banco; o total parcial acompanha', async () => {
      const tab = await open();
      const item = await add(tab.id, beer.id, 3);
      expect(item).toMatchObject({ quantity: 3, price: 10, costPrice: 6 });
      expect(await stockOf(beer.id)).toBe(47);

      await add(tab.id, crate.id, 1);
      const full = await tabs.get(w.storeA.id, tab.id);
      expect(full.items).toHaveLength(2);
      expect(full.total).toBe(80);
    });

    it('estoque insuficiente: 409 com o nome do produto e nada muda', async () => {
      const tab = await open();
      await expect(add(tab.id, crate.id, 11)).rejects.toThrow(
        /Estoque insuficiente para o produto "Engradado"/,
      );
      expect(await stockOf(crate.id)).toBe(10);
      expect((await tabs.get(w.storeA.id, tab.id)).items).toHaveLength(0);
    });

    it('produto inativo ou de outra loja: 404', async () => {
      const inactive = await ctx.factory.storeProduct(
        w.storeA.id,
        w.company.id,
        { isActive: false },
      );
      const otherStore = await ctx.factory.storeProduct(
        w.storeB.id,
        w.company.id,
      );
      const tab = await open();
      await expect(add(tab.id, inactive.id, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(add(tab.id, otherStore.id, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('mudar o preço depois não altera os itens já adicionados', async () => {
      const tab = await open();
      await add(tab.id, beer.id, 2);
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { price: 99 },
        }),
      );
      await add(tab.id, beer.id, 1); // este já entra com o preço novo
      const full = await tabs.get(w.storeA.id, tab.id);
      expect(full.items.map((i) => i.price)).toEqual([10, 99]);
      expect(full.total).toBe(119);
    });

    it('remover devolve o estoque e tira o item (soft delete)', async () => {
      const tab = await open();
      const item = await add(tab.id, beer.id, 5);
      expect(await stockOf(beer.id)).toBe(45);

      await as(() => tabs.removeItem(w.storeA.id, tab.id, item.id));
      expect(await stockOf(beer.id)).toBe(50);
      expect((await tabs.get(w.storeA.id, tab.id)).items).toHaveLength(0);
      const row = await ctx.audit.withDeleted(() =>
        ctx.prisma.commandItem.findUniqueOrThrow({ where: { id: item.id } }),
      );
      expect(row.deletedAt).not.toBeNull();
    });

    it('não remove duas vezes o mesmo item nem item de outra comanda', async () => {
      const tab = await open();
      const other = await open('Outra');
      const item = await add(tab.id, beer.id, 1);
      await expect(
        as(() => tabs.removeItem(w.storeA.id, other.id, item.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
      await as(() => tabs.removeItem(w.storeA.id, tab.id, item.id));
      await expect(
        as(() => tabs.removeItem(w.storeA.id, tab.id, item.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await stockOf(beer.id)).toBe(50); // devolvido uma vez só
    });

    it('adições simultâneas do último item: só uma passa', async () => {
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { stock: 1 },
        }),
      );
      const a = await open('A');
      const b = await open('B');
      const results = await Promise.allSettled([
        add(a.id, beer.id, 1),
        add(b.id, beer.id, 1),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await stockOf(beer.id)).toBe(0);
    });
  });

  describe('fechar', () => {
    it('gera a venda com os preços da comanda, SEM baixar o estoque de novo, e fecha a comanda', async () => {
      const tab = await open();
      await add(tab.id, beer.id, 4);
      await add(tab.id, beer.id, 1);
      expect(await stockOf(beer.id)).toBe(45);

      const sale = await close(tab.id);
      expect(sale).toMatchObject({
        total: 50,
        totalCost: 30,
        status: 'COMPLETED',
        commandTabId: tab.id,
        userId: w.owner.id,
      });
      expect(sale.items.map((i) => i.quantity).sort()).toEqual([1, 4]);
      expect(await stockOf(beer.id)).toBe(45); // não baixou de novo
      expect(
        (
          await ctx.prisma.commandTab.findUniqueOrThrow({
            where: { id: tab.id },
          })
        ).status,
      ).toBe('CLOSED');
      expect(
        await ctx.prisma.cashMovement.count({ where: { type: 'SALE' } }),
      ).toBe(1);
    });

    it('usa o preço do momento em que o item foi adicionado, mesmo que o preço tenha mudado', async () => {
      const tab = await open();
      await add(tab.id, beer.id, 2);
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.storeProduct.update({
          where: { id: beer.id },
          data: { price: 99 },
        }),
      );
      const sale = await close(tab.id);
      expect(sale.total).toBe(20);
    });

    it('aplica desconto e usa o cliente da comanda (fiado)', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      const tab = await open('Fiado', customer.id);
      await add(tab.id, beer.id, 5); // 50
      const sale = await close(tab.id, {
        paymentMethod: 'CREDIT_STORE',
        discount: 5,
      });
      expect(sale).toMatchObject({ total: 45, customerId: customer.id });
      const debt = await ctx.prisma.customerStoreBalance.findFirstOrThrow({
        where: { customerId: customer.id },
      });
      expect(debt.balance).toBe(45);
    });

    it('o cliente informado ao fechar tem prioridade sobre o da comanda', async () => {
      const first = await ctx.factory.customer(w.company.id);
      const second = await ctx.factory.customer(w.company.id);
      const tab = await open('X', first.id);
      await add(tab.id, beer.id, 1);
      expect((await close(tab.id, { customerId: second.id })).customerId).toBe(
        second.id,
      );
    });

    it('produto com vasilhame: registra empréstimo e devolução como na venda comum', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      const tab = await open('V', customer.id);
      await add(tab.id, crate.id, 2);
      const sale = await close(tab.id, {
        bottleReturns: [{ bottleTypeId: litrao.id, quantity: 1 }],
      });
      expect(
        sale.bottleMovements.map((m) => [m.type, m.quantity]).sort(),
      ).toEqual([
        ['CUSTOMER_BORROW', -2],
        ['CUSTOMER_RETURN', 1],
      ]);
      const debt = await ctx.prisma.customerStoreBottleBalance.findFirstOrThrow(
        { where: { customerId: customer.id } },
      );
      expect(debt.balance).toBe(1);
    });

    it('comanda vazia: 400; comanda já fechada: 409; sem caixa aberto: 409 e a comanda continua aberta', async () => {
      const empty = await open('Vazia');
      await expect(close(empty.id)).rejects.toBeInstanceOf(BadRequestException);

      const tab = await open('Y');
      await add(tab.id, beer.id, 1);
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.cashRegister.updateMany({
          where: { storeId: w.storeA.id },
          data: { status: 'CLOSED' },
        }),
      );
      await expect(close(tab.id)).rejects.toThrow(/caixa aberto/);
      expect(
        (
          await ctx.prisma.commandTab.findUniqueOrThrow({
            where: { id: tab.id },
          })
        ).status,
      ).toBe('OPEN');
      expect(await ctx.prisma.sale.count()).toBe(0);

      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.cashRegister.updateMany({
          where: { storeId: w.storeA.id },
          data: { status: 'OPEN' },
        }),
      );
      await close(tab.id);
      await expect(close(tab.id)).rejects.toBeInstanceOf(ConflictException);
    });

    it('falha ao gerar a venda desfaz o fechamento (comanda segue aberta)', async () => {
      const tab = await open('Z'); // sem cliente
      await add(tab.id, crate.id, 1); // vasilhame sem cliente: a venda recusa
      await expect(close(tab.id)).rejects.toThrow(/selecionar um cliente/);
      expect(
        (
          await ctx.prisma.commandTab.findUniqueOrThrow({
            where: { id: tab.id },
          })
        ).status,
      ).toBe('OPEN');
      expect(await ctx.prisma.sale.count()).toBe(0);
      expect(await stockOf(crate.id)).toBe(9); // continua reservado na comanda
    });

    it('fechar e adicionar item ao mesmo tempo: nenhum item se perde nem fica fora da venda', async () => {
      const tab = await open();
      await add(tab.id, beer.id, 1);
      const results = await Promise.allSettled([
        close(tab.id),
        add(tab.id, beer.id, 1),
      ]);
      const sale = await ctx.prisma.sale.findFirstOrThrow({
        include: { items: true },
      });
      const sold = sale.items.reduce((s, i) => s + i.quantity, 0);
      const added = results[1].status === 'fulfilled' ? 1 : 0;
      expect(sold).toBe(1 + added); // o item adicionado ou entrou na venda, ou foi recusado
      expect(await stockOf(beer.id)).toBe(50 - sold);
    });

    it('uma venda nasce de uma comanda só (commandTabId único)', async () => {
      const tab = await open();
      await add(tab.id, beer.id, 1);
      const sale = await close(tab.id);
      expect((await sales.get(w.storeA.id, sale.id)).commandTabId).toBe(tab.id);
    });
  });

  describe('cancelar', () => {
    it('devolve o estoque de todos os itens e tira a comanda da lista', async () => {
      const tab = await open();
      await add(tab.id, beer.id, 5);
      await add(tab.id, crate.id, 2);
      await as(() => tabs.cancel(w.storeA.id, tab.id));

      expect(await stockOf(beer.id)).toBe(50);
      expect(await stockOf(crate.id)).toBe(10);
      expect(await tabs.list(w.storeA.id)).toHaveLength(0);
      await expect(tabs.get(w.storeA.id, tab.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('não cancela comanda já fechada, nem cancela duas vezes, e não deixa mais adicionar itens', async () => {
      const closed = await open('F');
      await add(closed.id, beer.id, 1);
      await close(closed.id);
      await expect(
        as(() => tabs.cancel(w.storeA.id, closed.id)),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(add(closed.id, beer.id, 1)).rejects.toBeInstanceOf(
        ConflictException,
      );

      const tab = await open('C');
      await add(tab.id, beer.id, 2);
      await as(() => tabs.cancel(w.storeA.id, tab.id));
      await expect(
        as(() => tabs.cancel(w.storeA.id, tab.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await stockOf(beer.id)).toBe(49); // só a venda da comanda "F"
    });

    it('cancelamentos simultâneos devolvem o estoque uma vez só', async () => {
      const tab = await open();
      await add(tab.id, beer.id, 10);
      const results = await Promise.allSettled([
        as(() => tabs.cancel(w.storeA.id, tab.id)),
        as(() => tabs.cancel(w.storeA.id, tab.id)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await stockOf(beer.id)).toBe(50);
    });
  });
});
