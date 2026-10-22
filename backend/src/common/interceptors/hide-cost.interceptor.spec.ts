import { stripCost } from './hide-cost.interceptor';

describe('stripCost (atendente não recebe custo nem lucro)', () => {
  it('remove custo e lucro em qualquer nível e mantém o resto', () => {
    const createdAt = new Date('2026-10-21T12:00:00Z');
    const body = {
      data: [
        {
          id: 'v1',
          total: 30,
          totalCost: 18,
          createdAt,
          items: [{ price: 10, costPrice: 6, quantity: 3 }],
          customer: null,
        },
      ],
      meta: { page: 1, totalRevenue: 30, totalProfit: 12 },
    };
    expect(stripCost(body)).toEqual({
      data: [
        {
          id: 'v1',
          total: 30,
          createdAt,
          items: [{ price: 10, quantity: 3 }],
          customer: null,
        },
      ],
      meta: { page: 1, totalRevenue: 30 },
    });
    const stripped = stripCost(body) as typeof body;
    expect(stripped.data[0].createdAt).toBeInstanceOf(Date);
    // não altera o objeto original
    expect(body.data[0].totalCost).toBe(18);
  });

  it('valores simples passam como estão', () => {
    expect(stripCost(null)).toBeNull();
    expect(stripCost('ok')).toBe('ok');
    expect(stripCost([1, 2])).toEqual([1, 2]);
  });
});
