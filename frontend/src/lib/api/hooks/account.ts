"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, publicApi } from "@/lib/api/client";
import type { AuthResponse, ChangePasswordBody, Profile } from "@/lib/api/types";
import { sessionKeys } from "@/lib/session/queries";

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; phone?: string }) => api.patch<Profile>("/me", body),
    onSuccess: (profile) => client.setQueryData(sessionKeys.me, profile),
  });
}

/** A troca de senha encerra as outras sessões; o BFF já guarda o par novo de tokens deste aparelho. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordBody) =>
      api.post<AuthResponse>("/auth/change-password", body),
    meta: { silent: true },
  });
}

export { publicApi };
