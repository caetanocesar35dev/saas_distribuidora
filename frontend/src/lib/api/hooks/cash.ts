"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storeApi } from "@/lib/api/client";
import type {
  CashMovement,
  CashMovementBody,
  CashRegister,
  CashRegisterDetail,
  CloseCashResponse,
  CurrentCashRegister,
  Paginated,
} from "@/lib/api/types";

export const cashKeys = {
  all: (storeId: string) => ["store", storeId, "cash"] as const,
  current: (storeId: string) => ["store", storeId, "cash", "current"] as const,
  history: (storeId: string, page: number) => ["store", storeId, "cash", "history", page] as const,
  detail: (storeId: string, id: string) => ["store", storeId, "cash", "detail", id] as const,
};

/** Caixa aberto da loja, ou `null` quando está fechado. */
export function useCurrentCash(storeId: string) {
  return useQuery({
    queryKey: cashKeys.current(storeId),
    queryFn: async () =>
      (await storeApi(storeId).get<CurrentCashRegister | null>("/cash-register/current")) ?? null,
    refetchInterval: 60_000,
  });
}

export function useCashHistory(storeId: string, page: number) {
  return useQuery({
    queryKey: cashKeys.history(storeId, page),
    queryFn: () =>
      storeApi(storeId).get<Paginated<CashRegister>>("/cash-register/history", { page, limit: 15 }),
    placeholderData: keepPreviousData,
  });
}

export function useCashDetail(storeId: string, id: string) {
  return useQuery({
    queryKey: cashKeys.detail(storeId, id),
    queryFn: () => storeApi(storeId).get<CashRegisterDetail>(`/cash-register/${id}`),
  });
}

export function useOpenCash(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (initialBalance: number) =>
      storeApi(storeId).post<CashRegister>("/cash-register/open", { initialBalance }),
    onSuccess: () => client.invalidateQueries({ queryKey: cashKeys.all(storeId) }),
  });
}

export function useCashMovement(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CashMovementBody) =>
      storeApi(storeId).post<CashMovement>("/cash-register/movements", body),
    onSuccess: () => client.invalidateQueries({ queryKey: cashKeys.all(storeId) }),
  });
}

/** Fechar o caixa já aberto continua liberado mesmo com a assinatura em somente leitura. */
export function useCloseCash(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => storeApi(storeId).post<CloseCashResponse>("/cash-register/close"),
    onSuccess: () => client.invalidateQueries({ queryKey: cashKeys.all(storeId) }),
  });
}
