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
import { BottleMovementsService } from './bottle-movements.service';

describe('BottleMovementsService', () => {
  let ctx: ServiceTestContext;
  let service: BottleMovementsService;
  let w: World;
  let litrao: { id: string };

  beforeAll(async () => {
    ctx = await createServiceTest([BottleMovementsService]);
    service = ctx.module.get(BottleMovementsService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
    litrao = await ctx.factory.bottleType(w.company.id, 'Litrão');
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>, endpoint = 'POST /api/teste') =>
    ctx.asRequest(fn, { userId: w.owner.id, endpoint });
  const stockOf = async (storeId: string, bottleTypeId = litrao.id) =>
    (
      await ctx.prisma.storeBottleType.findUnique({
        where: { storeId_bottleTypeId: { storeId, bottleTypeId } },
      })
    )?.stock;

  describe('movimentações manuais', () => {
    it('recebimento do fornecedor soma ao estoque e grava quantidade positiva', async () => {
      const m = await as(() =>
        service.registerManual(w.storeA.id, w.company.id, {
          bottleTypeId: litrao.id,
          type: 'SUPPLIER_RECEIVE',
          quantity: 30,
        }),
      );
      expect(m).toMatchObject({
        quantity: 30,
        type: 'SUPPLIER_RECEIVE',
        storeId: w.storeA.id,
      });
      expect(await stockOf(w.storeA.id)).toBe(30);
    });

    it('envio ao fornecedor subtrai do estoque e grava quantidade NEGATIVA', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 50);
      const m = await as(() =>
        service.registerManual(w.storeA.id, w.company.id, {
          bottleTypeId: litrao.id,
          type: 'SUPPLIER_SEND',
          quantity: 20,
        }),
      );
      expect(m.quantity).toBe(-20);
      expect(await stockOf(w.storeA.id)).toBe(30);
    });

    it('ajuste manual aceita sinal: positivo soma, negativo subtrai', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 10);
      await as(() =>
        service.registerManual(w.storeA.id, w.company.id, {
          bottleTypeId: litrao.id,
          type: 'MANUAL_ADJUSTMENT',
          quantity: 5,
        }),
      );
      expect(await stockOf(w.storeA.id)).toBe(15);
      await as(() =>
        service.registerManual(w.storeA.id, w.company.id, {
          bottleTypeId: litrao.id,
          type: 'MANUAL_ADJUSTMENT',
          quantity: -12,
        }),
      );
      expect(await stockOf(w.storeA.id)).toBe(3);
    });

    it('nunca deixa o estoque negativo e não registra movimento quando recusa', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 5);
      await expect(
        as(() =>
          service.registerManual(w.storeA.id, w.company.id, {
            bottleTypeId: litrao.id,
            type: 'SUPPLIER_SEND',
            quantity: 6,
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        as(() =>
          service.registerManual(w.storeA.id, w.company.id, {
            bottleTypeId: litrao.id,
            type: 'MANUAL_ADJUSTMENT',
            quantity: -6,
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await stockOf(w.storeA.id)).toBe(5);
      expect(await ctx.prisma.bottleMovement.count()).toBe(0);
    });

    it('envio sem ter estoque nenhum (sem linha ainda) também é recusado', async () => {
      await expect(
        as(() =>
          service.registerManual(w.storeA.id, w.company.id, {
            bottleTypeId: litrao.id,
            type: 'SUPPLIER_SEND',
            quantity: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('envio e recebimento exigem quantidade positiva', async () => {
      await expect(
        as(() =>
          service.registerManual(w.storeA.id, w.company.id, {
            bottleTypeId: litrao.id,
            type: 'SUPPLIER_RECEIVE',
            quantity: -3,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('o estoque é por loja: mexer na A não altera a B', async () => {
      await as(() =>
        service.registerManual(w.storeA.id, w.company.id, {
          bottleTypeId: litrao.id,
          type: 'SUPPLIER_RECEIVE',
          quantity: 10,
        }),
      );
      expect(await stockOf(w.storeB.id)).toBeUndefined();
    });

    it('recusa tipo de vasilhame de outra empresa', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.bottleType(other.company.id);
      await expect(
        as(() =>
          service.registerManual(w.storeA.id, w.company.id, {
            bottleTypeId: foreign.id,
            type: 'SUPPLIER_RECEIVE',
            quantity: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retiradas simultâneas não passam do estoque', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 10);
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          as(() =>
            service.registerManual(w.storeA.id, w.company.id, {
              bottleTypeId: litrao.id,
              type: 'SUPPLIER_SEND',
              quantity: 4,
            }),
          ),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2); // 4 + 4 = 8; o terceiro passaria de 10
      expect(await stockOf(w.storeA.id)).toBe(2);
      expect(await ctx.prisma.bottleMovement.count()).toBe(2);
    });

    it('registra quem fez a movimentação', async () => {
      const m = await as(
        () =>
          service.registerManual(w.storeA.id, w.company.id, {
            bottleTypeId: litrao.id,
            type: 'SUPPLIER_RECEIVE',
            quantity: 1,
          }),
        'POST /api/stores/:storeId/bottle-movements',
      );
      const row = await ctx.prisma.bottleMovement.findUniqueOrThrow({
        where: { id: m.id },
      });
      expect(row).toMatchObject({
        modifierId: w.owner.id,
        modifiedEndpoint: 'POST /api/stores/:storeId/bottle-movements',
      });
    });
  });

  describe('empréstimo e devolução de cliente', () => {
    let customer: { id: string };
    beforeEach(async () => {
      customer = await ctx.factory.customer(w.company.id);
    });

    const balanceOf = async (storeId: string) =>
      (
        await ctx.prisma.customerStoreBottleBalance.findUnique({
          where: {
            customerId_storeId_bottleTypeId: {
              customerId: customer.id,
              storeId,
              bottleTypeId: litrao.id,
            },
          },
        })
      )?.balance;

    it('empréstimo avulso tira do estoque, aumenta a dívida do cliente e registra movimento negativo', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 20);
      const m = await as(() =>
        service.customerBorrow(w.storeA.id, w.company.id, customer.id, {
          bottleTypeId: litrao.id,
          quantity: 6,
        }),
      );
      expect(m).toMatchObject({
        type: 'CUSTOMER_BORROW',
        quantity: -6,
        customerId: customer.id,
      });
      expect(await stockOf(w.storeA.id)).toBe(14);
      expect(await balanceOf(w.storeA.id)).toBe(6);
    });

    it('empréstimo sem estoque suficiente é recusado e nada muda', async () => {
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 2);
      await expect(
        as(() =>
          service.customerBorrow(w.storeA.id, w.company.id, customer.id, {
            bottleTypeId: litrao.id,
            quantity: 3,
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await stockOf(w.storeA.id)).toBe(2);
      expect(await balanceOf(w.storeA.id)).toBeUndefined();
    });

    it('devolução na mesma loja devolve ao estoque, reduz a dívida e registra movimento positivo', async () => {
      await ctx.factory.bottleDebt(customer.id, w.storeA.id, litrao.id, 10);
      const m = await as(() =>
        service.customerReturn(w.storeA.id, w.company.id, customer.id, {
          bottleTypeId: litrao.id,
          quantity: 4,
        }),
      );
      expect(m).toMatchObject({ type: 'CUSTOMER_RETURN', quantity: 4 });
      expect(await balanceOf(w.storeA.id)).toBe(6);
      expect(await stockOf(w.storeA.id)).toBe(4);
    });

    it('REGRA DO PRODUTO: devolução só abate a dívida da própria loja', async () => {
      await ctx.factory.bottleDebt(customer.id, w.storeA.id, litrao.id, 10);
      // o cliente deve na loja A e tenta devolver na loja B
      await expect(
        as(() =>
          service.customerReturn(w.storeB.id, w.company.id, customer.id, {
            bottleTypeId: litrao.id,
            quantity: 3,
          }),
        ),
      ).rejects.toThrow(/própria loja/);
      expect(await balanceOf(w.storeA.id)).toBe(10); // dívida intacta
      expect(await stockOf(w.storeB.id)).toBeUndefined(); // nada entrou na B
      expect(await ctx.prisma.bottleMovement.count()).toBe(0);
    });

    it('não aceita devolver mais do que o cliente deve na loja', async () => {
      await ctx.factory.bottleDebt(customer.id, w.storeA.id, litrao.id, 3);
      await expect(
        as(() =>
          service.customerReturn(w.storeA.id, w.company.id, customer.id, {
            bottleTypeId: litrao.id,
            quantity: 4,
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await balanceOf(w.storeA.id)).toBe(3);
    });

    it('devoluções simultâneas não passam da dívida', async () => {
      await ctx.factory.bottleDebt(customer.id, w.storeA.id, litrao.id, 5);
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          as(() =>
            service.customerReturn(w.storeA.id, w.company.id, customer.id, {
              bottleTypeId: litrao.id,
              quantity: 2,
            }),
          ),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(await balanceOf(w.storeA.id)).toBe(1);
    });

    it('cliente de outra empresa não é aceito', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.customer(other.company.id);
      await expect(
        as(() =>
          service.customerBorrow(w.storeA.id, w.company.id, foreign.id, {
            bottleTypeId: litrao.id,
            quantity: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() =>
          service.customerReturn(w.storeA.id, w.company.id, foreign.id, {
            bottleTypeId: litrao.id,
            quantity: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('consultas', () => {
    it('lista movimentações da loja com filtros e paginação, sem misturar lojas', async () => {
      const customer = await ctx.factory.customer(w.company.id);
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 100);
      await as(() =>
        service.registerManual(w.storeA.id, w.company.id, {
          bottleTypeId: litrao.id,
          type: 'SUPPLIER_RECEIVE',
          quantity: 5,
        }),
      );
      await as(() =>
        service.customerBorrow(w.storeA.id, w.company.id, customer.id, {
          bottleTypeId: litrao.id,
          quantity: 2,
        }),
      );
      await as(() =>
        service.registerManual(w.storeB.id, w.company.id, {
          bottleTypeId: litrao.id,
          type: 'SUPPLIER_RECEIVE',
          quantity: 9,
        }),
      );

      const all = await service.list(w.storeA.id, { page: 1, limit: 20 });
      expect(all.meta.totalItems).toBe(2);
      expect(all.data.every((m) => m.storeId === w.storeA.id)).toBe(true);

      const byCustomer = await service.list(w.storeA.id, {
        page: 1,
        limit: 20,
        customerId: customer.id,
      });
      expect(byCustomer.data.map((m) => m.type)).toEqual(['CUSTOMER_BORROW']);
      const byType = await service.list(w.storeA.id, {
        page: 1,
        limit: 20,
        type: 'SUPPLIER_RECEIVE',
      });
      expect(byType.data).toHaveLength(1);
      const paged = await service.list(w.storeA.id, { page: 2, limit: 1 });
      expect(paged.data).toHaveLength(1);
    });

    it('estoque por tipo lista todos os tipos da empresa, com 0 para os sem movimento', async () => {
      const cx = await ctx.factory.bottleType(w.company.id, 'Caixa');
      await ctx.factory.bottleStock(w.storeA.id, litrao.id, 7);
      const stock = await service.stock(w.storeA.id, w.company.id);
      expect(stock).toEqual([
        { bottleTypeId: cx.id, bottleTypeName: 'Caixa', stock: 0 },
        { bottleTypeId: litrao.id, bottleTypeName: 'Litrão', stock: 7 },
      ]);
      expect(
        (await service.stock(w.storeB.id, w.company.id)).every(
          (s) => s.stock === 0,
        ),
      ).toBe(true);
    });
  });
});
