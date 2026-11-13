import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { isValidEan13 } from '../common/utils/ean13';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { BottleTypesService } from './bottle-types.service';
import { UpdateProductDto } from './dto/catalog.dto';
import { NO_CATEGORY } from './product-categories';
import { ProductCategoriesService } from './product-categories.service';
import { ProductsService } from './products.service';
import { StoreProductsService } from './store-products.service';

describe('Serviços de catálogo', () => {
  let ctx: ServiceTestContext;
  let products: ProductsService;
  let storeProducts: StoreProductsService;
  let bottleTypes: BottleTypesService;
  let categories: ProductCategoriesService;
  let w: World;

  beforeAll(async () => {
    ctx = await createServiceTest([
      ProductsService,
      StoreProductsService,
      BottleTypesService,
      ProductCategoriesService,
    ]);
    products = ctx.module.get(ProductsService);
    storeProducts = ctx.module.get(StoreProductsService);
    bottleTypes = ctx.module.get(BottleTypesService);
    categories = ctx.module.get(ProductCategoriesService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>, endpoint = 'POST /api/teste') =>
    ctx.asRequest(fn, { userId: w.owner.id, endpoint });
  const page = { page: 1, limit: 20 };

  describe('ProductsService', () => {
    it('cria o produto já nas lojas escolhidas: custo igual, preço independente por loja', async () => {
      const product = await as(() =>
        products.create(w.company.id, {
          name: 'Cerveja Lata',
          costPrice: 3,
          stores: [
            { storeId: w.storeA.id, price: 5.5 },
            { storeId: w.storeB.id, price: 6.2 },
          ],
        }),
      );
      const offers = await ctx.prisma.storeProduct.findMany({
        where: { productId: product.id },
        orderBy: { price: 'asc' },
      });
      expect(
        offers.map((o) => [o.storeId, o.price, o.costPrice, o.stock]),
      ).toEqual([
        [w.storeA.id, 5.5, 3, 0],
        [w.storeB.id, 6.2, 3, 0],
      ]);
    });

    it('permite sobrescrever o custo por loja', async () => {
      const product = await as(() =>
        products.create(w.company.id, {
          name: 'X',
          costPrice: 3,
          stores: [
            { storeId: w.storeA.id, price: 5, costPrice: 2.5 },
            { storeId: w.storeB.id, price: 5 },
          ],
        }),
      );
      const offers = await ctx.prisma.storeProduct.findMany({
        where: { productId: product.id },
      });
      expect(new Set(offers.map((o) => o.costPrice))).toEqual(
        new Set([2.5, 3]),
      );
    });

    it('sem lojas, cria só o catálogo', async () => {
      const product = await as(() =>
        products.create(w.company.id, { name: 'Só catálogo' }),
      );
      expect(
        await ctx.prisma.storeProduct.count({
          where: { productId: product.id },
        }),
      ).toBe(0);
    });

    it('gera EAN-13 válido e único quando o código não é informado', async () => {
      const codes = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const p = await as(() =>
          products.create(w.company.id, { name: `P${i}` }),
        );
        expect(isValidEan13(p.code)).toBe(true);
        codes.add(p.code);
      }
      expect(codes.size).toBe(5);
    });

    it('o código é único por empresa, mas pode repetir em outra empresa', async () => {
      await as(() =>
        products.create(w.company.id, { name: 'A', code: '7891000100103' }),
      );
      await expect(
        as(() =>
          products.create(w.company.id, { name: 'B', code: '7891000100103' }),
        ),
      ).rejects.toThrow(/Já existe um produto/);
      const other = await ctx.factory.world();
      await expect(
        ctx.asRequest(
          () =>
            products.create(other.company.id, {
              name: 'B',
              code: '7891000100103',
            }),
          {
            userId: other.owner.id,
          },
        ),
      ).resolves.toBeTruthy();
    });

    it('código de produto excluído continua reservado e a mensagem manda reativar', async () => {
      const p = await as(() =>
        products.create(w.company.id, { name: 'A', code: 'COD-1' }),
      );
      await as(() => products.remove(w.company.id, p.id));
      await expect(
        as(() =>
          products.create(w.company.id, { name: 'Novo', code: 'COD-1' }),
        ),
      ).rejects.toThrow(/Reative/);
    });

    it('valida lojas e vasilhame da própria empresa', async () => {
      const other = await ctx.factory.world();
      await expect(
        as(() =>
          products.create(w.company.id, {
            name: 'X',
            stores: [{ storeId: other.storeA.id, price: 1 }],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        as(() =>
          products.create(w.company.id, {
            name: 'X',
            stores: [
              { storeId: w.storeA.id, price: 1 },
              { storeId: w.storeA.id, price: 2 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const foreignBottle = await ctx.asRequest(
        () => bottleTypes.create(other.company.id, { name: 'Litrão' }),
        {
          userId: other.owner.id,
        },
      );
      await expect(
        as(() =>
          products.create(w.company.id, {
            name: 'X',
            bottleTypeId: foreignBottle.id,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await ctx.prisma.product.count()).toBe(0); // nada criado
    });

    it('não cria produto pela metade se a criação das ofertas falhar', async () => {
      const original = ctx.prisma.$transaction.bind(ctx.prisma);
      jest.spyOn(ctx.prisma, '$transaction').mockImplementationOnce(((
        fn: any,
      ) =>
        original(async (tx: any) => {
          await fn(tx);
          throw new Error('boom');
        })) as any);
      await expect(
        as(() =>
          products.create(w.company.id, {
            name: 'X',
            stores: [{ storeId: w.storeA.id, price: 1 }],
          }),
        ),
      ).rejects.toThrow('boom');
      expect(await ctx.prisma.product.count()).toBe(0);
      expect(await ctx.prisma.storeProduct.count()).toBe(0);
    });

    it('lista com busca por nome (sem diferenciar maiúsculas) ou código, e pagina', async () => {
      for (const name of [
        'Cerveja Pilsen',
        'Cerveja Lager',
        'Refrigerante Cola',
      ]) {
        await as(() => products.create(w.company.id, { name }));
      }
      const beers = await products.list(w.company.id, {
        ...page,
        search: 'CERVEJA',
      });
      expect(beers.data.map((p) => p.name)).toEqual([
        'Cerveja Lager',
        'Cerveja Pilsen',
      ]);
      expect(beers.meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 2,
        totalPages: 1,
      });

      const pageTwo = await products.list(w.company.id, { page: 2, limit: 2 });
      expect(pageTwo.data).toHaveLength(1);
      expect(pageTwo.meta.totalPages).toBe(2);
    });

    it('não enxerga produto de outra empresa', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.asRequest(
        () => products.create(other.company.id, { name: 'Alheio' }),
        {
          userId: other.owner.id,
        },
      );
      await expect(
        products.get(w.company.id, foreign.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() => products.update(w.company.id, foreign.id, { name: 'X' })),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() => products.remove(w.company.id, foreign.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((await products.list(w.company.id, page)).data).toHaveLength(0);
    });

    it('excluir tira o produto e as ofertas; restaurar traz o produto de volta', async () => {
      const p = await as(() =>
        products.create(w.company.id, {
          name: 'X',
          stores: [{ storeId: w.storeA.id, price: 1 }],
        }),
      );
      await as(() => products.remove(w.company.id, p.id));
      expect((await products.list(w.company.id, page)).data).toHaveLength(0);
      expect(await ctx.prisma.storeProduct.count()).toBe(0);
      expect(
        (
          await products.list(w.company.id, { ...page, deleted: true })
        ).data.map((x) => x.id),
      ).toEqual([p.id]);

      await as(() => products.restore(w.company.id, p.id));
      expect(
        (await products.list(w.company.id, page)).data.map((x) => x.id),
      ).toEqual([p.id]);
      expect(
        (await products.list(w.company.id, { ...page, deleted: true })).data,
      ).toHaveLength(0);
      // A oferta excluída junto volta com o preço de antes.
      const offers = await ctx.prisma.storeProduct.findMany();
      expect(offers).toHaveLength(1);
      expect(offers[0].price).toBe(1);
      await expect(
        as(() => products.restore(w.company.id, p.id)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('atualiza nome, fardo e vasilhame (e remove o vasilhame com null)', async () => {
      const bt = await as(() =>
        bottleTypes.create(w.company.id, { name: 'Litrão' }),
      );
      const p = await as(() => products.create(w.company.id, { name: 'X' }));
      const updated = await as(() =>
        products.update(w.company.id, p.id, {
          name: 'Y',
          packQuantity: 12,
          bottleTypeId: bt.id,
        }),
      );
      expect(updated).toMatchObject({
        name: 'Y',
        packQuantity: 12,
        bottleTypeId: bt.id,
      });
      const cleared = await as(() =>
        products.update(w.company.id, p.id, { bottleTypeId: null }),
      );
      expect(cleared.bottleTypeId).toBeNull();
    });
  });

  describe('StoreProductsService', () => {
    let productId: string;
    let spA: string;
    let spB: string;

    beforeEach(async () => {
      const p = await as(() =>
        products.create(w.company.id, {
          name: 'Cerveja',
          code: '7890000000011',
          costPrice: 3,
          stores: [
            { storeId: w.storeA.id, price: 5 },
            { storeId: w.storeB.id, price: 6 },
          ],
        }),
      );
      productId = p.id;
      const rows = await ctx.prisma.storeProduct.findMany({
        where: { productId },
      });
      spA = rows.find((r) => r.storeId === w.storeA.id)!.id;
      spB = rows.find((r) => r.storeId === w.storeB.id)!.id;
    });

    it('editar o preço numa loja não altera a outra nem o catálogo', async () => {
      await as(() =>
        storeProducts.update(w.storeA.id, spA, { price: 9.9, costPrice: 4 }),
      );
      const a = await storeProducts.get(w.storeA.id, spA);
      const b = await storeProducts.get(w.storeB.id, spB);
      expect([a.price, a.costPrice]).toEqual([9.9, 4]);
      expect([b.price, b.costPrice]).toEqual([6, 3]);
      expect((await products.get(w.company.id, productId)).name).toBe(
        'Cerveja',
      );
    });

    it('o update de preço nunca mexe no estoque', async () => {
      await as(() => storeProducts.stockEntry(w.storeA.id, spA, 10));
      await as(() =>
        storeProducts.update(w.storeA.id, spA, {
          price: 7,
          ...({ stock: 999 } as object),
        }),
      );
      expect((await storeProducts.get(w.storeA.id, spA)).stock).toBe(10);
    });

    it('item de uma loja não é acessível por outra loja', async () => {
      await expect(storeProducts.get(w.storeB.id, spA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        as(() => storeProducts.update(w.storeB.id, spA, { price: 1 })),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() => storeProducts.stockEntry(w.storeB.id, spA, 5)),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() =>
          storeProducts.stockAdjustment(w.storeB.id, spA, {
            newStock: 1,
            reason: 'x',
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('entradas de mercadoria concorrentes não perdem quantidade', async () => {
      await Promise.all(
        Array.from({ length: 10 }, () =>
          as(() => storeProducts.stockEntry(w.storeA.id, spA, 3)),
        ),
      );
      expect((await storeProducts.get(w.storeA.id, spA)).stock).toBe(30);
    });

    it('ajuste de inventário define o estoque contado', async () => {
      await as(() => storeProducts.stockEntry(w.storeA.id, spA, 50));
      const adjusted = await as(() =>
        storeProducts.stockAdjustment(w.storeA.id, spA, {
          newStock: 42,
          reason: 'Contagem',
        }),
      );
      expect(adjusted.stock).toBe(42);
    });

    it('o histórico registra entrada, ajuste e preço, com a rota de cada um', async () => {
      await as(
        () => storeProducts.stockEntry(w.storeA.id, spA, 10),
        'POST /api/stores/:storeId/store-products/:id/stock-entries',
      );
      await as(
        () =>
          storeProducts.stockAdjustment(w.storeA.id, spA, {
            newStock: 8,
            reason: 'Quebra',
          }),
        'POST /api/stores/:storeId/store-products/:id/stock-adjustments',
      );
      await as(
        () => storeProducts.update(w.storeA.id, spA, { price: 7.5 }),
        'PATCH /api/stores/:storeId/store-products/:id',
      );

      const history = await ctx.prisma.storeProductHistory.findMany({
        where: { id: spA },
        orderBy: { historyStart: 'asc' },
      });
      expect(
        history.map((h) => [h.stock, h.price, h.modifiedEndpoint]),
      ).toEqual([
        [0, 5, 'POST /api/teste'], // criação (via produto)
        [10, 5, 'POST /api/stores/:storeId/store-products/:id/stock-entries'],
        [
          8,
          5,
          'POST /api/stores/:storeId/store-products/:id/stock-adjustments',
        ],
        [8, 7.5, 'PATCH /api/stores/:storeId/store-products/:id'],
      ]);
      expect(history.every((h) => h.modifierId === w.owner.id)).toBe(true);
      expect(history.filter((h) => h.historyEnd === null)).toHaveLength(1);
    });

    it('add: não duplica oferta ativa e reativa a excluída', async () => {
      await expect(
        as(() =>
          storeProducts.add(w.storeA.id, w.company.id, { productId, price: 1 }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      await as(() => storeProducts.remove(w.storeA.id, spA));
      await expect(storeProducts.get(w.storeA.id, spA)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      const back = await as(() =>
        storeProducts.add(w.storeA.id, w.company.id, {
          productId,
          price: 8,
          stock: 4,
        }),
      );
      expect(back).toMatchObject({
        id: spA,
        price: 8,
        stock: 4,
        isActive: true,
      });
    });

    it('add: produto de outra empresa não é aceito', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.asRequest(
        () => products.create(other.company.id, { name: 'Alheio' }),
        { userId: other.owner.id },
      );
      await expect(
        as(() =>
          storeProducts.add(w.storeA.id, w.company.id, {
            productId: foreign.id,
            price: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('busca por código só devolve itens ativos', async () => {
      expect(
        (await storeProducts.getByCode(w.storeA.id, '7890000000011')).id,
      ).toBe(spA);
      await as(() =>
        storeProducts.update(w.storeA.id, spA, { isActive: false }),
      );
      await expect(
        storeProducts.getByCode(w.storeA.id, '7890000000011'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        storeProducts.getByCode(w.storeA.id, 'inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lista com busca e filtro de situação, e não mostra produto excluído do catálogo', async () => {
      const second = await as(() =>
        products.create(w.company.id, {
          name: 'Refrigerante',
          stores: [{ storeId: w.storeA.id, price: 4 }],
        }),
      );
      const all = await storeProducts.list(w.storeA.id, page);
      expect(all.data.map((i) => i.product.name)).toEqual([
        'Cerveja',
        'Refrigerante',
      ]);
      expect(
        (await storeProducts.list(w.storeA.id, { ...page, search: 'refri' }))
          .data,
      ).toHaveLength(1);

      await as(() =>
        storeProducts.update(w.storeA.id, spA, { isActive: false }),
      );
      expect(
        (await storeProducts.list(w.storeA.id, { ...page, isActive: true }))
          .data,
      ).toHaveLength(1);
      expect(
        (await storeProducts.list(w.storeA.id, { ...page, isActive: false }))
          .data,
      ).toHaveLength(1);

      await as(() => products.remove(w.company.id, second.id));
      expect(
        (await storeProducts.list(w.storeA.id, page)).data.map(
          (i) => i.product.name,
        ),
      ).toEqual(['Cerveja']);
    });

    it('estoque baixo respeita o limite informado e ignora inativos', async () => {
      await as(() => storeProducts.stockEntry(w.storeA.id, spA, 15));
      expect(await storeProducts.lowStock(w.storeA.id, 10)).toHaveLength(0);
      expect(
        (await storeProducts.lowStock(w.storeA.id, 15)).map((i) => i.id),
      ).toEqual([spA]);
      expect(
        (await storeProducts.lowStock(w.storeA.id)).map((i) => i.id),
      ).toEqual([spA]); // padrão 20
      await as(() =>
        storeProducts.update(w.storeA.id, spA, { isActive: false }),
      );
      expect(await storeProducts.lowStock(w.storeA.id)).toHaveLength(0);
    });
  });

  describe('BottleTypesService', () => {
    it('cria, lista, renomeia e não aceita nome repetido na empresa', async () => {
      const lit = await as(() =>
        bottleTypes.create(w.company.id, { name: 'Litrão' }),
      );
      await as(() => bottleTypes.create(w.company.id, { name: '600ml' }));
      await expect(
        as(() => bottleTypes.create(w.company.id, { name: 'Litrão' })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await bottleTypes.list(w.company.id)).map((b) => b.name)).toEqual(
        ['600ml', 'Litrão'],
      );

      await as(() =>
        bottleTypes.update(w.company.id, lit.id, { name: 'Litrão 1L' }),
      );
      expect((await bottleTypes.get(w.company.id, lit.id)).name).toBe(
        'Litrão 1L',
      );
      await expect(
        as(() => bottleTypes.update(w.company.id, lit.id, { name: '600ml' })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('preço do casco: começa sem, é definido, mantido ao renomear e tirado com null', async () => {
      const lit = await as(() =>
        bottleTypes.create(w.company.id, { name: 'Litrão' }),
      );
      expect(lit.price).toBeNull();

      await as(() =>
        bottleTypes.update(w.company.id, lit.id, { price: 7.999 }),
      );
      expect((await bottleTypes.get(w.company.id, lit.id)).price).toBe(8);

      await as(() =>
        bottleTypes.update(w.company.id, lit.id, { name: 'Litrão 1L' }),
      );
      expect((await bottleTypes.get(w.company.id, lit.id)).price).toBe(8);

      await as(() => bottleTypes.update(w.company.id, lit.id, { price: null }));
      expect((await bottleTypes.get(w.company.id, lit.id)).price).toBeNull();

      const withPrice = await as(() =>
        bottleTypes.create(w.company.id, { name: '600ml', price: 5 }),
      );
      expect(withPrice.price).toBe(5);
    });

    it('nome de tipo excluído continua reservado; restaurar reativa', async () => {
      const bt = await as(() =>
        bottleTypes.create(w.company.id, { name: 'Caixa' }),
      );
      await as(() => bottleTypes.remove(w.company.id, bt.id));
      await expect(
        as(() => bottleTypes.create(w.company.id, { name: 'Caixa' })),
      ).rejects.toThrow(/Reative/);
      await as(() => bottleTypes.restore(w.company.id, bt.id));
      expect((await bottleTypes.list(w.company.id)).map((b) => b.id)).toEqual([
        bt.id,
      ]);
    });

    it('não exclui tipo usado por produto nem com cliente devendo', async () => {
      const used = await as(() =>
        bottleTypes.create(w.company.id, { name: 'Usado' }),
      );
      await as(() =>
        products.create(w.company.id, { name: 'P', bottleTypeId: used.id }),
      );
      await expect(
        as(() => bottleTypes.remove(w.company.id, used.id)),
      ).rejects.toThrow(/produtos/);

      const owed = await as(() =>
        bottleTypes.create(w.company.id, { name: 'Devido' }),
      );
      const customer = await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.customer.create({
          data: { companyId: w.company.id, name: 'Cliente' },
        }),
      );
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.customerStoreBottleBalance.create({
          data: {
            customerId: customer.id,
            storeId: w.storeA.id,
            bottleTypeId: owed.id,
            balance: 2,
          },
        }),
      );
      await expect(
        as(() => bottleTypes.remove(w.company.id, owed.id)),
      ).rejects.toThrow(/saldo/);
    });

    it('tipo de outra empresa não é visível', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.asRequest(
        () => bottleTypes.create(other.company.id, { name: 'Alheio' }),
        { userId: other.owner.id },
      );
      await expect(
        bottleTypes.get(w.company.id, foreign.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() => bottleTypes.remove(w.company.id, foreign.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('ProductCategoriesService', () => {
    const create = (name: string) =>
      as(() => categories.create(w.company.id, { name }));

    it('cria, renomeia e lista por nome; o histórico guarda o autor', async () => {
      await create('Salgadinhos');
      const cigarros = await create('Cigarros');
      await as(
        () =>
          categories.update(w.company.id, cigarros.id, { name: 'Tabacaria' }),
        'PATCH /api/categorias',
      );

      const list = await categories.list(w.company.id);
      expect(list.map((c) => c.name)).toEqual(['Salgadinhos', 'Tabacaria']);

      const history = await ctx.prisma.productCategoryHistory.findMany({
        where: { id: cigarros.id },
        orderBy: { historyStart: 'asc' },
      });
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({
        name: 'Tabacaria',
        modifierId: w.owner.id,
        modifiedEndpoint: 'PATCH /api/categorias',
      });
    });

    it('nome repetido é recusado; nome de excluída sugere reativar', async () => {
      const gelo = await create('Gelo');
      await expect(create('Gelo')).rejects.toThrow(/Já existe/);

      await as(() => categories.remove(w.company.id, gelo.id));
      await expect(create('Gelo')).rejects.toThrow(
        new RegExp(`id ${gelo.id}.*Reative-a`),
      );
    });

    it('excluir é soft delete: some da lista, aparece nas excluídas e pode reativar', async () => {
      const gelo = await create('Gelo');
      await as(() => categories.remove(w.company.id, gelo.id));

      expect(await categories.list(w.company.id)).toHaveLength(0);
      const deleted = await as(() =>
        categories.list(w.company.id, { deleted: true }),
      );
      expect(deleted.map((c) => c.id)).toEqual([gelo.id]);

      const restored = await as(() =>
        categories.restore(w.company.id, gelo.id),
      );
      expect(restored.deletedAt).toBeNull();
      await expect(
        as(() => categories.restore(w.company.id, gelo.id)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('não exclui categoria com produto; sem o produto, exclui', async () => {
      const gelo = await create('Gelo');
      const p = await as(() =>
        products.create(w.company.id, { name: 'Saco', categoryId: gelo.id }),
      );
      await expect(
        as(() => categories.remove(w.company.id, gelo.id)),
      ).rejects.toThrow(/produtos nesta categoria/);

      await as(() => products.update(w.company.id, p.id, { categoryId: null }));
      await expect(
        as(() => categories.remove(w.company.id, gelo.id)),
      ).resolves.toEqual({ message: 'Categoria excluída.' });
    });

    it('categoria de outra empresa não é visível nem pode ir num produto', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.asRequest(
        () => categories.create(other.company.id, { name: 'Alheia' }),
        { userId: other.owner.id },
      );
      await expect(
        categories.get(w.company.id, foreign.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() => categories.remove(w.company.id, foreign.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() =>
          products.create(w.company.id, {
            name: 'P',
            categoryId: foreign.id,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('filtra produtos e ofertas da loja por categoria e por "sem categoria"', async () => {
      const gelo = await create('Gelo');
      const offer = [{ storeId: w.storeA.id, price: 5 }];
      await as(() =>
        products.create(w.company.id, {
          name: 'Saco de gelo',
          categoryId: gelo.id,
          stores: offer,
        }),
      );
      await as(() =>
        products.create(w.company.id, { name: 'Sem nada', stores: offer }),
      );

      const inCategory = await products.list(w.company.id, {
        ...page,
        categoryId: gelo.id,
      });
      expect(inCategory.data.map((p) => p.name)).toEqual(['Saco de gelo']);
      expect(inCategory.data[0].category?.name).toBe('Gelo');

      const without = await storeProducts.list(w.storeA.id, {
        ...page,
        categoryId: NO_CATEGORY,
      });
      expect(without.data.map((s) => s.product.name)).toEqual(['Sem nada']);
    });

    it('produto reativado volta sem categoria se ela foi excluída nesse meio-tempo', async () => {
      const gelo = await create('Gelo');
      const p = await as(() =>
        products.create(w.company.id, { name: 'Saco', categoryId: gelo.id }),
      );
      await as(() => products.remove(w.company.id, p.id));
      await as(() => categories.remove(w.company.id, gelo.id));

      const restored = await as(() => products.restore(w.company.id, p.id));
      expect(restored.categoryId).toBeNull();
    });
  });

  describe('preço e custo da embalagem', () => {
    it('grava o preço do maço e o custo da unidade com 4 casas, e tira com null', async () => {
      const p = await as(() =>
        products.create(w.company.id, {
          name: 'Cigarro',
          packQuantity: 20,
          packName: 'maço',
          stores: [
            {
              storeId: w.storeA.id,
              price: 1,
              packPrice: 12,
              costPrice: 0.475,
            },
          ],
        }),
      );
      const [offer] = (await storeProducts.list(w.storeA.id, page)).data;
      expect(offer).toMatchObject({
        productId: p.id,
        price: 1,
        packPrice: 12,
        costPrice: 0.475,
      });

      const changed = await as(() =>
        storeProducts.update(w.storeA.id, offer.id, { packPrice: 13 }),
      );
      expect(changed.packPrice).toBe(13);
      const cleared = await as(() =>
        storeProducts.update(w.storeA.id, offer.id, { packPrice: null }),
      );
      expect(cleared.packPrice).toBeNull();
    });
  });

  describe('nome da embalagem', () => {
    it('grava o nome, atualiza e volta ao padrão com null', async () => {
      const p = await as(() =>
        products.create(w.company.id, {
          name: 'Cigarro',
          packQuantity: 10,
          packName: 'pacote',
          stores: [{ storeId: w.storeA.id, price: 12 }],
        }),
      );
      expect(p.packName).toBe('pacote');
      const offers = await storeProducts.list(w.storeA.id, page);
      expect(offers.data[0].product.packName).toBe('pacote');

      const changed = await as(() =>
        products.update(w.company.id, p.id, { packName: 'caixa' }),
      );
      expect(changed.packName).toBe('caixa');
      const cleared = await as(() =>
        products.update(w.company.id, p.id, { packName: null }),
      );
      expect(cleared.packName).toBeNull();
    });

    it('o DTO limpa o texto: minúsculas, sem espaços, vazio vira null', async () => {
      const validate = (packName: string) =>
        new ValidationPipe({ transform: true, whitelist: true }).transform(
          { packName },
          { type: 'body', metatype: UpdateProductDto },
        ) as Promise<UpdateProductDto>;

      expect((await validate('  Caixa ')).packName).toBe('caixa');
      expect((await validate('   ')).packName).toBeNull();
      await expect(validate('x'.repeat(21))).rejects.toThrow();
    });
  });
});
