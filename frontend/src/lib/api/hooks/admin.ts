"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, companyApi } from "@/lib/api/client";
import type {
  Company,
  CreateCompanyBody,
  InviteMemberBody,
  InviteMemberResponse,
  Member,
  MessageResponse,
  OrganizationSummary,
  Role,
  Store,
  StoreBody,
  UpdateCompanyBody,
} from "@/lib/api/types";
import { sessionKeys } from "@/lib/session/queries";

export const adminKeys = {
  company: (companyId: string) => ["company", companyId] as const,
  stores: (companyId: string) => ["company", companyId, "stores"] as const,
  members: (companyId: string) => ["company", companyId, "members"] as const,
  organizations: ["organizations", "mine"] as const,
};

/** Mudou loja ou equipe: o seletor de lojas e os papéis (memberships) precisam ser recarregados. */
function useRefreshAccess() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: sessionKeys.memberships });
}

// ---- Empresa ---------------------------------------------------------------------------------

export function useCompanyData(companyId: string) {
  return useQuery({
    queryKey: adminKeys.company(companyId),
    queryFn: () => companyApi(companyId).get<Company>(""),
  });
}

export function useUpdateCompany(companyId: string) {
  const client = useQueryClient();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: (body: UpdateCompanyBody) => companyApi(companyId).patch<Company>("", body),
    onSuccess: (company) => {
      client.setQueryData(adminKeys.company(companyId), company);
      return refresh();
    },
  });
}

// ---- Lojas -----------------------------------------------------------------------------------

export function useStores(companyId: string) {
  return useQuery({
    queryKey: adminKeys.stores(companyId),
    queryFn: () => companyApi(companyId).get<Store[]>("/stores"),
  });
}

export function useSaveStore(companyId: string) {
  const client = useQueryClient();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<StoreBody> }) =>
      id
        ? companyApi(companyId).patch<Store>(`/stores/${id}`, body)
        : companyApi(companyId).post<Store>("/stores", body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.stores(companyId) });
      await refresh();
    },
  });
}

export function useDeleteStore(companyId: string) {
  const client = useQueryClient();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: (id: string) => companyApi(companyId).delete<MessageResponse>(`/stores/${id}`),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.stores(companyId) });
      await refresh();
    },
  });
}

// ---- Equipe ----------------------------------------------------------------------------------

export function useMembers(companyId: string) {
  return useQuery({
    queryKey: adminKeys.members(companyId),
    queryFn: () => companyApi(companyId).get<Member[]>("/members"),
  });
}

export function useInviteMember(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: InviteMemberBody) =>
      companyApi(companyId).post<InviteMemberResponse>("/members", body),
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.members(companyId) }),
  });
}

export function useSetMemberRole(companyId: string) {
  const client = useQueryClient();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: (v: { membershipId: string; storeId: string; role: Role }) =>
      companyApi(companyId).put<MessageResponse>(
        `/members/${v.membershipId}/stores/${v.storeId}`,
        { role: v.role },
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.members(companyId) });
      await refresh();
    },
  });
}

export function useRevokeMemberStore(companyId: string) {
  const client = useQueryClient();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: (v: { membershipId: string; storeId: string }) =>
      companyApi(companyId).delete<MessageResponse>(
        `/members/${v.membershipId}/stores/${v.storeId}`,
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.members(companyId) });
      await refresh();
    },
  });
}

export function useRemoveMember(companyId: string) {
  const client = useQueryClient();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: (membershipId: string) =>
      companyApi(companyId).delete<MessageResponse>(`/members/${membershipId}`),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.members(companyId) });
      await refresh();
    },
  });
}

// ---- Organização -----------------------------------------------------------------------------

export function useOrganizations() {
  return useQuery({
    queryKey: adminKeys.organizations,
    queryFn: () => api.get<OrganizationSummary[]>("/organizations/mine"),
  });
}

export function useCreateCompany(organizationId: string) {
  const client = useQueryClient();
  const refresh = useRefreshAccess();
  return useMutation({
    mutationFn: (body: CreateCompanyBody) =>
      api.post<{ company: Company; store: Store }>(
        `/organizations/${organizationId}/companies`,
        body,
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.organizations });
      await refresh();
    },
  });
}
