"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Notification, Paginated, UnreadCount } from "@/lib/api/types";

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: ["notifications", "unread-count"] as const,
  list: (params: { page: number; unread: boolean }) =>
    ["notifications", "list", params] as const,
};

/** Contador do sino. Recarrega a cada 2 minutos e ao voltar para a aba. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => api.get<UnreadCount>("/me/notifications/unread-count"),
    refetchInterval: 120_000,
    staleTime: 30_000,
  });
}

export function useNotifications(params: { page: number; unread: boolean; limit?: number }) {
  return useQuery({
    queryKey: notificationKeys.list({ page: params.page, unread: params.unread }),
    queryFn: () =>
      api.get<Paginated<Notification>>("/me/notifications", {
        page: params.page,
        limit: params.limit ?? 20,
        unread: params.unread ? true : undefined,
      }),
  });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/me/notifications/${id}/read`),
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
