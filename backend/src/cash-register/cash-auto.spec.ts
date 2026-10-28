import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { CashAutoCloseJob } from '../jobs/cash-auto-close.job';
import { SalesService } from '../sales/sales.service';
import { autoCloseDue } from './cash-auto';
import { CashRegisterService } from './cash-register.service';

const TZ = 'America/Sao_Paulo'; // UTC-3

describe('autoCloseDue (horário do fechamento automático)', () => {
  it('fecha na primeira vez, depois da abertura, que o relógio da loja chega ao horário', () => {
    // aberto 16/10 às 10:00 (13:00 UTC)
    const opened = new Date('2026-10-16T13:00:00Z');
    expect(autoCloseDue(opened, '00:00', TZ).toISOString()).toBe(
      '2026-10-17T03:00:00.000Z', // meia-noite de 17/10 em Brasília
    );
    expect(autoCloseDue(opened, '02:30', TZ).toISOString()).toBe(
      '2026-10-17T05:30:00.000Z',
    );
    // horário ainda no mesmo dia, depois da abertura
    expect(autoCloseDue(opened, '22:00', TZ).toISOString()).toBe(
      '2026-10-17T01:00:00.000Z',
    );
  });

  it('horário inválido vira meia-noite', () => {
    const opened = new Date('2026-10-16T13:00:00Z');
    expect(autoCloseDue(opened, '25:99', TZ).toISOString()).toBe(
      '2026-10-17T03:00:00.000Z',
    );
  });
});

describe('caixa automático (abre na primeira venda, fecha no horário da loja)', () => {
  let ctx: ServiceTestContext;
  let sales: SalesService;
  let cash: CashRegisterService;
  let job: CashAutoCloseJob;
  let w: World;
  let beer: { id: string };

  beforeAll(async () => {
    ctx = await createServiceTest([
      SalesService,
      CashRegisterService,
      CashAutoCloseJob,
    ]);
    sales = ctx.module.get(SalesService);
    cash = ctx.module.get(CashRegisterService);
    job = ctx.module.get(CashAutoCloseJob);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
    beer = await ctx.factory.storeProduct(w.storeA.id, w.company.id, {
      price: 10,
      stock: 50,
    });
  });
  afterAll(() => ctx.close());

  const sell = () =>
    ctx.asRequest(
      () =>
        sales.create(
          w.storeA.id,
          w.company.id,
          w.owner.id,
          {
            paymentMethod: 'MONEY',
            items: [{ storeProductId: beer.id, quantity: 1 }],
          },
          'OWNER',
        ),
      { userId: w.owner.id, endpoint: 'POST /api/stores/:storeId/sales' },
    );

  it('sem caixa aberto, a venda abre um sozinha com o saldo do último fechamento', async () => {
    // primeiro caixa: abre sozinho com troco zero
    await sell();
    const first = await cash.current(w.storeA.id);
    expect(first).toMatchObject({ initialBalance: 0, currentBalance: 10 });

    // fecha (à mão) e a próxima venda abre outro com o saldo que ficou (R$ 10)
    await ctx.asRequest(() => cash.close(w.storeA.id), {
      userId: w.owner.id,
      endpoint: 'POST /api/stores/:storeId/cash-register/close',
    });
    await sell();
    const second = await cash.current(w.storeA.id);
    expect(second).toMatchObject({ initialBalance: 10, currentBalance: 20 });
    expect(second!.id).not.toBe(first!.id);
  });

  it('o job fecha o caixa esquecido aberto depois do horário da loja, e só ele', async () => {
    await sell();
    const register = await ctx.prisma.cashRegister.findFirstOrThrow({
      where: { storeId: w.storeA.id, status: 'OPEN' },
    });
    const due = autoCloseDue(register.openedAt, '00:00', TZ);

    // antes do horário: nada fecha
    const before = await ctx.audit.runAsSystem('job:cash-auto-close', () =>
      job.run(new Date(due.getTime() - 60_000)),
    );
    expect(before.closed).toBe(0);

    // depois do horário: fecha, com o saldo calculado e a marca
    const after = await ctx.audit.runAsSystem('job:cash-auto-close', () =>
      job.run(new Date(due.getTime() + 60_000)),
    );
    expect(after.closed).toBe(1);
    const closed = await ctx.prisma.cashRegister.findUniqueOrThrow({
      where: { id: register.id },
    });
    expect(closed).toMatchObject({
      status: 'CLOSED',
      autoClosed: true,
      finalBalance: 10,
      modifiedEndpoint: 'job:cash-auto-close',
    });

    // rodar de novo não fecha nada
    const again = await ctx.audit.runAsSystem('job:cash-auto-close', () =>
      job.run(new Date(due.getTime() + 120_000)),
    );
    expect(again.closed).toBe(0);
  });

  it('respeita o horário que o dono escolheu na loja', async () => {
    await ctx.audit.runAsSystem('seed', () =>
      ctx.prisma.store.update({
        where: { id: w.storeA.id },
        data: { cashAutoCloseTime: '02:30' },
      }),
    );
    await sell();
    const register = await ctx.prisma.cashRegister.findFirstOrThrow({
      where: { storeId: w.storeA.id, status: 'OPEN' },
    });
    const midnight = autoCloseDue(register.openedAt, '00:00', TZ);
    // meia-noite já passou, mas o horário da loja (02:30) ainda não
    const atMidnight = await ctx.audit.runAsSystem('job:cash-auto-close', () =>
      job.run(new Date(midnight.getTime() + 60_000)),
    );
    expect(atMidnight.closed).toBe(0);
    const due = autoCloseDue(register.openedAt, '02:30', TZ);
    const later = await ctx.audit.runAsSystem('job:cash-auto-close', () =>
      job.run(new Date(due.getTime() + 60_000)),
    );
    expect(later.closed).toBe(1);
  });
});
