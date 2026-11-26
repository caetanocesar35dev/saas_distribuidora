import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { World } from '../../test/helpers/factory';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { BottleMovementsService } from './bottle-movements.service';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService e saldo de cascos por fornecedor', () => {
  let ctx: ServiceTestContext;
  let service: SuppliersService;
  let movements: BottleMovementsService;
  let w: World;
  let litrao: { id: string };

  beforeAll(async () => {
    ctx = await createServiceTest([SuppliersService, BottleMovementsService]);
    service = ctx.module.get(SuppliersService);
    movements = ctx.module.get(BottleMovementsService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
    litrao = await ctx.factory.bottleType(w.company.id, 'Litrão');
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>) =>
    ctx.asRequest(fn, {
      userId: w.owner.id,
      endpoint: 'POST /api/companies/:companyId/suppliers',
    });
  const move = (
    type: 'SUPPLIER_SEND' | 'SUPPLIER_RECEIVE',
    quantity: number,
    supplierId?: string,
    storeId = w.storeA.id,
  ) =>
    as(() =>
      movements.registerManual(storeId, w.company.id, {
        bottleTypeId: litrao.id,
        type,
        quantity,
        supplierId,
      }),
    );

  describe('cadastro', () => {
    it('cria, renomeia e lista por nome; nome repetido é recusado, inclusive de excluído', async () => {
      const ambev = await as(() =>
        service.create(w.company.id, { name: 'Ambev' }),
      );
      await as(() => service.create(w.company.id, { name: 'Coca-Cola FEMSA' }));
      await expect(
        as(() => service.create(w.company.id, { name: 'Ambev' })),
      ).rejects.toThrow(/Já existe um fornecedor chamado "Ambev"/);

      const renamed = await as(() =>
        service.update(w.company.id, ambev.id, { name: 'Ambev Centro' }),
      );
      expect(renamed.name).toBe('Ambev Centro');
      expect((await service.list(w.company.id)).map((s) => s.name)).toEqual([
        'Ambev Centro',
        'Coca-Cola FEMSA',
      ]);

      await as(() => service.remove(w.company.id, renamed.id));
      await expect(
        as(() => service.create(w.company.id, { name: 'Ambev Centro' })),
      ).rejects.toThrow(/está excluído/);
    });

    it('excluir tira da lista; reativar devolve', async () => {
      const s = await as(() =>
        service.create(w.company.id, { name: 'Heineken' }),
      );
      await as(() => service.remove(w.company.id, s.id));
      expect(await service.list(w.company.id)).toHaveLength(0);
      expect(
        (await service.list(w.company.id, { deleted: true })).map((x) => x.id),
      ).toEqual([s.id]);

      await as(() => service.restore(w.company.id, s.id));
      expect((await service.list(w.company.id)).map((x) => x.id)).toEqual([
        s.id,
      ]);
      await expect(
        as(() => service.restore(w.company.id, s.id)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('fornecedor de outra empresa: 404', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.supplier.create({
          data: { companyId: other.company.id, name: 'Alheio' },
        }),
      );
      await expect(
        as(() => service.update(w.company.id, foreign.id, { name: 'X' })),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        move('SUPPLIER_RECEIVE', 5, foreign.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('movimentações com fornecedor', () => {
    it('envio e recebimento gravam o fornecedor; o filtro da lista usa ele', async () => {
      const ambev = await as(() =>
        service.create(w.company.id, { name: 'Ambev' }),
      );
      const m = await move('SUPPLIER_RECEIVE', 30, ambev.id);
      expect(m).toMatchObject({
        supplierId: ambev.id,
        supplier: { id: ambev.id, name: 'Ambev' },
      });
      await move('SUPPLIER_RECEIVE', 4); // sem fornecedor continua valendo

      const filtered = await movements.list(w.storeA.id, {
        supplierId: ambev.id,
        page: 1,
        limit: 20,
      });
      expect(filtered.data.map((x) => x.id)).toEqual([m.id]);
    });

    it('o ajuste manual não aceita fornecedor', async () => {
      const ambev = await as(() =>
        service.create(w.company.id, { name: 'Ambev' }),
      );
      await expect(
        as(() =>
          movements.registerManual(w.storeA.id, w.company.id, {
            bottleTypeId: litrao.id,
            type: 'MANUAL_ADJUSTMENT',
            quantity: 3,
            supplierId: ambev.id,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('o saldo é recebidos − enviados, por fornecedor, tipo e loja', async () => {
      const ambev = await as(() =>
        service.create(w.company.id, { name: 'Ambev' }),
      );
      const coca = await as(() =>
        service.create(w.company.id, { name: 'Coca' }),
      );
      await move('SUPPLIER_RECEIVE', 30, ambev.id);
      await move('SUPPLIER_SEND', 12, ambev.id);
      await move('SUPPLIER_RECEIVE', 10, coca.id);
      await move('SUPPLIER_SEND', 10, coca.id);
      await move('SUPPLIER_RECEIVE', 99); // sem fornecedor: fica fora do saldo
      await move('SUPPLIER_RECEIVE', 7, ambev.id, w.storeB.id); // outra loja

      expect(await movements.supplierBalances(w.storeA.id)).toEqual([
        {
          supplierId: ambev.id,
          supplierName: 'Ambev',
          deleted: false,
          bottleTypes: [
            {
              bottleTypeId: litrao.id,
              bottleTypeName: 'Litrão',
              sent: 12,
              received: 30,
              balance: 18,
            },
          ],
        },
        {
          supplierId: coca.id,
          supplierName: 'Coca',
          deleted: false,
          bottleTypes: [
            expect.objectContaining({ sent: 10, received: 10, balance: 0 }),
          ],
        },
      ]);

      // fornecedor excluído: continua enquanto deve; com saldo zero, sai
      await as(() => service.remove(w.company.id, ambev.id));
      await as(() => service.remove(w.company.id, coca.id));
      const after = await movements.supplierBalances(w.storeA.id);
      expect(after.map((s) => [s.supplierName, s.deleted])).toEqual([
        ['Ambev', true],
      ]);
    });

    it('loja sem movimentação com fornecedor: lista vazia', async () => {
      expect(await movements.supplierBalances(w.storeA.id)).toEqual([]);
    });
  });
});
