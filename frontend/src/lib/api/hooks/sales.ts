"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storeApi } from "@/lib/api/client";
import type {
  CloseCommandTabBody,
  CommandItem,
  CommandTab,
  CreateSaleBody,
  MessageResponse,
  Sale,
  SalesPage,
  SalesQuery,
  TabStatus,
} from "@/lib/api/types";
import { bottleKeys } from "./bottles";
import { cashKeys } from "./cash";
import { catalogKeys } from "./catalog";

export const salesKeys = {
  all: (storeId: string) => ["store", storeId, "sales"] as const,
  tabs: (storeId: string) => ["store", storeId, "command-tabs"] as const,
};

/** Uma venda mexe em estoque, caixa, fiado, vasilhames e painéis: recarrega tudo isso. */
function useRefreshAfterSale(storeId: string) {
  const client = useQueryClient();
  /**
   * `skipTabDetail`: ao cancelar a comanda, o detalhe dela deixa de existir. Recarregá-lo daria
   * 404, a tela viraria "não encontrada" e o redirecionamento da própria tela nunca aconteceria.
   */
  return async (options: { skipTabDetail?: boolean } = {}) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: salesKeys.all(storeId) }),
      client.invalidateQueries({
        queryKey: salesKeys.tabs(storeId),
        predicate: (query) => !(options.skipTabDetail && query.queryKey[3] === "detail"),
      }),
      client.invalidateQueries({ queryKey: catalogKeys.storeProducts(storeId) }),
      client.invalidateQueries({ queryKey: cashKeys.all(storeId) }),
      client.invalidateQueries({ queryKey: bottleKeys.all(storeId) }),
      client.invalidateQueries({ queryKey: ["dashboard"] }),
      client.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };
}

// ---- Vendas ----------------------------------------------------------------------------------

export function useCreateSale(storeId: string) {
  const refresh = useRefreshAfterSale(storeId);
  return useMutation({
    mutationFn: (body: CreateSaleBody) => storeApi(storeId).post<Sale>("/sales", body),
    // Falha (ex.: estoque insuficiente) é tratada na tela do PDV, que mantém o carrinho.
    meta: { silent: true },
    onSettled: () => refresh(),
  });
}

export function useSales(storeId: string, query: SalesQuery) {
  return useQuery({
    queryKey: [...salesKeys.all(storeId), "list", query],
    queryFn: () => storeApi(storeId).get<SalesPage>("/sales", { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useSale(storeId: string, id: string) {
  return useQuery({
    queryKey: [...salesKeys.all(storeId), "detail", id],
    queryFn: () => storeApi(storeId).get<Sale>(`/sales/${id}`),
  });
}

/** Cancelar devolve estoque, estorna caixa ou fiado e desfaz os vasilhames. Exige caixa aberto. */
export function useCancelSale(storeId: string) {
  const refresh = useRefreshAfterSale(storeId);
  return useMutation({
    mutationFn: (id: string) => storeApi(storeId).post<Sale>(`/sales/${id}/cancel`),
    onSuccess: () => refresh(),
  });
}

// ---- Comandas --------------------------------------------------------------------------------

export function useCommandTabs(storeId: string, status: TabStatus = "OPEN") {
  return useQuery({
    queryKey: [...salesKeys.tabs(storeId), "list", status],
    queryFn: () => storeApi(storeId).get<CommandTab[]>("/command-tabs", { status }),
    refetchInterval: 30_000,
  });
}

export function useCommandTab(storeId: string, id: string) {
  return useQuery({
    queryKey: [...salesKeys.tabs(storeId), "detail", id],
    queryFn: () => storeApi(storeId).get<CommandTab>(`/command-tabs/${id}`),
  });
}

export function useCreateCommandTab(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; customerId?: string }) =>
      storeApi(storeId).post<CommandTab>("/command-tabs", body),
    onSuccess: () => client.invalidateQueries({ queryKey: salesKeys.tabs(storeId) }),
  });
}

/** O estoque baixa ao adicionar o item (o produto sai da loja) e o preço fica fixo naquele momento. */
export function useAddTabItem(storeId: string, tabId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { storeProductId: string; quantity: number }) =>
      storeApi(storeId).post<CommandItem>(`/command-tabs/${tabId}/items`, body),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: salesKeys.tabs(storeId) });
      await client.invalidateQueries({ queryKey: catalogKeys.storeProducts(storeId) });
    },
  });
}

export function useRemoveTabItem(storeId: string, tabId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      storeApi(storeId).delete<MessageResponse>(`/command-tabs/${tabId}/items/${itemId}`),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: salesKeys.tabs(storeId) });
      await client.invalidateQueries({ queryKey: catalogKeys.storeProducts(storeId) });
    },
  });
}

export function useCloseCommandTab(storeId: string, tabId: string) {
  const refresh = useRefreshAfterSale(storeId);
  return useMutation({
    mutationFn: (body: CloseCommandTabBody) =>
      storeApi(storeId).post<Sale>(`/command-tabs/${tabId}/close`, body),
    meta: { silent: true },
    onSettled: () => refresh(),
  });
}

export function useCancelCommandTab(storeId: string, tabId: string) {
  const refresh = useRefreshAfterSale(storeId);
  return useMutation({
    mutationFn: () => storeApi(storeId).post<MessageResponse>(`/command-tabs/${tabId}/cancel`),
    onSuccess: () => refresh({ skipTabDetail: true }),
  });
}
