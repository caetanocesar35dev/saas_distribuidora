"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  MessageResponse,
  NotificationBody,
  Paginated,
  PlanBody,
  PlatformNotification,
  PlatformOrganization,
  PlatformOrganizationRow,
  PlatformPlan,
  PlatformUser,
  SubscriptionStatus,
  UpdateOrganizationBody,
} from "@/lib/api/types";

export const platformKeys = {
  plans: ["platform", "plans"] as const,
  organizations: ["platform", "organizations"] as const,
  users: ["platform", "users"] as const,
  notifications: ["platform", "notifications"] as const,
};

// ---- Planos ----------------------------------------------------------------------------------

export function usePlatformPlans() {
  return useQuery({
    queryKey: platformKeys.plans,
    queryFn: () => api.get<PlatformPlan[]>("/platform/plans"),
  });
}

export function useSavePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<PlanBody> }) =>
      id
        ? api.patch<PlatformPlan>(`/platform/plans/${id}`, body)
        : api.post<PlatformPlan>("/platform/plans", body),
    onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.plans }),
  });
}

export function useDeletePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<MessageResponse>(`/platform/plans/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.plans }),
  });
}

// ---- Organizações ----------------------------------------------------------------------------

export interface PlatformOrganizationsQuery {
  page: number;
  limit?: number;
  status?: SubscriptionStatus;
  planId?: string;
  search?: string;
}

export function usePlatformOrganizations(query: PlatformOrganizationsQuery) {
  return useQuery({
    queryKey: [...platformKeys.organizations, "list", query],
    queryFn: () =>
      api.get<Paginated<PlatformOrganizationRow>>("/platform/organizations", { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformOrganization(id: string) {
  return useQuery({
    queryKey: [...platformKeys.organizations, "detail", id],
    queryFn: () => api.get<PlatformOrganization>(`/platform/organizations/${id}`),
  });
}

/** Ajuste manual da assinatura: hoje é o jeito de regularizar (cortesia, suporte) sem o Asaas. */
export function useUpdateOrganization(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationBody) =>
      api.patch<PlatformOrganization>(`/platform/organizations/${id}`, body),
    onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

// ---- Usuários --------------------------------------------------------------------------------

export function usePlatformUsers(query: { page: number; limit?: number; search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: [...platformKeys.users, query],
    queryFn: () => api.get<Paginated<PlatformUser>>("/platform/users", { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useSetUserActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<PlatformUser>(`/platform/users/${id}/active`, { isActive }),
    onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.users }),
  });
}

// ---- Notificações ----------------------------------------------------------------------------

export function usePlatformNotifications(page: number) {
  return useQuery({
    queryKey: [...platformKeys.notifications, page],
    queryFn: () =>
      api.get<Paginated<PlatformNotification>>("/platform/notifications", { page, limit: 15 }),
    placeholderData: keepPreviousData,
  });
}

export function useSaveNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<NotificationBody> }) =>
      id
        ? api.patch<PlatformNotification>(`/platform/notifications/${id}`, body)
        : api.post<PlatformNotification>("/platform/notifications", body),
    onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.notifications }),
  });
}

export function useDeleteNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<MessageResponse>(`/platform/notifications/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.notifications }),
  });
}
