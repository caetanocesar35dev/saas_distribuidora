"use client";

import { useQuery } from "@tanstack/react-query";
import { companyApi, storeApi } from "@/lib/api/client";
import type { Dashboard } from "@/lib/api/types";

/** Os períodos (hoje, 7 dias, mês) são fixos e calculados no backend. */
export function useStoreDashboard(storeId: string, enabled = true) {
  return useQuery({
    queryKey: ["dashboard", "store", storeId],
    queryFn: () => storeApi(storeId).get<Dashboard>("/dashboard"),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useCompanyDashboard(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ["dashboard", "company", companyId],
    queryFn: () => companyApi(companyId).get<Dashboard>("/dashboard"),
    enabled,
    refetchInterval: 60_000,
  });
}
