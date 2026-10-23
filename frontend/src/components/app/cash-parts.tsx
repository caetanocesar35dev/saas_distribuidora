"use client";

import { Money } from "@/components/app/common";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashMovement, CashMovementType, PaymentSummaryLine } from "@/lib/api/types";
import { formatDateTime, formatInt, PAYMENT_METHOD_LABEL, roundMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const MOVEMENT_LABEL: Record<CashMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  SALE: "Venda",
};

/**
 * Resumo das vendas do período por forma de pagamento. O movimento do caixa não separa dinheiro de
 * PIX e cartão, então a conferência do caixa usa este resumo.
 */
export function PaymentSummaryTable({ summary }: { summary: PaymentSummaryLine[] }) {
  if (summary.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma venda concluída no período.</p>;
  }
  const total = roundMoney(summary.reduce((sum, l) => sum + l.total, 0));
  const count = summary.reduce((sum, l) => sum + l.count, 0);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Forma de pagamento</TableHead>
            <TableHead className="text-right">Vendas</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.map((line) => (
            <TableRow key={line.paymentMethod}>
              <TableCell>{PAYMENT_METHOD_LABEL[line.paymentMethod]}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(line.count)}</TableCell>
              <TableCell className="text-right">
                <Money value={line.total} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-medium">Total</TableCell>
            <TableCell className="text-right tabular-nums">{formatInt(count)}</TableCell>
            <TableCell className="text-right font-medium">
              <Money value={total} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export function MovementsTable({ movements }: { movements: CashMovement[] }) {
  if (movements.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
              <TableCell>{MOVEMENT_LABEL[m.type]}</TableCell>
              <TableCell className="max-w-72 truncate text-muted-foreground">
                {m.description ?? ""}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  m.type === "OUT" ? "text-destructive" : "text-emerald-700",
                )}
              >
                {m.type === "OUT" ? "- " : "+ "}
                <Money value={m.amount} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
