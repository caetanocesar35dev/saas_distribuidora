import { allocatePayment, DebtLine } from './allocate-payment';

const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const debt = (
  storeId: string,
  balance: number,
  updatedAt = day(1),
): DebtLine => ({ storeId, balance, updatedAt });

describe('allocatePayment', () => {
  it('abate primeiro a dívida da loja que recebeu o dinheiro', () => {
    const r = allocatePayment(
      [debt('A', 60, day(1)), debt('B', 100, day(2))],
      100,
      'B',
    );
    expect(r).toEqual({
      allocations: [{ storeId: 'B', amount: 100 }],
      unallocated: 0,
    });
  });

  it('o excedente vai para as outras lojas, da dívida mais antiga para a mais nova', () => {
    const r = allocatePayment(
      [debt('B', 40, day(5)), debt('A', 60, day(3)), debt('C', 80, day(1))],
      130,
      'B',
    );
    expect(r.allocations).toEqual([
      { storeId: 'B', amount: 40 },
      { storeId: 'C', amount: 80 },
      { storeId: 'A', amount: 10 },
    ]);
    expect(r.unallocated).toBe(0);
  });

  it('exemplo do plano: R$100 pagos na loja B, com R$40 de dívida em B e R$60 em A', () => {
    const r = allocatePayment([debt('A', 60), debt('B', 40)], 100, 'B');
    expect(r.allocations).toEqual([
      { storeId: 'B', amount: 40 },
      { storeId: 'A', amount: 60 },
    ]);
  });

  it('não aloca mais do que o saldo de cada loja e informa o que sobrou', () => {
    const r = allocatePayment([debt('A', 30), debt('B', 20)], 80, 'A');
    expect(r.allocations).toEqual([
      { storeId: 'A', amount: 30 },
      { storeId: 'B', amount: 20 },
    ]);
    expect(r.unallocated).toBe(30);
  });

  it('pagamento menor que a dívida da loja: abate só o valor pago', () => {
    const r = allocatePayment([debt('A', 100)], 35.5, 'A');
    expect(r).toEqual({
      allocations: [{ storeId: 'A', amount: 35.5 }],
      unallocated: 0,
    });
  });

  it('ignora lojas sem dívida (saldo zero ou credor)', () => {
    const r = allocatePayment(
      [debt('A', 0), debt('B', -5), debt('C', 10)],
      10,
      'A',
    );
    expect(r.allocations).toEqual([{ storeId: 'C', amount: 10 }]);
  });

  it('sem dívida nenhuma, nada é alocado', () => {
    expect(allocatePayment([], 10, 'A')).toEqual({
      allocations: [],
      unallocated: 10,
    });
  });

  it('empate de data é decidido pelo id da loja (resultado estável)', () => {
    const r = allocatePayment(
      [debt('Z', 10, day(1)), debt('M', 10, day(1))],
      10,
      'X',
    );
    expect(r.allocations).toEqual([{ storeId: 'M', amount: 10 }]);
  });

  it('não acumula erro de ponto flutuante (0,1 + 0,2)', () => {
    const r = allocatePayment([debt('A', 0.1), debt('B', 0.2)], 0.3, 'A');
    expect(r.allocations).toEqual([
      { storeId: 'A', amount: 0.1 },
      { storeId: 'B', amount: 0.2 },
    ]);
    expect(r.unallocated).toBe(0);
  });

  it('a soma das alocações sempre fecha com o valor pago', () => {
    const debts = [
      debt('A', 33.33, day(1)),
      debt('B', 66.67, day(2)),
      debt('C', 10.01, day(3)),
    ];
    const r = allocatePayment(debts, 100.01, 'C');
    const sum = r.allocations.reduce(
      (s, a) => s + Math.round(a.amount * 100),
      0,
    );
    expect(sum + Math.round(r.unallocated * 100)).toBe(10001);
  });
});
