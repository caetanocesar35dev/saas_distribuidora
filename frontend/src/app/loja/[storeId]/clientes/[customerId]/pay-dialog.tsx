"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { MoneyInput } from "@/components/app/inputs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/client";
import { useCurrentCash } from "@/lib/api/hooks/cash";
import { usePayDebt } from "@/lib/api/hooks/customers";
import type { CustomerBalances, PaymentMethod } from "@/lib/api/types";
import { formatMoney, PAYMENT_METHOD_LABEL, roundMoney } from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { cn } from "@/lib/utils";

type PayMethod = Exclude<PaymentMethod, "CREDIT_STORE">;
const PAY_METHODS: PayMethod[] = ["MONEY", "PIX", "DEBIT", "CREDIT"];

type Mode = "auto" | "manual";

/**
 * Recebe um pagamento de fiado. O dinheiro entra no caixa da loja ativa (que precisa estar
 * aberto), mas o valor pode abater dívidas de outras lojas da empresa:
 *  - Automático: só o valor. Abate primeiro a dívida desta loja, depois as outras (mais antigas primeiro).
 *  - Manual: você divide o valor entre as dívidas de cada loja.
 */
export function PayDialog({
  customerId,
  balances,
  onClose,
}: {
  customerId: string;
  balances: CustomerBalances;
  onClose: () => void;
}) {
  const { storeId, storeName } = useStore();
  const cash = useCurrentCash(storeId);
  const pay = usePayDebt(storeId, customerId);

  const debts = balances.perStore.filter((d) => d.balance > 0);
  const knownTotal = balances.total;
  const visibleTotal = roundMoney(debts.reduce((s, d) => s + d.balance, 0));

  const [amount, setAmount] = useState<number | undefined>();
  const [method, setMethod] = useState<PayMethod>("MONEY");
  const [mode, setMode] = useState<Mode>("auto");
  const [parts, setParts] = useState<Record<string, number | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const allocated = roundMoney(Object.values(parts).reduce<number>((s, v) => s + (v ?? 0), 0));
  const remaining = roundMoney((amount ?? 0) - allocated);
  const overDebt = debts.find((d) => (parts[d.storeId] ?? 0) > d.balance);

  const cashClosed = !cash.isPending && !cash.data;
  const tooMuch = mode === "auto" && knownTotal !== null && (amount ?? 0) > knownTotal;

  let invalid: string | null = null;
  if (!amount || amount < 0.01) invalid = "Informe o valor recebido.";
  else if (tooMuch) invalid = "O valor é maior que a dívida total do cliente.";
  else if (mode === "manual" && remaining !== 0) {
    invalid = remaining > 0 ? `Falta distribuir ${formatMoney(remaining)}.` : `Passou ${formatMoney(-remaining)} do valor.`;
  } else if (mode === "manual" && overDebt) {
    invalid = `Em ${overDebt.storeName}, o valor passa da dívida.`;
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pay.isPending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receber pagamento</DialogTitle>
          <DialogDescription>
            O dinheiro entra no caixa da loja <strong>{storeName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {cashClosed && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            O caixa desta loja está fechado: ele abre sozinho ao receber, com o saldo do último
            fechamento.
          </p>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid || !amount) return;
            setError(null);
            pay.mutate(
              {
                amount,
                paymentMethod: method,
                allocations:
                  mode === "manual"
                    ? debts
                        .filter((d) => (parts[d.storeId] ?? 0) > 0)
                        .map((d) => ({ storeId: d.storeId, amount: parts[d.storeId] as number }))
                    : undefined,
              },
              {
                onSuccess: () => {
                  toast.success(`Pagamento de ${formatMoney(amount)} recebido.`);
                  onClose();
                },
                onError: (err) => setError(errorMessage(err)),
              },
            );
          }}
        >
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">
              {knownTotal !== null ? "Dívida total do cliente" : "Dívida nas suas lojas"}:{" "}
              <Money value={knownTotal ?? visibleTotal} />
            </p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {debts.map((d) => (
                <li key={d.storeId} className="flex justify-between gap-3">
                  <span>
                    {d.storeName}
                    {d.storeId === storeId && " (esta loja)"}
                  </span>
                  <Money value={d.balance} />
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Valor recebido" htmlFor="pay-amount">
              <MoneyInput id="pay-amount" value={amount} onChange={setAmount} autoFocus />
            </FormField>
            <div>
              <p className="mb-1.5 text-sm font-medium">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                      method === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {PAYMENT_METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {debts.length > 1 && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Como abater a dívida</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["auto", "Automático"],
                    ["manual", "Escolher por loja"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      mode === value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "auto" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Abate primeiro a dívida desta loja e depois as das outras lojas, da mais antiga
                  para a mais nova.
                </p>
              )}
            </fieldset>
          )}

          {mode === "manual" && (
            <div className="space-y-2 rounded-lg border p-3">
              {debts.map((d) => (
                <div key={d.storeId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{d.storeName}</p>
                    <p className="text-xs text-muted-foreground">
                      Deve <Money value={d.balance} />
                    </p>
                  </div>
                  <MoneyInput
                    className="w-32"
                    value={parts[d.storeId]}
                    onChange={(v) => setParts((prev) => ({ ...prev, [d.storeId]: v }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setParts((prev) => ({ ...prev, [d.storeId]: d.balance }))}
                  >
                    Tudo
                  </Button>
                </div>
              ))}
              <p
                className={cn(
                  "text-sm",
                  remaining === 0 && (amount ?? 0) > 0 ? "text-emerald-700" : "text-muted-foreground",
                )}
              >
                {remaining === 0 && (amount ?? 0) > 0
                  ? "Tudo distribuído."
                  : `Falta distribuir ${formatMoney(Math.max(remaining, 0))}.`}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {invalid && amount !== undefined && (
            <p className="text-xs text-muted-foreground">{invalid}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pay.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!!invalid || pay.isPending}>
              {pay.isPending ? "Registrando..." : "Receber pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
