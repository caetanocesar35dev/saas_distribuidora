import type { CustomerBalances } from "@/lib/api/types";
import { roundMoney } from "@/lib/format";

export interface CreditWarning {
  /** Dívida de fiado somada nas lojas que a pessoa enxerga. */
  amount: number;
  /** Vendas fiadas em aberto que compõem essa dívida. */
  sales: number;
  /** Data da venda em aberto mais antiga. */
  oldest: string | null;
  /** Detalhe por loja (a loja atual primeiro); só vale mostrar quando há mais de uma. */
  stores: { storeId: string; storeName: string; amount: number; sales: number }[];
}

/**
 * Aviso antes de vender no fiado: quanto o cliente já deve e em quantas vendas. Considera as
 * lojas que a pessoa enxerga (o atendente só recebe as dele). null = não deve nada.
 */
export function creditWarning(
  balances: CustomerBalances,
  currentStoreId: string,
): CreditWarning | null {
  const debts = balances.perStore
    .filter((s) => s.balance > 0)
    .sort((a, b) => (a.storeId === currentStoreId ? -1 : b.storeId === currentStoreId ? 1 : 0));
  if (debts.length === 0) return null;

  const oldest = debts
    .map((s) => s.oldestOpenCreditSaleAt)
    .filter((d): d is string => d !== null)
    .sort()[0];

  return {
    amount: roundMoney(debts.reduce((sum, s) => sum + s.balance, 0)),
    sales: debts.reduce((sum, s) => sum + s.openCreditSales, 0),
    oldest: oldest ?? null,
    stores: debts.map((s) => ({
      storeId: s.storeId,
      storeName: s.storeName,
      amount: s.balance,
      sales: s.openCreditSales,
    })),
  };
}

export interface CreditLimitCheck {
  limit: number;
  /** Dívida considerada: o total da empresa (gerente/dono) ou só as lojas que o atendente vê. */
  debt: number;
  /** Dívida depois desta venda. */
  after: number;
  /** A venda passa do limite (pelo que a pessoa consegue ver). */
  over: boolean;
}

/**
 * Confere o limite de crédito do fiado antes de vender. O limite vale contra a dívida de TODAS as
 * lojas: gerente e dono recebem esse total; o atendente só vê as lojas dele, então aqui só dá para
 * saber que passou com certeza (o backend confere o resto e barra o atendente). null = sem limite.
 */
export function creditLimitCheck(
  balances: CustomerBalances,
  saleTotal: number,
): CreditLimitCheck | null {
  if (balances.creditLimit === null) return null;
  const debt =
    balances.total ??
    roundMoney(balances.perStore.reduce((sum, s) => sum + Math.max(s.balance, 0), 0));
  const after = roundMoney(debt + saleTotal);
  return { limit: balances.creditLimit, debt, after, over: after > balances.creditLimit };
}

/** Dívida de um cliente da lista: "nesta loja", "nas outras lojas que vejo" e o total. */
export function debtSplit(
  debts: { storeId: string; balance: number }[],
  currentStoreId: string,
): { here: number; others: number; total: number } {
  let here = 0;
  let others = 0;
  for (const d of debts) {
    if (d.balance <= 0) continue;
    if (d.storeId === currentStoreId) here += d.balance;
    else others += d.balance;
  }
  return { here: roundMoney(here), others: roundMoney(others), total: roundMoney(here + others) };
}

/** "1 venda" / "3 vendas". */
export const salesLabel = (n: number) => (n === 1 ? "1 venda" : `${n} vendas`);
