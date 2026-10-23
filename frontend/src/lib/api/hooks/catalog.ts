"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyApi, storeApi } from "@/lib/api/client";
import type {
  AddStoreProductBody,
  BottleType,
  CreateProductBody,
  MessageResponse,
  Paginated,
  Product,
  ProductDetail,
  StoreProduct,
  UpdateProductBody,
  UpdateStoreProductBody,
} from "@/lib/api/types";

export const catalogKeys = {
  storeProducts: (storeId: string) => ["store", storeId, "store-products"] as const,
  products: (companyId: string) => ["company", companyId, "products"] as const,
  bottleTypes: (companyId: string) => ["company", companyId, "bottle-types"] as const,
};

// ---- Produtos da loja (oferta + estoque) -----------------------------------------------------

export interface StoreProductsParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export function useStoreProducts(storeId: string, params: StoreProductsParams = {}) {
  return useQuery({
    queryKey: [...catalogKeys.storeProducts(storeId), "list", params],
    queryFn: () =>
      storeApi(storeId).get<Paginated<StoreProduct>>("/store-products", {
        search: params.search,
        isActive: params.isActive,
        page: params.page,
        limit: params.limit,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useLowStock(storeId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...catalogKeys.storeProducts(storeId), "low-stock"],
    queryFn: () => storeApi(storeId).get<StoreProduct[]>("/store-products/low-stock"),
    enabled,
  });
}

function useInvalidateStock(storeId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: catalogKeys.storeProducts(storeId) });
}

export function useAddStoreProduct(storeId: string) {
  const invalidate = useInvalidateStock(storeId);
  return useMutation({
    mutationFn: (body: AddStoreProductBody) =>
      storeApi(storeId).post<StoreProduct>("/store-products", body),
    onSuccess: invalidate,
  });
}

export function useUpdateStoreProduct(storeId: string) {
  const invalidate = useInvalidateStock(storeId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStoreProductBody }) =>
      storeApi(storeId).patch<StoreProduct>(`/store-products/${id}`, body),
    onSuccess: invalidate,
  });
}

export function useRemoveStoreProduct(storeId: string) {
  const invalidate = useInvalidateStock(storeId);
  return useMutation({
    mutationFn: (id: string) =>
      storeApi(storeId).delete<MessageResponse>(`/store-products/${id}`),
    onSuccess: invalidate,
  });
}

/** Entrada de mercadoria: soma ao estoque. */
export function useStockEntry(storeId: string) {
  const invalidate = useInvalidateStock(storeId);
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      storeApi(storeId).post<StoreProduct>(`/store-products/${id}/stock-entries`, { quantity }),
    onSuccess: invalidate,
  });
}

/** Ajuste de inventário: define o estoque contado, com motivo. */
export function useStockAdjustment(storeId: string) {
  const invalidate = useInvalidateStock(storeId);
  return useMutation({
    mutationFn: ({ id, newStock, reason }: { id: string; newStock: number; reason: string }) =>
      storeApi(storeId).post<StoreProduct>(`/store-products/${id}/stock-adjustments`, {
        newStock,
        reason,
      }),
    onSuccess: invalidate,
  });
}

// ---- Catálogo da empresa ---------------------------------------------------------------------

export function useProducts(
  companyId: string,
  params: { search?: string; page?: number; limit?: number } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: [...catalogKeys.products(companyId), "list", params],
    queryFn: () => companyApi(companyId).get<Paginated<Product>>("/products", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProduct(companyId: string, id: string | null) {
  return useQuery({
    queryKey: [...catalogKeys.products(companyId), "detail", id],
    queryFn: () => companyApi(companyId).get<ProductDetail>(`/products/${id}`),
    enabled: id !== null,
  });
}

function useInvalidateProducts(companyId: string, storeId?: string) {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: catalogKeys.products(companyId) });
    if (storeId) {
      await client.invalidateQueries({ queryKey: catalogKeys.storeProducts(storeId) });
    }
  };
}

export function useCreateProduct(companyId: string, storeId: string) {
  const invalidate = useInvalidateProducts(companyId, storeId);
  return useMutation({
    mutationFn: (body: CreateProductBody) => companyApi(companyId).post<Product>("/products", body),
    meta: { silent: true },
    onSuccess: invalidate,
  });
}

export function useUpdateProduct(companyId: string, storeId: string) {
  const invalidate = useInvalidateProducts(companyId, storeId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductBody }) =>
      companyApi(companyId).patch<Product>(`/products/${id}`, body),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct(companyId: string, storeId: string) {
  const invalidate = useInvalidateProducts(companyId, storeId);
  return useMutation({
    mutationFn: (id: string) => companyApi(companyId).delete<MessageResponse>(`/products/${id}`),
    onSuccess: invalidate,
  });
}

export function useRestoreProduct(companyId: string, storeId: string) {
  const invalidate = useInvalidateProducts(companyId, storeId);
  return useMutation({
    mutationFn: (id: string) =>
      companyApi(companyId).post<ProductDetail>(`/products/${id}/restore`),
    onSuccess: invalidate,
  });
}

// ---- Tipos de vasilhame ----------------------------------------------------------------------

export function useBottleTypes(companyId: string) {
  return useQuery({
    queryKey: catalogKeys.bottleTypes(companyId),
    queryFn: () => companyApi(companyId).get<BottleType[]>("/bottle-types"),
    staleTime: 60_000,
  });
}

export function useSaveBottleType(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) =>
      id
        ? companyApi(companyId).patch<BottleType>(`/bottle-types/${id}`, { name })
        : companyApi(companyId).post<BottleType>("/bottle-types", { name }),
    meta: { silent: true },
    onSuccess: () => client.invalidateQueries({ queryKey: catalogKeys.bottleTypes(companyId) }),
  });
}

export function useDeleteBottleType(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      companyApi(companyId).delete<MessageResponse>(`/bottle-types/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: catalogKeys.bottleTypes(companyId) }),
  });
}

export function useRestoreBottleType(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      companyApi(companyId).post<BottleType>(`/bottle-types/${id}/restore`),
    onSuccess: () => client.invalidateQueries({ queryKey: catalogKeys.bottleTypes(companyId) }),
  });
}

/**
 * Códigos e nomes de itens excluídos continuam reservados; o 409 do backend traz o id do item
 * excluído na mensagem ("...(id xxxxxxxx-...). Reative-o..."). Daí dá para oferecer "Reativar".
 */
export function extractRestorableId(message: string): string | null {
  if (!/reative/i.test(message)) return null;
  const match = message.match(/id ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1] : null;
}
