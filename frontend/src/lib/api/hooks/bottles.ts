"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storeApi } from "@/lib/api/client";
import type {
  BottleMovement,
  BottleMovementsQuery,
  BottleStockLine,
  CustomerBottleBody,
  ManualBottleMovementBody,
  Paginated,
} from "@/lib/api/types";

export const bottleKeys = {
  all: (storeId: string) => ["store", storeId, "bottles"] as const,
  stock: (storeId: string) => ["store", storeId, "bottles", "stock"] as const,
  movements: (storeId: string) => ["store", storeId, "bottles", "movements"] as const,
};

export function useBottleStock(storeId: string) {
  return useQuery({
    queryKey: bottleKeys.stock(storeId),
    queryFn: () => storeApi(storeId).get<BottleStockLine[]>("/bottle-stock"),
  });
}

export function useBottleMovements(storeId: string, query: BottleMovementsQuery) {
  return useQuery({
    queryKey: [...bottleKeys.movements(storeId), query],
    queryFn: () =>
      storeApi(storeId).get<Paginated<BottleMovement>>("/bottle-movements", { ...query }),
    placeholderData: keepPreviousData,
  });
}

/** Envio/recebimento do fornecedor e ajuste manual. O estoque de vasilhame só muda por movimentação. */
export function useRegisterBottleMovement(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualBottleMovementBody) =>
      storeApi(storeId).post<BottleMovement>("/bottle-movements", body),
    onSuccess: () => client.invalidateQueries({ queryKey: bottleKeys.all(storeId) }),
  });
}

function useCustomerBottle(storeId: string, action: "bottle-returns" | "bottle-loans") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, body }: { customerId: string; body: CustomerBottleBody }) =>
      storeApi(storeId).post<BottleMovement>(`/customers/${customerId}/${action}`, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: bottleKeys.all(storeId) });
      await client.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Devolução do cliente: só abate a dívida de vasilhame da própria loja. */
export const useCustomerBottleReturn = (storeId: string) =>
  useCustomerBottle(storeId, "bottle-returns");

/** Empréstimo avulso (fora de uma venda). */
export const useCustomerBottleLoan = (storeId: string) =>
  useCustomerBottle(storeId, "bottle-loans");
