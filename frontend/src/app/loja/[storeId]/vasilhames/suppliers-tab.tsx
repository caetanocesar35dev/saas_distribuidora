"use client";

import { EmptyState, QueryBoundary } from "@/components/app/common";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSupplierBottleBalances } from "@/lib/api/hooks/bottles";
import { formatInt } from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { supplierBalanceText } from "@/lib/supplier-balance";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  owe: "text-destructive",
  owed: "text-emerald-700",
  even: "text-muted-foreground",
} as const;

/**
 * Saldo de cascos com cada fornecedor nesta loja: recebidos − enviados, por tipo de vasilhame. Só
 * conta o envio e o recebimento em que o fornecedor foi escolhido.
 */
export function SuppliersTab() {
  const { storeId } = useStore();
  const balances = useSupplierBottleBalances(storeId);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Quantos cascos esta loja recebeu e enviou para cada fornecedor. Só entram o envio e o
        recebimento em que o fornecedor foi escolhido.
      </p>
      <QueryBoundary query={balances}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title="Nenhuma troca com fornecedor registrada"
              description="Ao enviar ou receber vasilhames, escolha o fornecedor para ver o saldo aqui."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Vasilhame</TableHead>
                    <TableHead className="text-right">Recebidos</TableHead>
                    <TableHead className="text-right">Enviados</TableHead>
                    <TableHead>Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.flatMap((s) =>
                    s.bottleTypes.map((t, i) => {
                      const saldo = supplierBalanceText(t.balance);
                      return (
                        <TableRow key={`${s.supplierId}:${t.bottleTypeId}`}>
                          <TableCell className="font-medium">
                            {i === 0 && (
                              <span className="flex items-center gap-2">
                                {s.supplierName}
                                {s.deleted && <Badge variant="outline">Excluído</Badge>}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{t.bottleTypeName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatInt(t.received)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatInt(t.sent)}
                          </TableCell>
                          <TableCell className={cn("font-medium", TONE_CLASS[saldo.tone])}>
                            {saldo.text}
                          </TableCell>
                        </TableRow>
                      );
                    }),
                  )}
                </TableBody>
              </Table>
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
