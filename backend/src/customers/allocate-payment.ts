import { fromCents, toCents } from '../common/utils/money';

export interface DebtLine {
  storeId: string;
  balance: number;
  /** Última alteração do saldo: as dívidas mais antigas são abatidas primeiro. */
  updatedAt: Date;
}

export interface Allocation {
  storeId: string;
  amount: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** Quanto do pagamento sobrou sem dívida para abater (0 quando tudo foi alocado). */
  unallocated: number;
}

/**
 * Distribui um pagamento entre as dívidas do cliente (estratégia padrão, função pura):
 *  1. a dívida da loja que recebeu o dinheiro;
 *  2. depois as demais lojas, da dívida mais antiga (updatedAt) para a mais nova.
 * Nenhuma alocação passa do saldo da loja. Todos os cálculos são em centavos inteiros.
 */
export function allocatePayment(
  debts: DebtLine[],
  amount: number,
  receivingStoreId: string,
): AllocationResult {
  let remaining = toCents(amount);

  const ordered = debts
    .filter((d) => toCents(d.balance) > 0)
    .sort((a, b) => {
      if (a.storeId === receivingStoreId) return -1;
      if (b.storeId === receivingStoreId) return 1;
      return (
        a.updatedAt.getTime() - b.updatedAt.getTime() ||
        a.storeId.localeCompare(b.storeId)
      );
    });

  const allocations: Allocation[] = [];
  for (const debt of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, toCents(debt.balance));
    allocations.push({ storeId: debt.storeId, amount: fromCents(take) });
    remaining -= take;
  }
  return { allocations, unallocated: fromCents(Math.max(remaining, 0)) };
}
