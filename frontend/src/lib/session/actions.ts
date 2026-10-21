"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, publicApi } from "@/lib/api/client";
import type { MessageResponse } from "@/lib/api/types";
import { clearLastSelection } from "./last-selection";

function leave() {
  // Navegação completa: zera o estado em memória (cache, formulários) e passa pelo proxy de páginas.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa de propósito: zera o cache e o estado em memória
  window.location.href = "/login";
}

/** Sair deste aparelho. */
export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => publicApi.post<MessageResponse>("/auth/logout"),
    meta: { silent: true },
    onSettled: () => {
      client.clear();
      clearLastSelection();
      leave();
    },
  });
}

/** Sair de todos os aparelhos. */
export function useLogoutAll() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MessageResponse>("/auth/logout-all"),
    onSuccess: () => {
      client.clear();
      clearLastSelection();
      leave();
    },
  });
}
