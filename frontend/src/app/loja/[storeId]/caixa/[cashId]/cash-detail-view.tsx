"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { MovementsTable, PaymentSummaryTable } from "@/components/app/cash-parts";
import { Money, PageHeader, QueryBoundary, StatCard } from "@/components/app/common";
import { HistoryButton } from "@/components/app/history-dialog";
import { useCashDetail } from "@/lib/api/hooks/cash";
import { formatDateTime } from "@/lib/format";
import { useStore } from "@/lib/session/context";

export function CashDetailView({ cashId }: { cashId: string }) {
  const { storeId } = useStore();
  const detail = useCashDetail(storeId, cashId);

  return (
    <div className="space-y-5">
      <Link
        href={`/loja/${storeId}/caixa`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" /> Caixa
      </Link>
      <PageHeader
        title="Detalhe do caixa"
        help="caixa-anteriores"
        actions={
          <HistoryButton
            target={{ scope: "store", scopeId: storeId, entity: "cash-registers", id: cashId }}
            title="Histórico de alterações deste caixa"
          />
        }
      />
      <QueryBoundary query={detail}>
        {(cash) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Aberto em" value={formatDateTime(cash.openedAt)} />
              <StatCard label="Fechado em" value={cash.closedAt ? formatDateTime(cash.closedAt) : "Aberto"} />
              <StatCard label="Saldo inicial" value={<Money value={cash.initialBalance} />} />
              <StatCard
                label={cash.status === "OPEN" ? "Saldo atual" : "Saldo final"}
                value={<Money value={cash.status === "OPEN" ? cash.currentBalance : cash.finalBalance} />}
              />
            </div>
            <section>
              <h2 className="mb-2 font-medium">Vendas por forma de pagamento</h2>
              <PaymentSummaryTable summary={cash.summary} />
            </section>
            <section>
              <h2 className="mb-2 font-medium">Movimentações</h2>
              <MovementsTable movements={cash.movements} />
            </section>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
