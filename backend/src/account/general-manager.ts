import { PrismaTx } from '../prisma/prisma.extension';

/**
 * Gerente geral (decisão do usuário, 2026-10-30): é gerente em TODAS as lojas ativas da empresa.
 * O acesso fica nas linhas de `MembershipStore`, como o de qualquer pessoa, então todo o resto do
 * sistema (guard, papéis por loja) funciona sem caso especial. Estes helpers mantêm isso verdade.
 */

/** Dá MANAGER ao membro em todas as lojas ativas da empresa (sobe atendente, reativa revogado). */
export async function grantGeneralManagerAccess(
  tx: PrismaTx,
  companyId: string,
  membershipId: string,
) {
  const stores = await tx.store.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true },
  });
  for (const store of stores) {
    await tx.membershipStore.upsert({
      where: { membershipId_storeId: { membershipId, storeId: store.id } },
      create: { membershipId, storeId: store.id, role: 'MANAGER' },
      update: { role: 'MANAGER', deletedAt: null },
    });
  }
}

/** Loja nova ou reativada: os gerentes gerais da empresa entram nela como MANAGER. */
export async function grantStoreToGeneralManagers(
  tx: PrismaTx,
  companyId: string,
  storeId: string,
) {
  // `deletedAt: null` explícito: a reativação de loja roda enxergando os excluídos.
  const managers = await tx.membership.findMany({
    where: { companyId, isGeneralManager: true, deletedAt: null },
    select: { id: true },
  });
  for (const m of managers) {
    await tx.membershipStore.upsert({
      where: { membershipId_storeId: { membershipId: m.id, storeId } },
      create: { membershipId: m.id, storeId, role: 'MANAGER' },
      update: { role: 'MANAGER', deletedAt: null },
    });
  }
}
