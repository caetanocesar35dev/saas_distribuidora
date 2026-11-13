import type { Role } from "@/lib/api/types";

/** Lojas marcadas no convite: id da loja → papel nela. */
export type InviteSelection = Record<string, Role>;

/** Todas as lojas estão marcadas? (Com nenhuma loja, não.) */
export function allSelected(storeIds: string[], selected: InviteSelection): boolean {
  return storeIds.length > 0 && storeIds.every((id) => selected[id] !== undefined);
}

/**
 * Marca todas as lojas. As já marcadas mantêm o papel escolhido; as novas entram com o papel em
 * comum das marcadas (se houver um só) ou como atendente.
 */
export function selectAllStores(storeIds: string[], selected: InviteSelection): InviteSelection {
  const fallback = commonRole(selected) ?? "EMPLOYEE";
  const next: InviteSelection = {};
  for (const id of storeIds) next[id] = selected[id] ?? fallback;
  return next;
}

/** Põe o mesmo papel em todas as lojas marcadas. */
export function setRoleForAll(selected: InviteSelection, role: Role): InviteSelection {
  const next: InviteSelection = {};
  for (const id of Object.keys(selected)) next[id] = role;
  return next;
}

/** O papel das lojas marcadas, quando é o mesmo em todas; senão (ou sem nenhuma), null. */
export function commonRole(selected: InviteSelection): Role | null {
  const roles = new Set(Object.values(selected));
  return roles.size === 1 ? [...roles][0] : null;
}
