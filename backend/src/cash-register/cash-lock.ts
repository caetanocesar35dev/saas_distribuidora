import { PrismaTx } from '../prisma/prisma.extension';

/**
 * Travas (advisory locks do Postgres, válidas até o fim da transação) do caixa de uma loja.
 *
 *  - COMPARTILHADA: vendas, pagamentos de fiado e cancelamentos, que só ADICIONAM movimentos.
 *    Várias podem rodar ao mesmo tempo.
 *  - EXCLUSIVA: abrir, fechar e registrar entrada/saída manual. Esperam as compartilhadas
 *    terminarem, então o caixa nunca fecha no meio de uma venda e a conferência de saldo de uma
 *    saída não corre contra outra saída.
 *
 * Devem ser a primeira coisa da transação, antes de ler o caixa.
 */
const key = (storeId: string) => `cash:${storeId}`;

export async function lockCashShared(
  tx: PrismaTx,
  storeId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${key(storeId)}))`;
}

export async function lockCashExclusive(
  tx: PrismaTx,
  storeId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key(storeId)}))`;
}
