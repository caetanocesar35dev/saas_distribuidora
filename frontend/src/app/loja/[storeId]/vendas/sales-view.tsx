"use client";

import Link from "next/link";
import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Money,
  PageHeader,
  StatCard,
} from "@/components/app/common";
import { RequireRole } from "@/components/app/guards";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounced } from "@/hooks/use-debounced";
import { useSales } from "@/lib/api/hooks/sales";
import type { PaymentMethod, SaleStatus } from "@/lib/api/types";
import {
  formatDateTime,
  formatInt,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  SALE_STATUS_LABEL,
  todayString,
} from "@/lib/format";
import { useStore } from "@/lib/session/context";

const ALL = "all";

export function SalesView() {
  const { storeId } = useStore();
  const today = todayString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [method, setMethod] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const sales = useSales(storeId, {
    page,
    limit: 20,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    paymentMethod: method === ALL ? undefined : (method as PaymentMethod),
    status: status === ALL ? undefined : (status as SaleStatus),
    search: debouncedSearch.trim() || undefined,
  });

  function change<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      <PageHeader
        title="Histórico de vendas"
        description="Histórico de vendas desta loja. Por padrão, as de hoje."
        help="vendas-historico"
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          De
          <Input
            type="date"
            className="w-40"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => change(setStartDate)(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          até
          <Input
            type="date"
            className="w-40"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => change(setEndDate)(e.target.value)}
          />
        </label>
        <SelectField
          className="w-48"
          value={method}
          onChange={change(setMethod)}
          options={[
            { value: ALL, label: "Todas as formas de pagamento" },
            ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] })),
          ]}
        />
        <SelectField
          className="w-40"
          value={status}
          onChange={change(setStatus)}
          options={[
            { value: ALL, label: "Todas as situações" },
            { value: "COMPLETED", label: SALE_STATUS_LABEL.COMPLETED },
            { value: "CANCELED", label: SALE_STATUS_LABEL.CANCELED },
          ]}
        />
        <Input
          className="w-44"
          placeholder="Nº da venda"
          value={search}
          onChange={(e) => change(setSearch)(e.target.value)}
          aria-label="Buscar pelo número da venda"
        />
      </div>

      {sales.isPending ? (
        <LoadingRows />
      ) : sales.isError ? (
        <ErrorState error={sales.error} onRetry={() => void sales.refetch()} />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Faturamento (vendas concluídas)"
              value={<Money value={sales.data.meta.totalRevenue} />}
            />
            <RequireRole min="MANAGER">
              <StatCard
                label="Lucro"
                value={<Money value={sales.data.meta.totalProfit} />}
                tone="success"
              />
            </RequireRole>
            <StatCard label="Vendas encontradas" value={formatInt(sales.data.meta.totalItems)} />
          </div>

          {sales.data.data.length === 0 ? (
            <EmptyState
              title="Nenhuma venda encontrada"
              description="Mude o período ou os filtros."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venda</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.data.data.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <Link
                            href={`/loja/${storeId}/vendas/${sale.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            #{sale.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(sale.createdAt)}
                          {sale.registeredAt && (
                            <Badge
                              variant="outline"
                              className="ml-1.5"
                              title={`Lançada em ${formatDateTime(sale.registeredAt)}`}
                            >
                              lançada depois
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{sale.customer?.name ?? "—"}</TableCell>
                        <TableCell>{sale.user.name}</TableCell>
                        <TableCell>{PAYMENT_METHOD_LABEL[sale.paymentMethod]}</TableCell>
                        <TableCell className="text-right">
                          <Money value={sale.total} />
                        </TableCell>
                        <TableCell>
                          {sale.status === "CANCELED" ? (
                            <Badge variant="destructive">{SALE_STATUS_LABEL.CANCELED}</Badge>
                          ) : (
                            <Badge variant="secondary">{SALE_STATUS_LABEL.COMPLETED}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination meta={sales.data.meta} onPageChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
