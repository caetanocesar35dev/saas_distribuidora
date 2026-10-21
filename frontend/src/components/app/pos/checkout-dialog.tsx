"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Money } from "@/components/app/common";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormField } from "@/components/app/form";
import { IntInput, MoneyInput } from "@/components/app/inputs";
import { CustomerPicker, type PickedCustomer } from "@/components/app/pos/customer-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { customerBalancesQuery, useCustomerBalances } from "@/lib/api/hooks/customers";
import type { BottleReturnLine, PaymentMethod } from "@/lib/api/types";
import { creditWarning, salesLabel, type CreditWarning } from "@/lib/credit-warning";
import {
  formatDate,
  formatMoney,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  roundMoney,
} from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { cn } from "@/lib/utils";

/** Vasilhames que saem junto com a venda (1 por unidade de produto com vasilhame). */
export interface BottleLine {
  bottleTypeId: string;
  name: string;
  taken: number;
}

export interface CheckoutPayload {
  paymentMethod: PaymentMethod;
  discount: number;
  customerId?: string;
  bottleReturns: BottleReturnLine[];
}

/**
 * Pagamento da venda ou do fechamento de comanda: forma de pagamento, desconto, cliente e
 * devolução de vasilhames na hora. O valor mostrado é uma prévia; o oficial é o que o backend
 * devolve. Preço e custo nunca são enviados.
 */
