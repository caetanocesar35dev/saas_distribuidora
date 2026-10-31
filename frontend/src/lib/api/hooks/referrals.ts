"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  MessageResponse,
  OrganizationReferral,
  Paginated,
  PlatformReferral,
  ReferralStatus,
  ReferralSummary,
  RepresentativeBody,
  SalesRepresentative,
} from "@/lib/api/types";

export const referralKeys = {
  organization: (organizationId: string) => ["referral", organizationId] as const,
  // Tudo da plataforma embaixo de uma chave: qualquer mudança recarrega listas e painel.
  platform: ["platform", "referrals"] as const,
  representatives: ["platform", "referrals", "representatives"] as const,
};

// ---- Responsável pela assinatura ---------------------------------------------------------------

/** "Indique e ganhe": código, indicações feitas e meses de desconto. */
export function useOrganizationReferral(organizationId: string | undefined) {
  return useQuery({
    queryKey: referralKeys.organization(organizationId ?? ""),
    queryFn: () => api.get<OrganizationReferral>(`/organizations/${organizationId}/referral`),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
  });
}

// ---- Plataforma ------------------------------------------------------------------------------

export function useRepresentatives(deleted = false, enabled = true) {
  return useQuery({
    queryKey: [...referralKeys.representatives, { deleted }],
    queryFn: () => api.get<SalesRepresentative[]>("/platform/representatives", { deleted }),
    enabled,
  });
}

export function useSaveRepresentative() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<RepresentativeBody> }) =>
      id
        ? api.patch<SalesRepresentative>(`/platform/representatives/${id}`, body)
        : api.post<SalesRepresentative>("/platform/representatives", body),
    onSuccess: () => client.invalidateQueries({ queryKey: referralKeys.platform }),
  });
}

export function useDeleteRepresentative() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<MessageResponse>(`/platform/representatives/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: referralKeys.platform }),
  });
}

export function useRestoreRepresentative() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<SalesRepresentative>(`/platform/representatives/${id}/restore`),
    onSuccess: () => client.invalidateQueries({ queryKey: referralKeys.platform }),
  });
}

export interface PlatformReferralsQuery {
  page: number;
  limit?: number;
  status?: ReferralStatus;
  source?: "CUSTOMER" | "REPRESENTATIVE";
  representativeId?: string;
  commission?: "TO_PAY" | "PAID";
  search?: string;
}

export function usePlatformReferrals(query: PlatformReferralsQuery) {
  return useQuery({
    queryKey: [...referralKeys.platform, "list", query],
    queryFn: () => api.get<Paginated<PlatformReferral>>("/platform/referrals", { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useReferralSummary() {
  return useQuery({
    queryKey: [...referralKeys.platform, "summary"],
    queryFn: () => api.get<ReferralSummary>("/platform/referrals/summary"),
  });
}

/** "Pix enviado" para o representante. */
export function useMarkCommissionPaid() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post<PlatformReferral>(`/platform/referrals/${id}/commission-paid`, { note }),
    onSuccess: () => client.invalidateQueries({ queryKey: referralKeys.platform }),
  });
}

export function useCancelReferral() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<PlatformReferral>(`/platform/referrals/${id}/cancel`, { reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: referralKeys.platform }),
  });
}
