import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { CashRegisterService } from './cash-register.service';

describe('CashRegisterService', () => {
  let ctx: ServiceTestContext;
  let cash: CashRegisterService;
  let w: World;

  beforeAll(async () => {
    ctx = await createServiceTest([CashRegisterService]);
    cash = ctx.module.get(CashRegisterService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>, endpoint = 'POST /api/teste') =>
    ctx.asRequest(fn, { userId: w.owner.id, endpoint });
  const page = { page: 1, limit: 20 };

  const addSale = (cashRegisterId: string, amount: number) =>
    ctx.audit.runAsSystem('seed', () =>
      ctx.prisma.cashMovement.create({
        data: { cashRegisterId, type: 'SALE', amount },
      }),
    );

  describe('abertura', () => {
    it('abre o caixa com o saldo inicial', async () => {
      const register = await as(() => cash.open(w.storeA.id, 150));
      expect(register).toMatchObject({
        storeId: w.storeA.id,
        initialBalance: 150,
        status: 'OPEN',
        closedAt: null,
      });
    });

    it('só um caixa aberto por loja, mas lojas diferentes têm caixas independentes', async () => {
      await as(() => cash.open(w.storeA.id, 0));
      await expect(as(() => cash.open(w.storeA.id, 0))).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(as(() => cash.open(w.storeB.id, 0))).resolves.toBeTruthy();
    });

    it('aberturas simultâneas na mesma loja: só uma vence', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => as(() => cash.open(w.storeA.id, 0))),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        await ctx.prisma.cashRegister.count({
          where: { storeId: w.storeA.id, status: 'OPEN' },
        }),
      ).toBe(1);
    });

    it('depois de fechar, pode abrir outro', async () => {
      await as(() => cash.open(w.storeA.id, 0));
      await as(() => cash.close(w.storeA.id));
      await expect(as(() => cash.open(w.storeA.id, 10))).resolves.toMatchObject(
        { initialBalance: 10 },
      );
    });
  });

  describe('saldo e movimentações', () => {
    it('current é null sem caixa aberto', async () => {
      expect(await cash.current(w.storeA.id)).toBeNull();
    });

    it('saldo = inicial + entradas + vendas − saídas', async () => {
      const register = await as(() => cash.open(w.storeA.id, 100));
      await as(() =>
        cash.addMovement(w.storeA.id, {
          type: 'IN',
          amount: 50,
          description: 'Reforço',
        }),
      );
      await addSale(register.id, 30);
      await as(() =>
        cash.addMovement(w.storeA.id, {
          type: 'OUT',
          amount: 20,
          description: 'Sangria',
        }),
      );

      const current = await cash.current(w.storeA.id);
      expect(current!.currentBalance).toBe(160);
      expect(current!.movements).toHaveLength(3);
    });

    it('não acumula erro de ponto flutuante nos centavos', async () => {
      await as(() => cash.open(w.storeA.id, 0));
      await as(() =>
        cash.addMovement(w.storeA.id, { type: 'IN', amount: 0.1 }),
      );
      await as(() =>
        cash.addMovement(w.storeA.id, { type: 'IN', amount: 0.2 }),
      );
      expect((await cash.current(w.storeA.id))!.currentBalance).toBe(0.3);
    });

    it('a saída não pode deixar o saldo negativo, mas pode zerá-lo', async () => {
      await as(() => cash.open(w.storeA.id, 100));
      await expect(
        as(() =>
          cash.addMovement(w.storeA.id, { type: 'OUT', amount: 100.01 }),
        ),
      ).rejects.toThrow(/Saldo insuficiente/);
      await expect(
        as(() => cash.addMovement(w.storeA.id, { type: 'OUT', amount: 100 })),
      ).resolves.toBeTruthy();
      expect((await cash.current(w.storeA.id))!.currentBalance).toBe(0);
    });

    it('saídas simultâneas nunca estouram o saldo', async () => {
      await as(() => cash.open(w.storeA.id, 100));
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          as(() => cash.addMovement(w.storeA.id, { type: 'OUT', amount: 40 })),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect((await cash.current(w.storeA.id))!.currentBalance).toBe(20);
    });

    it('exige caixa aberto para movimentar', async () => {
      await expect(
        as(() => cash.addMovement(w.storeA.id, { type: 'IN', amount: 10 })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('cada loja tem o seu saldo', async () => {
      await as(() => cash.open(w.storeA.id, 100));
      await as(() => cash.open(w.storeB.id, 7));
      await as(() => cash.addMovement(w.storeA.id, { type: 'IN', amount: 1 }));
      expect((await cash.current(w.storeA.id))!.currentBalance).toBe(101);
      expect((await cash.current(w.storeB.id))!.currentBalance).toBe(7);
    });

    it('registra autor e rota de cada movimento', async () => {
      await as(() => cash.open(w.storeA.id, 0));
      await as(
        () => cash.addMovement(w.storeA.id, { type: 'IN', amount: 5 }),
        'POST /api/stores/:storeId/cash-register/movements',
      );
      const movement = await ctx.prisma.cashMovement.findFirstOrThrow();
      expect(movement).toMatchObject({
        modifierId: w.owner.id,
        modifiedEndpoint: 'POST /api/stores/:storeId/cash-register/movements',
      });
    });
  });

  describe('fechamento', () => {
    it('grava o saldo final e devolve o resumo das vendas por forma de pagamento', async () => {
      const register = await as(() => cash.open(w.storeA.id, 100));
      await addSale(register.id, 30);
      await ctx.audit.runAsSystem('seed', async () => {
        await ctx.prisma.sale.create({
          data: { storeId: w.storeA.id, total: 20, paymentMethod: 'PIX' },
        });
        await ctx.prisma.sale.create({
          data: { storeId: w.storeA.id, total: 10, paymentMethod: 'PIX' },
        });
        await ctx.prisma.sale.create({
          data: { storeId: w.storeA.id, total: 5, paymentMethod: 'MONEY' },
        });
        // cancelada e de outra loja não entram no resumo
        await ctx.prisma.sale.create({
          data: {
            storeId: w.storeA.id,
            total: 99,
            paymentMethod: 'MONEY',
            status: 'CANCELED',
          },
        });
        await ctx.prisma.sale.create({
          data: { storeId: w.storeB.id, total: 500, paymentMethod: 'MONEY' },
        });
      });

      const result = await as(() => cash.close(w.storeA.id));
      expect(result.register).toMatchObject({
        status: 'CLOSED',
        finalBalance: 130,
      });
      expect(result.register.closedAt).toBeInstanceOf(Date);
      expect(result.summary).toEqual([
        { paymentMethod: 'MONEY', count: 1, total: 5 },
        { paymentMethod: 'PIX', count: 2, total: 30 },
      ]);
    });

    it('não fecha sem caixa aberto nem fecha duas vezes', async () => {
      await expect(as(() => cash.close(w.storeA.id))).rejects.toBeInstanceOf(
        ConflictException,
      );
      await as(() => cash.open(w.storeA.id, 0));
      await as(() => cash.close(w.storeA.id));
      await expect(as(() => cash.close(w.storeA.id))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('depois de fechado não aceita movimentação', async () => {
      await as(() => cash.open(w.storeA.id, 0));
      await as(() => cash.close(w.storeA.id));
      await expect(
        as(() => cash.addMovement(w.storeA.id, { type: 'IN', amount: 1 })),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('histórico', () => {
    it('lista só os caixas fechados da loja, do mais recente para o mais antigo, paginado', async () => {
      for (const initial of [1, 2, 3]) {
        await as(() => cash.open(w.storeA.id, initial));
        await as(() => cash.close(w.storeA.id));
      }
      await as(() => cash.open(w.storeA.id, 99)); // aberto: não entra
      await as(() => cash.open(w.storeB.id, 50));
      await as(() => cash.close(w.storeB.id)); // outra loja: não entra

      const history = await cash.history(w.storeA.id, page);
      expect(history.data.map((r) => r.initialBalance)).toEqual([3, 2, 1]);
      expect(history.meta.totalItems).toBe(3);
      expect(
        (await cash.history(w.storeA.id, { page: 2, limit: 2 })).data,
      ).toHaveLength(1);
    });

    it('detalhe de um caixa traz movimentos e resumo, e não vaza caixa de outra loja', async () => {
      const register = await as(() => cash.open(w.storeA.id, 10));
      await as(() => cash.addMovement(w.storeA.id, { type: 'IN', amount: 5 }));
      const detail = await cash.get(w.storeA.id, register.id);
      expect(detail.currentBalance).toBe(15);
      expect(detail.movements).toHaveLength(1);
      await expect(cash.get(w.storeB.id, register.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
