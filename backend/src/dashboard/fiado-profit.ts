/**
 * Lucro do fiado pelo dinheiro recebido (decisão do usuário, 2026-11-13): o lucro de uma venda
 * fiada só entra no painel quando o cliente paga, proporcional ao que pagou.
 *
 * O pagamento não é ligado a uma venda (abate o saldo da loja), então vale a mesma convenção do
 * resto do sistema: ele quita primeiro a venda fiada mais antiga do cliente naquela loja. Venda fiada
 * paga em parte não pode ser cancelada e pagamento maior que a dívida é recusado, por isso a
 * sequência sempre fecha (nenhum pagamento sobra sem venda).
 *
 * Tudo em centavos. O lucro realizado de uma venda é arredondado pelo acumulado
 * (lucro × pago até agora ÷ total), então a soma das parcelas dá exatamente o lucro da venda quando
 * ela é quitada.
 */

export interface FiadoSale {
  customerId: string;
  storeId: string;
  createdAt: Date;
  /** O que o cliente deve pela venda (inclusive cascos comprados). */
  totalCents: number;
  /** Lucro da venda: total − cascos − custo (pode ser negativo). */
  profitCents: number;
}

export interface FiadoPayment {
  customerId: string;
  /** Loja cuja dívida foi abatida (a da venda), não onde o dinheiro foi recebido. */
  storeId: string;
  createdAt: Date;
  amountCents: number;
}

export interface RealizedProfit {
  storeId: string;
  /** Quando o lucro entrou: a data do pagamento. */
  at: Date;
  profitCents: number;
}

export interface FiadoProfitResult {
  realized: RealizedProfit[];
  /** Lucro das vendas fiadas ainda não pago, por loja. */
  pendingByStore: Map<string, number>;
}

const byDate = <T extends { createdAt: Date }>(a: T, b: T) =>
  a.createdAt.getTime() - b.createdAt.getTime();

export function realizeFiadoProfit(
  sales: FiadoSale[],
  payments: FiadoPayment[],
): FiadoProfitResult {
  const key = (x: { customerId: string; storeId: string }) =>
    `${x.customerId}|${x.storeId}`;
  const salesByPair = new Map<string, FiadoSale[]>();
  for (const s of sales) {
    const list = salesByPair.get(key(s)) ?? [];
    list.push(s);
    salesByPair.set(key(s), list);
  }
  const paymentsByPair = new Map<string, FiadoPayment[]>();
  for (const p of payments) {
    const list = paymentsByPair.get(key(p)) ?? [];
    list.push(p);
    paymentsByPair.set(key(p), list);
  }

  const realized: RealizedProfit[] = [];
  const pendingByStore = new Map<string, number>();

  for (const [pair, pairSales] of salesByPair) {
    const storeId = pairSales[0].storeId;
    // Venda fiada sem valor a pagar (total 0) não espera pagamento: o lucro vale na hora.
    for (const s of pairSales) {
      if (s.totalCents <= 0 && s.profitCents !== 0)
        realized.push({ storeId, at: s.createdAt, profitCents: s.profitCents });
    }
    const queue = pairSales.filter((s) => s.totalCents > 0).sort(byDate);
    const pays = [...(paymentsByPair.get(pair) ?? [])].sort(byDate);

    let i = 0;
    let paidOnSale = 0; // centavos já pagos da venda queue[i]
    const skipSettled = () => {
      while (i < queue.length && paidOnSale >= queue[i].totalCents) {
        i += 1;
        paidOnSale = 0;
      }
    };

    for (const pay of pays) {
      let left = pay.amountCents;
      while (left > 0 && i < queue.length) {
        const sale = queue[i];
        const take = Math.min(left, sale.totalCents - paidOnSale);
        const before = share(sale, paidOnSale);
        paidOnSale += take;
        left -= take;
        const delta = share(sale, paidOnSale) - before;
        if (delta !== 0)
          realized.push({ storeId, at: pay.createdAt, profitCents: delta });
        skipSettled();
      }
    }

    // O que ficou sem pagar é lucro a receber.
    let pending = 0;
    for (let j = i; j < queue.length; j++) {
      const paid = j === i ? paidOnSale : 0;
      pending += queue[j].profitCents - share(queue[j], paid);
    }
    if (pending !== 0)
      pendingByStore.set(storeId, (pendingByStore.get(storeId) ?? 0) + pending);
  }

  return { realized, pendingByStore };
}

/** Lucro proporcional a `paidCents` da venda, arredondado em centavos. */
function share(sale: FiadoSale, paidCents: number): number {
  return Math.round((sale.profitCents * paidCents) / sale.totalCents);
}
