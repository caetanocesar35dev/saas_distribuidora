"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyApi, storeApi } from "@/lib/api/client";
import type {
  BottleMovement,
  BottleMovementsQuery,
  BottleStockLine,
  CustomerBottleBody,
  ManualBottleMovementBody,
  MessageResponse,
  Paginated,
  StoreBottlePriceBody,
  Supplier,
  SupplierBottleBalance,
} from "@/lib/api/types";

export const bottleKeys = {
  all: (storeId: string) => ["store", storeId, "bottles"] as const,
  stock: (storeId: string) => ["store", storeId, "bottles", "stock"] as const,
  movements: (storeId: string) => ["store", storeId, "bottles", "movements"] as const,
  supplierBalances: (storeId: string) =>
    ["store", storeId, "bottles", "supplier-balances"] as const,
};

export const supplierKeys = {
  all: (companyId: string) => ["company", companyId, "suppliers"] as const,
};

/** Saldo de cascos com cada fornecedor nesta loja (recebidos − enviados). */
export function useSupplierBottleBalances(storeId: string) {
  return useQuery({
    queryKey: bottleKeys.supplierBalances(storeId),
    queryFn: () =>
      storeApi(storeId).get<SupplierBottleBalance[]>("/supplier-bottle-balances"),
  });
}

/** Fornecedores da empresa, por nome. `deleted` lista só os excluídos. */
export function useSuppliers(companyId: string, deleted = false) {
  return useQuery({
    queryKey: [...supplierKeys.all(companyId), { deleted }],
    queryFn: () =>
      companyApi(companyId).get<Supplier[]>("/suppliers", { deleted: deleted || undefined }),
    staleTime: 60_000,
  });
}

/** Renomear muda o nome nas movimentações e no saldo: recarrega os vasilhames também. */
function useInvalidateSuppliers(companyId: string) {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: supplierKeys.all(companyId) });
    await client.invalidateQueries({
      predicate: (q) => q.queryKey[0] === "store" && q.queryKey[2] === "bottles",
    });
  };
}

export function useSaveSupplier(companyId: string) {
  const invalidate = useInvalidateSuppliers(companyId);
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) =>
      id
        ? companyApi(companyId).patch<Supplier>(`/suppliers/${id}`, { name })
        : companyApi(companyId).post<Supplier>("/suppliers", { name }),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useDeleteSupplier(companyId: string) {
  const invalidate = useInvalidateSuppliers(companyId);
  return useMutation({
    mutationFn: (id: string) => companyApi(companyId).delete<MessageResponse>(`/suppliers/${id}`),
    onSuccess: invalidate,
  });
}

export function useRestoreSupplier(companyId: string) {
  const invalidate = useInvalidateSuppliers(companyId);
  return useMutation({
    mutationFn: (id: string) => companyApi(companyId).post<Supplier>(`/suppliers/${id}/restore`),
    onSuccess: invalidate,
  });
}

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

/** Preço próprio do casco nesta loja (`null` = vale o da empresa). Gerente ou dono. */
export function useSetStoreBottlePrice(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ bottleTypeId, ...body }: StoreBottlePriceBody & { bottleTypeId: string }) =>
      storeApi(storeId).put<BottleStockLine>(`/bottle-types/${bottleTypeId}/price`, body),
    onSuccess: () => client.invalidateQueries({ queryKey: bottleKeys.stock(storeId) }),
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
