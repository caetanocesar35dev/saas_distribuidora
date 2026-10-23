"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyApi, storeApi } from "@/lib/api/client";
import type {
  CreatePaymentBody,
  Customer,
  CustomerBalances,
  CustomerBody,
  CustomerListItem,
  CustomerPayment,
  MessageResponse,
  Paginated,
} from "@/lib/api/types";
import { bottleKeys } from "./bottles";
import { cashKeys } from "./cash";

// A chave começa por "customers" para a venda, o pagamento e a devolução poderem recarregar tudo
// de cliente de uma vez.
export const customerKeys = {
  all: ["customers"] as const,
  list: (companyId: string) => ["customers", companyId, "list"] as const,
  detail: (companyId: string, id: string) => ["customers", companyId, "detail", id] as const,
  balances: (companyId: string, id: string) => ["customers", companyId, "balances", id] as const,
  payments: (companyId: string, id: string) => ["customers", companyId, "payments", id] as const,
};

export function useCustomers(
  companyId: string,
  params: { search?: string; page?: number; limit?: number; withDebt?: boolean },
  enabled = true,
) {
  return useQuery({
    queryKey: [...customerKeys.list(companyId), params],
    queryFn: () => companyApi(companyId).get<Paginated<CustomerListItem>>("/customers", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCustomer(companyId: string, id: string) {
  return useQuery({
    queryKey: customerKeys.detail(companyId, id),
    queryFn: () => companyApi(companyId).get<Customer>(`/customers/${id}`),
  });
}

export function useSaveCustomer(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CustomerBody }) =>
      id
        ? companyApi(companyId).patch<Customer>(`/customers/${id}`, body)
        : companyApi(companyId).post<Customer>("/customers", body),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useDeleteCustomer(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companyApi(companyId).delete<MessageResponse>(`/customers/${id}`),
    // Só as listas: recarregar o detalhe do cliente excluído daria 404 antes de a tela sair dele.
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: customerKeys.all,
        predicate: (query) => query.queryKey[2] === "list",
      }),
  });
}

export function useRestoreCustomer(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companyApi(companyId).post<Customer>(`/customers/${id}/restore`),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

/** Funcionário só vê as lojas dele e recebe `total: null`. */
export function useCustomerBalances(companyId: string, id: string, enabled = true) {
  return useQuery({ ...customerBalancesQuery(companyId, id), enabled });
}

/** Mesma consulta, para buscar na hora com `queryClient.fetchQuery` (ex.: antes da venda fiada). */
export function customerBalancesQuery(companyId: string, id: string) {
  return {
    queryKey: customerKeys.balances(companyId, id),
    queryFn: () => companyApi(companyId).get<CustomerBalances>(`/customers/${id}/balances`),
  };
}

export function useCustomerPayments(companyId: string, id: string, page: number) {
  return useQuery({
    queryKey: [...customerKeys.payments(companyId, id), page],
    queryFn: () =>
      companyApi(companyId).get<Paginated<CustomerPayment>>(`/customers/${id}/payments`, {
        page,
        limit: 10,
      }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Recebe pagamento de fiado na loja ativa (o dinheiro entra no caixa dela). Sem `allocations` a
 * distribuição é automática; com elas, o valor é dividido entre as dívidas das lojas.
 */
export function usePayDebt(storeId: string, customerId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePaymentBody) =>
      storeApi(storeId).post<CustomerPayment>(`/customers/${customerId}/payments`, body),
    meta: { silent: true },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: customerKeys.all });
      await client.invalidateQueries({ queryKey: cashKeys.all(storeId) });
      await client.invalidateQueries({ queryKey: ["dashboard"] });
      await client.invalidateQueries({ queryKey: bottleKeys.all(storeId) });
    },
  });
}
