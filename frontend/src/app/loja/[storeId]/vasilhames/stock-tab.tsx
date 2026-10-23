"use client";

import { EmptyState, QueryBoundary } from "@/components/app/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBottleStock } from "@/lib/api/hooks/bottles";
import { formatInt } from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { cn } from "@/lib/utils";

export function StockTab() {
  const { storeId } = useStore();
  const stock = useBottleStock(storeId);

  return (
    <QueryBoundary query={stock}>
      {(lines) =>
        lines.length === 0 ? (
          <EmptyState
            title="Nenhum tipo de vasilhame cadastrado"
            description="Cadastre os tipos (ex.: Garrafa 600 ml, Caixa de cerveja) para controlar o estoque."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de vasilhame</TableHead>
                  <TableHead className="text-right">Na loja agora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.bottleTypeId}>
                    <TableCell className="font-medium">{line.bottleTypeName}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        line.stock < 0 && "font-semibold text-destructive",
                      )}
                    >
                      {formatInt(line.stock)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      }
    </QueryBoundary>
  );
}
