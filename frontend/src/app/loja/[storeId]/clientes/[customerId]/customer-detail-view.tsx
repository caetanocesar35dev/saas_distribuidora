"use client";

import { ArrowLeftIcon, BanknoteIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Money, PageHeader, QueryBoundary, StatCard } from "@/components/app/common";
import { ActionButton } from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { Pagination } from "@/components/app/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCustomer,
  useCustomerBalances,
  useCustomerPayments,
  useDeleteCustomer,
} from "@/lib/api/hooks/customers";
import { useCommandTabs, useSales } from "@/lib/api/hooks/sales";
import type { Customer, CustomerBalances } from "@/lib/api/types";
import {
  formatDateTime,
  formatInt,
  formatMoney,
  formatPhone,
  PAYMENT_METHOD_LABEL,
  roundMoney,
  SALE_STATUS_LABEL,
} from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { CustomerFormDialog } from "../customer-form-dialog";
import { BottleLoanDialog, BottleReturnDialog } from "./bottle-dialogs";
import { PayDialog } from "./pay-dialog";

function Balances({
  balances,
  activeStoreId,
}: {
  balances: CustomerBalances;
  activeStoreId: string;
}) {
  const debts = balances.perStore.filter((d) => d.balance !== 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {balances.total !== null && (
          <StatCard
            label="Dívida total (todas as lojas)"
            value={<Money value={balances.total} />}
            tone={balances.total > 0 ? "danger" : "default"}
          />
        )}
        <StatCard
          label="Dívida nesta loja"
          value={
            <Money
              value={balances.perStore.find((d) => d.storeId === activeStoreId)?.balance ?? 0}
            />
          }
        />
        <StatCard
          label="Limite de crédito no fiado"
          value={
            balances.creditLimit === null ? "Sem limite" : <Money value={balances.creditLimit} />
          }
          hint={
            balances.creditLimit !== null && balances.total !== null
              ? balances.total > balances.creditLimit
                ? `Passou do limite em ${formatMoney(roundMoney(balances.total - balances.creditLimit))}.`
                : `Disponível: ${formatMoney(roundMoney(balances.creditLimit - balances.total))}.`
              : "Gerente e dono definem em Editar."
          }
          tone={
            balances.creditLimit !== null &&
            balances.total !== null &&
            balances.total > balances.creditLimit
              ? "danger"
              : "default"
          }
        />
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium">Fiado por loja</h3>
        {debts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dívida em aberto.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-right">Deve</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((d) => (
                  <TableRow key={d.storeId}>
                    <TableCell>
                      {d.storeName}
                      {d.storeId === activeStoreId && (
                        <span className="ml-2 text-xs text-muted-foreground">(esta loja)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={d.balance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">Vasilhames que o cliente deve</h3>
        {balances.bottles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum vasilhame emprestado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Vasilhame</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.bottles.map((b) => (
                  <TableRow key={`${b.storeId}-${b.bottleTypeId}`}>
                    <TableCell>
                      {b.storeName}
                      {b.storeId === activeStoreId && (
                        <span className="ml-2 text-xs text-muted-foreground">(esta loja)</span>
                      )}
                    </TableCell>
                    <TableCell>{b.bottleTypeName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.balance < 0 ? `${formatInt(-b.balance)} a favor` : formatInt(b.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function PaymentsHistory({ customerId }: { customerId: string }) {
  const { companyId } = useStore();
  const [page, setPage] = useState(1);
  const payments = useCustomerPayments(companyId, customerId, page);

  return (
    <QueryBoundary query={payments}>
      {(result) =>
        result.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pagamento recebido ainda.</p>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Recebido em</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Abateu</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(p.createdAt)}
                      </TableCell>
                      <TableCell>{p.store.name}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABEL[p.paymentMethod]}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.allocations.map((a) => (
                          <span key={a.storeId} className="block">
                            {a.store.name}: <Money value={a.amount} />
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={p.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination meta={result.meta} onPageChange={setPage} />
          </div>
        )
      }
    </QueryBoundary>
  );
}

/** Vendas a prazo (fiado) deste cliente na loja ativa. */
function CreditSales({ customerId }: { customerId: string }) {
  const { storeId } = useStore();
  const sales = useSales(storeId, { customerId, paymentMethod: "CREDIT_STORE", limit: 8 });

  return (
    <QueryBoundary query={sales}>
      {(result) =>
        result.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda no fiado nesta loja.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venda</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/loja/${storeId}/vendas/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        #{s.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(s.createdAt)}
                    </TableCell>
                    <TableCell>{SALE_STATUS_LABEL[s.status]}</TableCell>
                    <TableCell className="text-right">
                      <Money value={s.total} />
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

type Dialogs = "pay" | "return" | "loan" | "edit" | "delete" | null;

function CustomerBody({ customer }: { customer: Customer }) {
  const router = useRouter();
  const { storeId, companyId } = useStore();
  const balances = useCustomerBalances(companyId, customer.id);
  const remove = useDeleteCustomer(companyId);
  const [dialog, setDialog] = useState<Dialogs>(null);
  // As comandas abertas do cliente não bloqueiam nada, mas é útil saber que existem.
  const tabs = useCommandTabs(storeId, "OPEN");
  const openTabs = tabs.data?.filter((t) => t.customerId === customer.id) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => setDialog("pay")} disabled={!balances.data}>
          <BanknoteIcon /> Receber pagamento
        </ActionButton>
        <ActionButton
          variant="outline"
          onClick={() => setDialog("return")}
          disabled={!balances.data}
        >
          Devolução de vasilhame
        </ActionButton>
        <ActionButton variant="outline" onClick={() => setDialog("loan")}>
          Emprestar vasilhame
        </ActionButton>
        <ActionButton variant="outline" onClick={() => setDialog("edit")}>
          <PencilIcon /> Editar
        </ActionButton>
        <ActionButton variant="ghost" minRole="MANAGER" onClick={() => setDialog("delete")}>
          <Trash2Icon /> Excluir
        </ActionButton>
      </div>

      {openTabs.length > 0 && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          Comandas abertas deste cliente:{" "}
          {openTabs.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ", "}
              <Link
                href={`/loja/${storeId}/comandas/${t.id}`}
                className="text-primary hover:underline"
              >
                {t.name}
              </Link>
            </span>
          ))}
        </p>
      )}

      <QueryBoundary query={balances}>
        {(data) => (
          <>
            <Balances balances={data} activeStoreId={storeId} />
            {dialog === "pay" && (
              <PayDialog customerId={customer.id} balances={data} onClose={() => setDialog(null)} />
            )}
            {dialog === "return" && (
              <BottleReturnDialog
                customerId={customer.id}
                balances={data}
                onClose={() => setDialog(null)}
              />
            )}
          </>
        )}
      </QueryBoundary>

      <section>
        <h2 className="mb-2 font-medium">Pagamentos recebidos</h2>
        <PaymentsHistory customerId={customer.id} />
      </section>
      <section>
        <h2 className="mb-2 font-medium">Vendas no fiado nesta loja</h2>
        <CreditSales customerId={customer.id} />
      </section>

      {dialog === "loan" && (
        <BottleLoanDialog customerId={customer.id} onClose={() => setDialog(null)} />
      )}
      {dialog === "edit" && (
        <CustomerFormDialog
          companyId={companyId}
          customer={customer}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Excluir ${customer.name}?`}
        description="O cliente sai da lista. Não é possível excluir quem ainda deve dinheiro ou vasilhames em alguma loja."
        confirmLabel="Excluir cliente"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(customer.id, {
            onSuccess: () => {
              toast.success("Cliente excluído.");
              router.push(`/loja/${storeId}/clientes`);
            },
          })
        }
      />
    </div>
  );
}

export function CustomerDetailView({ customerId }: { customerId: string }) {
  const { storeId, companyId } = useStore();
  const customer = useCustomer(companyId, customerId);

  return (
    <div>
      <Link
        href={`/loja/${storeId}/clientes`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" /> Clientes
      </Link>
      <QueryBoundary query={customer}>
        {(data) => (
          <>
            <PageHeader
              title={data.name}
              description={formatPhone(data.phone) || "Sem telefone cadastrado"}
              help="clientes-fiado"
              actions={
                <HistoryButton
                  target={{
                    scope: "company",
                    scopeId: companyId,
                    entity: "customers",
                    id: data.id,
                  }}
                  title={`Histórico de ${data.name}`}
                />
              }
            />
            <CustomerBody customer={data} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
