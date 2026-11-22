import { ConflictException, NotFoundException } from '@nestjs/common';
import { World } from '../../test/helpers/factory';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import {
  createDefaultSaleChannels,
  DEFAULT_SALE_CHANNELS,
} from './sale-channels';
import { SaleChannelsService } from './sale-channels.service';

describe('SaleChannelsService', () => {
  let ctx: ServiceTestContext;
  let service: SaleChannelsService;
  let w: World;

  beforeAll(async () => {
    ctx = await createServiceTest([SaleChannelsService]);
    service = ctx.module.get(SaleChannelsService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
    await ctx.audit.runAsSystem('seed', () =>
      createDefaultSaleChannels(ctx.prisma, w.company.id),
    );
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>) =>
    ctx.asRequest(fn, {
      userId: w.owner.id,
      endpoint: 'POST /api/companies/:companyId/sale-channels',
    });
  const named = async (name: string) =>
    (await service.list(w.company.id)).find((c) => c.name === name)!;

  it('a empresa começa com a lista padrão, com Balcão como padrão e primeiro da lista', async () => {
    const list = await service.list(w.company.id);
    expect(list.map((c) => c.name).sort()).toEqual(
      [...DEFAULT_SALE_CHANNELS].sort(),
    );
    expect(list[0]).toMatchObject({ name: 'Balcão', isDefault: true });
    expect(list.filter((c) => c.isDefault)).toHaveLength(1);
  });

  it('cria e renomeia; nome repetido é recusado, inclusive de origem excluída', async () => {
    const site = await as(() =>
      service.create(w.company.id, { name: 'Site próprio' }),
    );
    expect(site).toMatchObject({ name: 'Site próprio', isDefault: false });
    await expect(
      as(() => service.create(w.company.id, { name: 'iFood' })),
    ).rejects.toThrow(/Já existe uma origem chamada "iFood"/);

    const renamed = await as(() =>
      service.update(w.company.id, site.id, { name: 'Loja virtual' }),
    );
    expect(renamed.name).toBe('Loja virtual');

    await as(() => service.remove(w.company.id, renamed.id));
    await expect(
      as(() => service.create(w.company.id, { name: 'Loja virtual' })),
    ).rejects.toThrow(/está excluída/);
  });

  it('trocar a padrão deixa só uma; a padrão não pode ser excluída', async () => {
    const balcao = await named('Balcão');
    const ifood = await named('iFood');
    await expect(
      as(() => service.remove(w.company.id, balcao.id)),
    ).rejects.toBeInstanceOf(ConflictException);

    const novo = await as(() => service.setDefault(w.company.id, ifood.id));
    expect(novo.isDefault).toBe(true);
    const list = await service.list(w.company.id);
    expect(list.filter((c) => c.isDefault).map((c) => c.name)).toEqual([
      'iFood',
    ]);
    expect(list[0].name).toBe('iFood');

    // agora o Balcão pode sair
    await as(() => service.remove(w.company.id, balcao.id));
    expect((await service.list(w.company.id)).map((c) => c.name)).not.toContain(
      'Balcão',
    );
  });

  it('excluir e reativar, com a lista das excluídas', async () => {
    const ze = await named('Zé Delivery');
    await as(() => service.remove(w.company.id, ze.id));
    const deleted = await service.list(w.company.id, { deleted: true });
    expect(deleted.map((c) => c.name)).toEqual(['Zé Delivery']);
    expect(deleted[0].deletedAt).toBeInstanceOf(Date);

    const restored = await as(() => service.restore(w.company.id, ze.id));
    expect(restored.deletedAt).toBeNull();
    await expect(
      as(() => service.restore(w.company.id, ze.id)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('origem de outra empresa não aparece nem pode ser mexida', async () => {
    const other = await ctx.factory.world();
    const ifood = await named('iFood');
    expect(await service.list(other.company.id)).toEqual([]);
    await expect(
      as(() => service.update(other.company.id, ifood.id, { name: 'X' })),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      as(() => service.setDefault(other.company.id, ifood.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a mudança fica no histórico com o autor', async () => {
    const ifood = await named('iFood');
    await as(() =>
      service.update(w.company.id, ifood.id, { name: 'iFood Entregas' }),
    );
    const history = await ctx.prisma.saleChannelHistory.findMany({
      where: { id: ifood.id },
      orderBy: { historyStart: 'asc' },
    });
    expect(history.map((h) => h.name)).toEqual(['iFood', 'iFood Entregas']);
    expect(history[1].modifierId).toBe(w.owner.id);
  });
});
