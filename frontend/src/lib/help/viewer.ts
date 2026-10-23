"use client";

import { useQuery } from "@tanstack/react-query";
import { publicApi } from "@/lib/api/client";
import type { Membership, Role } from "@/lib/api/types";
import { getValidLastSelection } from "@/lib/session/last-selection";

export interface HelpViewer {
  isLoggedIn: boolean;
  /** Papel na última loja usada (ou o maior papel, se não houver última loja). */
  role: Role | null;
  backHref: string;
  loading: boolean;
}

const ORDER: Role[] = ["EMPLOYEE", "MANAGER", "OWNER"];

/**
 * Quem está lendo a Central de Dúvidas. A página abre sem login, então um 401 aqui só quer dizer
 * "visitante" (por isso usa a API pública, que não redireciona para o login).
 */
export function useHelpViewer(): HelpViewer {
  const query = useQuery({
    queryKey: ["help-viewer"],
    queryFn: async () => {
      try {
        return await publicApi.get<Membership[]>("/me/memberships");
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const memberships = query.data;
  if (!memberships) {
    return { isLoggedIn: false, role: null, backHref: "/login", loading: query.isPending };
  }

  const last = getValidLastSelection(memberships);
  let role: Role | null = null;
  if (last) {
    role =
      memberships
        .find((m) => m.companyId === last.companyId)
        ?.stores.find((s) => s.storeId === last.storeId)?.role ?? null;
  }
  if (!role) {
    const all = memberships.flatMap((m) => m.stores.map((s) => s.role));
    role = all.sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0] ?? null;
  }

  return {
    isLoggedIn: true,
    role,
    backHref: last ? `/loja/${last.storeId}` : "/selecionar?trocar=1",
    loading: false,
  };
}
