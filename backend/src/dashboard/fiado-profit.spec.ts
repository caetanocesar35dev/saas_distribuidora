import { FiadoPayment, FiadoSale, realizeFiadoProfit } from './fiado-profit';

const sale = (
  at: string,
  totalCents: number,
  profitCents: number,
  pair = { customerId: 'c1', storeId: 's1' },
): FiadoSale => ({ ...pair, createdAt: new Date(at), totalCents, profitCents });

const pay = (
  at: string,
  amountCents: number,
  pair = { customerId: 'c1', storeId: 's1' },
): FiadoPayment => ({ ...pair, createdAt: new Date(at), amountCents });

const sum = (xs: { profitCents: number }[]) =>
  xs.reduce((s, x) => s + x.profitCents, 0);

describe('realizeFiadoProfit', () => {
  it('sem pagamento: nada realizado, todo o lucro a receber', () => {
    const r = realizeFiadoProfit([sale('2026-10-01', 1000, 400)], []);
    expect(r.realized).toEqual([]);
    expect(r.pendingByStore.get('s1')).toBe(400);
  });

  it('pagamento parcial realiza o lucro proporcional, na data do pagamento', () => {
    const r = realizeFiadoProfit(
      [sale('2026-10-01', 1000, 400)],
      [pay('2026-10-05', 250)],
    );
    expect(r.realized).toEqual([
      { storeId: 's1', at: new Date('2026-10-05'), profitCents: 100 },
    ]);
    expect(r.pendingByStore.get('s1')).toBe(300);
  });

  it('o pagamento quita primeiro a venda mais antiga, mesmo fora de ordem na lista', () => {
    const r = realizeFiadoProfit(
      [sale('2026-10-10', 1000, 100), sale('2026-10-01', 1000, 500)],
      [pay('2026-10-12', 1500)],
    );
    // 1000 da venda antiga (lucro 500) + 500 da nova (lucro 50)
    expect(r.realized.map((x) => x.profitCents)).toEqual([500, 50]);
    expect(r.pendingByStore.get('s1')).toBe(50);
  });

  it('venda quitada em parcelas soma exatamente o lucro dela (sem sobra de arredondamento)', () => {
    const r = realizeFiadoProfit(
      [sale('2026-10-01', 1000, 333)],
      [pay('2026-10-02', 333), pay('2026-10-03', 333), pay('2026-10-04', 334)],
    );
    expect(sum(r.realized)).toBe(333);
    expect(r.pendingByStore.has('s1')).toBe(false);
  });

  it('separa por cliente e por loja', () => {
    const other = { customerId: 'c2', storeId: 's2' };
    const r = realizeFiadoProfit(
      [sale('2026-10-01', 1000, 400), sale('2026-10-01', 1000, 200, other)],
      [pay('2026-10-02', 1000, other)],
    );
    expect(r.realized).toEqual([
      { storeId: 's2', at: new Date('2026-10-02'), profitCents: 200 },
    ]);
    expect(r.pendingByStore.get('s1')).toBe(400);
    expect(r.pendingByStore.has('s2')).toBe(false);
  });

  it('venda com prejuízo realiza prejuízo proporcional', () => {
    const r = realizeFiadoProfit(
      [sale('2026-10-01', 1000, -200)],
      [pay('2026-10-02', 500)],
    );
    expect(sum(r.realized)).toBe(-100);
    expect(r.pendingByStore.get('s1')).toBe(-100);
  });

  it('venda fiada de total zero: o lucro (prejuízo) vale na data da venda', () => {
    const r = realizeFiadoProfit([sale('2026-10-01', 0, -300)], []);
    expect(r.realized).toEqual([
      { storeId: 's1', at: new Date('2026-10-01'), profitCents: -300 },
    ]);
    expect(r.pendingByStore.has('s1')).toBe(false);
  });
});