export function CheckoutDialog({
  companyId,
  title,
  subtotal,
  bottleLines,
  initialCustomer,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  companyId: string;
  title: string;
  subtotal: number;
  bottleLines: BottleLine[];
  initialCustomer?: PickedCustomer | null;
  pending: boolean;
  error: string | null;
  onSubmit: (payload: CheckoutPayload) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("MONEY");
  const [discount, setDiscount] = useState<number | undefined>();
  const [received, setReceived] = useState<number | undefined>();
  const [customer, setCustomer] = useState<PickedCustomer | null>(initialCustomer ?? null);
  const [returned, setReturned] = useState<Record<string, number | undefined>>({});

  const discountValue = discount ?? 0;
  const total = roundMoney(subtotal - discountValue);
  const discountTooHigh = discountValue > subtotal;

  const bottleBalance = useMemo(
    () =>
      bottleLines.map((line) => {
        const gave = returned[line.bottleTypeId] ?? 0;
        return { ...line, gave, balance: line.taken - gave };
      }),
    [bottleLines, returned],
  );
  const bottlesUnbalanced = bottleBalance.some((l) => l.balance !== 0);
  const customerRequired = method === "CREDIT_STORE" || bottlesUnbalanced;
  const missingCustomer = customerRequired && !customer;

  const change = method === "MONEY" && received !== undefined ? roundMoney(received - total) : null;
  const valid = !discountTooHigh && !missingCustomer && subtotal > 0;

  // ---- aviso de fiado em aberto: antes de vender no fiado, mostra quanto o cliente já deve
  const client = useQueryClient();
  const { storeId } = useStore();
  const [checkingCredit, setCheckingCredit] = useState(false);
  const [creditCheck, setCreditCheck] = useState<{
    payload: CheckoutPayload;
    customerName: string;
    warning: CreditWarning | null; // null = não foi possível consultar
  } | null>(null);
  // Já busca a dívida ao escolher fiado + cliente, para o aviso abrir na hora.
  useCustomerBalances(companyId, customer?.id ?? "", method === "CREDIT_STORE" && !!customer);

  async function submit(payload: CheckoutPayload) {
    if (payload.paymentMethod !== "CREDIT_STORE" || !customer) return onSubmit(payload);
    setCheckingCredit(true);
    try {
      const balances = await client.fetchQuery({
        ...customerBalancesQuery(companyId, customer.id),
        staleTime: 0, // sempre o saldo de agora
      });
      const warning = creditWarning(balances, storeId);
      if (warning) setCreditCheck({ payload, customerName: customer.name, warning });
      else onSubmit(payload);
    } catch {
      setCreditCheck({ payload, customerName: customer.name, warning: null });
    } finally {
      setCheckingCredit(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Confira o pagamento. O valor final é calculado pelo sistema ao concluir.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid || checkingCredit) return;
            void submit({
              paymentMethod: method,
              discount: discountValue,
              customerId: customer?.id,
              bottleReturns: bottleBalance
                .filter((l) => l.gave > 0)
                .map((l) => ({ bottleTypeId: l.bottleTypeId, quantity: l.gave })),
            });
          }}
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Forma de pagamento</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    method === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Desconto (opcional)"
              htmlFor="co-discount"
              error={discountTooHigh ? "O desconto não pode passar do total da venda." : undefined}
            >
              <MoneyInput id="co-discount" value={discount} onChange={setDiscount} />
            </FormField>
            {method === "MONEY" && (
              <FormField label="Valor recebido (para o troco)" htmlFor="co-received">
                <MoneyInput id="co-received" value={received} onChange={setReceived} />
              </FormField>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">
              Cliente{customerRequired ? "" : " (opcional)"}
            </p>
            <CustomerPicker
              companyId={companyId}
              value={customer}
              onChange={setCustomer}
              required={customerRequired}
            />
            {method === "CREDIT_STORE" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Venda no fiado: o valor entra na dívida do cliente nesta loja.
              </p>
            )}
            {missingCustomer && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {method === "CREDIT_STORE"
                  ? "Escolha o cliente para vender no fiado."
                  : "Escolha o cliente: ele sai devendo (ou com crédito) de vasilhames."}
              </p>
            )}
          </div>

          {bottleBalance.length > 0 && (
            <fieldset className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <legend className="px-1 text-sm font-medium">Vasilhames</legend>
              <p className="text-xs text-muted-foreground">
                Cada unidade com vasilhame leva um vasilhame do cliente. Informe quantos ele devolve
                agora. Se a troca for 1 por 1, não precisa de cliente.
              </p>
              {bottleBalance.map((line) => (
                <div key={line.bottleTypeId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Saem {line.taken}
                      {line.balance > 0 && ` · fica devendo ${line.balance}`}
                      {line.balance < 0 && ` · fica com crédito de ${-line.balance}`}
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Devolve
                    <IntInput
                      className="w-20"
                      min={0}
                      max={100_000}
                      value={returned[line.bottleTypeId]}
                      onChange={(v) => setReturned((prev) => ({ ...prev, [line.bottleTypeId]: v }))}
                    />
                  </label>
                </div>
              ))}
            </fieldset>
          )}

          <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <Money value={subtotal} />
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desconto</span>
                <span className="tabular-nums">- {formatMoney(discountValue)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t pt-1.5 text-lg font-semibold">
              <span>Total</span>
              <Money value={discountTooHigh ? subtotal : total} />
            </div>
            {change !== null && (
              <div
                className={cn(
                  "flex justify-between pt-1",
                  change < 0 ? "text-destructive" : "text-emerald-700",
                )}
              >
                <span>{change < 0 ? "Falta receber" : "Troco"}</span>
                <Money value={Math.abs(change)} />
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" size="lg" disabled={!valid || pending || checkingCredit}>
              {pending ? "Concluindo..." : checkingCredit ? "Conferindo o fiado..." : "Concluir"}
            </Button>
          </DialogFooter>
        </form>

        {creditCheck && (
          <CreditConfirmDialog
            customerName={creditCheck.customerName}
            warning={creditCheck.warning}
            saleTotal={total}
            currentStoreId={storeId}
            onCancel={() => setCreditCheck(null)}
            onConfirm={() => {
              const { payload } = creditCheck;
              setCreditCheck(null);
              onSubmit(payload);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pergunta ao atendente se quer mesmo vender no fiado para quem já deve. */
function CreditConfirmDialog({
  customerName,
  warning,
  saleTotal,
  currentStoreId,
  onCancel,
  onConfirm,
}: {
  customerName: string;
  warning: CreditWarning | null;
  saleTotal: number;
  currentStoreId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!warning) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onCancel()}
        title="Não foi possível conferir o fiado"
        description={`Não conseguimos consultar agora quanto ${customerName} já deve. Deseja vender no fiado mesmo assim?`}
        cancelLabel="Não, voltar"
        confirmLabel="Sim, vender no fiado"
        onConfirm={onConfirm}
      />
    );
  }

  const here = warning.stores.find((s) => s.storeId === currentStoreId);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title="Cliente com fiado em aberto"
      description={
        <>
          <strong className="text-foreground">{customerName}</strong> já possui{" "}
          <strong className="text-foreground">{formatMoney(warning.amount)}</strong> em venda fiada
          {warning.sales > 0 && (
            <>
              , divididos em{" "}
              <strong className="text-foreground">{salesLabel(warning.sales)}</strong>
            </>
          )}
          .{warning.oldest && ` A mais antiga em aberto é de ${formatDate(warning.oldest)}.`}
        </>
      }
      cancelLabel="Não, voltar"
      confirmLabel="Sim, vender no fiado"
      onConfirm={onConfirm}
    >
      <div className="space-y-2 text-sm">
        {warning.stores.length > 1 && (
          <ul className="divide-y rounded-lg border">
            {warning.stores.map((s) => (
              <li key={s.storeId} className="flex justify-between gap-3 px-3 py-1.5">
                <span>
                  {s.storeName}
                  {s.storeId === currentStoreId && " (esta loja)"}
                  {s.sales > 0 && (
                    <span className="text-muted-foreground"> · {salesLabel(s.sales)}</span>
                  )}
                </span>
                <Money value={s.amount} />
              </li>
            ))}
          </ul>
        )}
        <p className="rounded-lg bg-muted/50 px-3 py-2">
          Com esta venda de <Money value={saleTotal} />, a dívida{" "}
          {warning.stores.length > 1 ? "nesta loja " : ""}passa para{" "}
          <strong>
            <Money value={roundMoney((here?.amount ?? 0) + saleTotal)} />
          </strong>
          .
        </p>
        <p className="font-medium">Deseja realmente fazer a venda no fiado?</p>
      </div>
    </ConfirmDialog>
  );
}
