"use client";

import { useQuery } from "@tanstack/react-query";
import { api, publicApi } from "@/lib/api/client";
import type { Membership, Profile } from "@/lib/api/types";

export const sessionKeys = {
  me: ["me"] as const,
  memberships: ["memberships"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: sessionKeys.me,
    queryFn: () => api.get<Profile>("/me"),
    staleTime: 60_000,
  });
}

/**
 * Empresas e lojas do usuário, com o papel em cada loja e o estado da assinatura. Recarrega ao
 * voltar para a aba e a cada 5 minutos: assim o acesso completo volta sozinho quando a
 * assinatura é regularizada.
 */
export function useMemberships() {
  return useQuery({
    queryKey: sessionKeys.memberships,
    queryFn: () => api.get<Membership[]>("/me/memberships"),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Para páginas abertas também sem login (Dúvidas): um 401 aqui só significa "visitante". */
export function useOptionalMe() {
  return useQuery({
    queryKey: ["me", "optional"],
    queryFn: async () => {
      try {
        return await publicApi.get<Profile>("/me");
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
}
