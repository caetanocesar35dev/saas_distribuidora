"use client";

import { useState } from "react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/common";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBottleMovements } from "@/lib/api/hooks/bottles";
import { useBottleTypes } from "@/lib/api/hooks/catalog";
import type { BottleMovementType } from "@/lib/api/types";
import {
  BOTTLE_MOVEMENT_LABEL,
  dayEndIso,
  dayStartIso,
  formatDateTime,
  formatInt,
} from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { cn } from "@/lib/utils";

const ALL = "all";

export function MovementsTab() {
  const { storeId, companyId } = useStore();
  const bottleTypes = useBottleTypes(companyId);
  const [type, setType] = useState<string>(ALL);
  const [bottleTypeId, setBottleTypeId] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const list = useBottleMovements(storeId, {
    page,
    limit: 20,
    type: type === ALL ? undefined : (type as BottleMovementType),
    bottleTypeId: bottleTypeId === ALL ? undefined : bottleTypeId,
    from: from ? dayStartIso(from) : undefined,
    to: to ? dayEndIso(to) : undefined,
  });

  function reset<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          className="w-52"
          value={type}
          onChange={reset(setType)}
          options={[
            { value: ALL, label: "Todos os tipos de movimento" },
            ...(Object.entries(BOTTLE_MOVEMENT_LABEL) as [BottleMovementType, string][]).map(
              ([value, label]) => ({ value, label }),
            ),
          ]}
        />
        <SelectField
          className="w-52"
          value={bottleTypeId}
          onChange={reset(setBottleTypeId)}
          options={[
            { value: ALL, label: "Todos os vasilhames" },
            ...(bottleTypes.data ?? []).map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          De
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => reset(setFrom)(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          até
          <Input
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => reset(setTo)(e.target.value)}
          />
        </label>
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nenhuma movimentação encontrada" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Movimento</TableHead>
                  <TableHead>Vasilhame</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell>{BOTTLE_MOVEMENT_LABEL[m.type]}</TableCell>
                    <TableCell>{m.bottleType.name}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        m.quantity < 0 ? "text-destructive" : "text-emerald-700",
                      )}
                    >
                      {m.quantity > 0 ? "+" : ""}
                      {formatInt(m.quantity)}
                    </TableCell>
                    <TableCell>{m.customer?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {m.description ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
