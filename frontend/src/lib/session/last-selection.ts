import type { Membership } from "@/lib/api/types";

const KEY = "sd:last-store";

export interface LastSelection {
  companyId: string;
  storeId: string;
}

export function saveLastSelection(selection: LastSelection) {
  try {
    localStorage.setItem(KEY, JSON.stringify(selection));
  } catch {
    // modo privado ou armazenamento bloqueado: segue sem lembrar
  }
}

export function clearLastSelection() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorado
  }
}

function read(): LastSelection | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as LastSelection).companyId === "string" &&
      typeof (parsed as LastSelection).storeId === "string"
    ) {
      return parsed as LastSelection;
    }
  } catch {
    // dado corrompido: ignora
  }
  return null;
}

/** A última loja usada, só se o usuário ainda tiver acesso a ela (acesso revogado = volta à seleção). */
export function getValidLastSelection(
  memberships: Membership[],
): LastSelection | null {
  const saved = read();
  if (!saved) return null;
  const company = memberships.find((m) => m.companyId === saved.companyId);
  const store = company?.stores.find((s) => s.storeId === saved.storeId);
  return company && store ? saved : null;
}

/** Para onde mandar o usuário logo após entrar. */
export function resolveHome(memberships: Membership[], platformRole?: string | null): string {
  const stores = memberships.flatMap((m) =>
    m.stores.map((s) => ({ companyId: m.companyId, storeId: s.storeId })),
  );
  // Equipe da plataforma sem nenhuma loja entra direto na área da plataforma.
  if (stores.length === 0 && platformRole) return "/plataforma/organizacoes";
  if (stores.length === 1) return `/loja/${stores[0].storeId}`;
  const last = getValidLastSelection(memberships);
  if (last) return `/loja/${last.storeId}`;
  return "/selecionar";
}
