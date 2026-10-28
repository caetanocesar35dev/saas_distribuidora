"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingRows, Money } from "@/components/app/common";
import { Pagination } from "@/components/app/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCashHistory } from "@/lib/api/hooks/cash";
import { formatDateTime } from "@/lib/format";
import { useStore } from "@/lib/session/context";

export function CashHistory() {
  const { storeId } = useStore();
  const [page, setPage] = useState(1);
  const history = useCashHistory(storeId, page);

  if (history.isPending) return <LoadingRows />;
  if (history.isError) {
    return <ErrorState error={history.error} onRetry={() => void history.refetch()} />;
  }
  if (history.data.data.length === 0) {
    return <EmptyState title="Nenhum caixa fechado ainda" />;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aberto em</TableHead>
              <TableHead>Fechado em</TableHead>
              <TableHead className="text-right">Saldo inicial</TableHead>
              <TableHead className="text-right">Saldo final</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(r.openedAt)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.closedAt ? formatDateTime(r.closedAt) : "—"}
                  {r.autoClosed && (
                    <Badge
                      variant="outline"
                      className="ml-1.5"
                      title="O caixa tinha ficado aberto e fechou sozinho no horário da loja."
                    >
                      automático
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={r.initialBalance} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={r.finalBalance} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/loja/${storeId}/caixa/${r.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver detalhes
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination meta={history.data.meta} onPageChange={setPage} />
    </div>
  );
}
