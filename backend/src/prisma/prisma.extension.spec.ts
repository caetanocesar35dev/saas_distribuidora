import {
  createTestPrisma,
  truncateAll,
  TestPrisma,
} from '../../test/helpers/prisma-test';
import { AuditViolationError } from './prisma.extension';

describe('Extensão do Prisma (auditoria + soft delete)', () => {
  let t: TestPrisma;

  beforeAll(() => {
    t = createTestPrisma();
  });
  beforeEach(async () => {
    await truncateAll(t.prisma);
  });
  afterAll(async () => {
    await t.close();
  });

  const asUser = <T>(fn: () => Promise<T>) =>
    t.audit.run(
      { userId: 'u-1', endpoint: 'POST /api/teste', withDeleted: false },
      fn,
    );

  it('recusa escrita sem contexto de auditoria', async () => {
    await expect(
      t.prisma.plan.create({ data: { name: 'Sem contexto', priceInCents: 1 } }),
    ).rejects.toBeInstanceOf(AuditViolationError);
  });

  it('grava modifierId e modifiedEndpoint do contexto e o trigger leva ao histórico', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({ data: { name: 'Básico', priceInCents: 1000 } }),
    );
    expect(plan.modifierId).toBe('u-1');
    expect(plan.modifiedEndpoint).toBe('POST /api/teste');

    const history = await t.prisma.planHistory.findMany({
      where: { id: plan.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0].modifierId).toBe('u-1');
    expect(history[0].historyEnd).toBeNull();
  });

  it('sobrescreve modifierId enviado pelo chamador (não confia no cliente)', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({
        data: { name: 'Pro', priceInCents: 1, modifierId: 'hacker' },
      }),
    );
    expect(plan.modifierId).toBe('u-1');
  });

  it('atualiza o autor a cada alteração e fecha a versão anterior', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({ data: { name: 'Pro', priceInCents: 1 } }),
    );
    await t.audit.run(
      { userId: 'u-2', endpoint: 'PATCH /api/x', withDeleted: false },
      () =>
        t.prisma.plan.update({
          where: { id: plan.id },
          data: { priceInCents: 2 },
        }),
    );
    const history = await t.prisma.planHistory.findMany({
      where: { id: plan.id },
      orderBy: { historyStart: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history[0].historyEnd).not.toBeNull();
    expect(history[1]).toMatchObject({
      modifierId: 'u-2',
      modifiedEndpoint: 'PATCH /api/x',
      priceInCents: 2,
    });
  });

  it('proíbe delete e deleteMany', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({ data: { name: 'X', priceInCents: 1 } }),
    );
    await expect(
      asUser(() => t.prisma.plan.delete({ where: { id: plan.id } })),
    ).rejects.toThrow(/Exclusão física/);
    await expect(asUser(() => t.prisma.plan.deleteMany())).rejects.toThrow(
      /Exclusão física/,
    );
  });

  it('esconde registros com soft delete e permite vê-los com withDeleted', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({ data: { name: 'Apagado', priceInCents: 1 } }),
    );
    await asUser(() =>
      t.prisma.plan.update({
        where: { id: plan.id },
        data: { deletedAt: new Date() },
      }),
    );

    expect(await t.prisma.plan.findMany()).toHaveLength(0);
    expect(
      await t.prisma.plan.findUnique({ where: { id: plan.id } }),
    ).toBeNull();
    expect(await t.prisma.plan.count()).toBe(0);
    const visible = await t.audit.withDeleted(() => t.prisma.plan.findMany());
    expect(visible).toHaveLength(1);
  });

  it('não altera registro excluído (update/updateMany ignoram deletedAt)', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({ data: { name: 'Apagado', priceInCents: 1 } }),
    );
    await asUser(() =>
      t.prisma.plan.update({
        where: { id: plan.id },
        data: { deletedAt: new Date() },
      }),
    );
    const result = await asUser(() =>
      t.prisma.plan.updateMany({
        where: { id: plan.id },
        data: { priceInCents: 99 },
      }),
    );
    expect(result.count).toBe(0);
  });

  it('upsert reativa registro excluído em vez de falhar por unicidade', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({ data: { name: 'Volta', priceInCents: 1 } }),
    );
    await asUser(() =>
      t.prisma.plan.update({
        where: { id: plan.id },
        data: { deletedAt: new Date() },
      }),
    );
    const again = await asUser(() =>
      t.prisma.plan.upsert({
        where: { name: 'Volta' },
        create: { name: 'Volta', priceInCents: 1 },
        update: { priceInCents: 5, deletedAt: null },
      }),
    );
    expect(again.id).toBe(plan.id);
    expect(again.deletedAt).toBeNull();
  });

  it('bloqueia escrita aninhada, que deixaria o filho sem autor', async () => {
    await expect(
      asUser(() =>
        t.prisma.organization.create({
          data: {
            name: 'Org',
            owner: {
              create: { name: 'A', email: 'a@a.com', passwordHash: 'h' },
            },
            plan: { create: { name: 'P', priceInCents: 1 } },
          },
        }),
      ),
    ).rejects.toThrow(/Escrita aninhada/);
  });

  it('modelos de histórico são somente leitura', async () => {
    await expect(
      asUser(() =>
        (t.prisma.planHistory as any).create({
          data: {
            id: 'x',
            name: 'x',
            priceInCents: 1,
            createdAt: new Date(),
            historyStart: new Date(),
          },
        }),
      ),
    ).rejects.toThrow(/somente leitura/);
  });

  it('funciona dentro de $transaction e faz rollback completo', async () => {
    await expect(
      asUser(() =>
        t.prisma.$transaction(async (tx) => {
          await tx.plan.create({ data: { name: 'Na tx', priceInCents: 1 } });
          throw new Error('falha');
        }),
      ),
    ).rejects.toThrow('falha');
    expect(await t.prisma.plan.count()).toBe(0);

    const ok = await asUser(() =>
      t.prisma.$transaction(async (tx) =>
        tx.plan.create({ data: { name: 'Na tx', priceInCents: 1 } }),
      ),
    );
    expect(ok.modifierId).toBe('u-1');
  });

  it('createMany carimba todos os registros', async () => {
    await asUser(() =>
      t.prisma.plan.createMany({
        data: [
          { name: 'A', priceInCents: 1 },
          { name: 'B', priceInCents: 2 },
        ],
      }),
    );
    const rows = await t.prisma.plan.findMany();
    expect(rows.map((r) => r.modifierId)).toEqual(['u-1', 'u-1']);
  });

  it('o banco recusa DELETE físico mesmo por SQL puro', async () => {
    const plan = await asUser(() =>
      t.prisma.plan.create({ data: { name: 'SQL', priceInCents: 1 } }),
    );
    await expect(
      t.prisma.$executeRaw`DELETE FROM tb_plans WHERE id = ${plan.id}`,
    ).rejects.toThrow();
  });
});
