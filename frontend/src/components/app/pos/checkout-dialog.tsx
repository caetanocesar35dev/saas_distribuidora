"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Money } from "@/components/app/common";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormField } from "@/components/app/form";
import { IntInput, MoneyInput } from "@/components/app/inputs";
import { CustomerPicker, type PickedCustomer } from "@/components/app/pos/customer-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bottleRows,
  bottlesNeedCustomer,
  bottlesTotal,
  type BottleLine,
} from "@/components/app/pos/bottle-checkout";
import { useBottleTypes } from "@/lib/api/hooks/catalog";
import { customerBalancesQuery, useCustomerBalances } from "@/lib/api/hooks/customers";
import { useSaleChannels } from "@/lib/api/hooks/sales";
import { effectiveChannelId } from "@/lib/sale-channels";
import type { BottleReturnLine, ManagerApproval, PaymentMethod } from "@/lib/api/types";
import {
  creditLimitCheck,
  creditWarning,
  salesLabel,
  type CreditLimitCheck,
  type CreditWarning,
} from "@/lib/credit-warning";
import {
  formatDate,
  formatMoney,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  roundMoney,
} from "@/lib/format";
import { useHasRole, useStore } from "@/lib/session/context";
import { cn } from "@/lib/utils";

export type { BottleLine };

export interface CheckoutPayload {
  paymentMethod: PaymentMethod;
  /** Origem da venda (balcão, iFood...). Sem a lista carregada, o backend usa a padrão. */
  channelId?: string;
  discount: number;
  customerId?: string;
  bottleReturns: BottleReturnLine[];
  /** Cascos que o cliente compra (o preço é do tipo de vasilhame; o backend confere). */
  bottlePurchases: BottleReturnLine[];
  /** Gerente ou dono confirmou a venda fiada acima do limite de crédito. */
  allowOverCreditLimit?: boolean;
  /** Atendente: gerente ou dono digitou o e-mail e a senha para autorizar passar do limite. */
  managerApproval?: ManagerApproval;
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
  // Origem da venda: já vem marcada a padrão da empresa (Balcão, se ninguém mudou).
  const channels = useSaleChannels(companyId);
  const [pickedChannel, setPickedChannel] = useState<string | undefined>();
  const channelId = effectiveChannelId(pickedChannel, channels.data);
  const [discount, setDiscount] = useState<number | undefined>();
  const [received, setReceived] = useState<number | undefined>();
  const [customer, setCustomer] = useState<PickedCustomer | null>(initialCustomer ?? null);
  const [returned, setReturned] = useState<Record<string, number | undefined>>({});
  const [bought, setBought] = useState<Record<string, number | undefined>>({});

  // Preço do casco de cada tipo (da empresa). Enquanto não carrega, a compra fica indisponível.
  const bottleTypes = useBottleTypes(companyId);
  const bottleBalance = useMemo(() => {
    const prices = new Map((bottleTypes.data ?? []).map((t) => [t.id, t.price]));
    return bottleRows(
      bottleLines.map((line) => ({ ...line, price: prices.get(line.bottleTypeId) ?? null })),
      returned,
      bought,
    );
  }, [bottleLines, bottleTypes.data, returned, bought]);
  const cascos = bottlesTotal(bottleBalance);

  const discountValue = discount ?? 0;
  // O desconto vale só sobre os produtos; os cascos entram pelo preço cheio.
  const total = roundMoney(subtotal - discountValue + cascos);
  const discountTooHigh = discountValue > subtotal;

  const bottlesUnbalanced = bottlesNeedCustomer(bottleBalance);
  const customerRequired = method === "CREDIT_STORE" || bottlesUnbalanced;
  const missingCustomer = customerRequired && !customer;

  const change = method === "MONEY" && received !== undefined ? roundMoney(received - total) : null;
  const valid = !discountTooHigh && !missingCustomer && subtotal > 0;

  // ---- aviso de fiado em aberto e limite de crédito: antes de vender no fiado, mostra quanto o
  // cliente já deve e se a venda passa do limite (atendente é barrado; gerente e dono confirmam)
  const client = useQueryClient();
  const { storeId } = useStore();
  const canPassLimit = useHasRole("MANAGER");
  const [checkingCredit, setCheckingCredit] = useState(false);
  const [creditCheck, setCreditCheck] = useState<{
    payload: CheckoutPayload;
    customerName: string;
    failed: boolean; // não foi possível consultar
    warning: CreditWarning | null; // dívida em aberto
    limit: CreditLimitCheck | null; // só quando passa do limite
  } | null>(null);
  // Já busca a dívida ao escolher fiado + cliente, para o aviso abrir na hora.
  useCustomerBalances(companyId, customer?.id ?? "", method === "CREDIT_STORE" && !!customer);

  // Último pedido enviado (sem credenciais), para pedir a autorização se o backend barrar.
  const [lastPayload, setLastPayload] = useState<CheckoutPayload | null>(null);
  const [approvalFor, setApprovalFor] = useState<CheckoutPayload | null>(null);
  const limitBlocked =
    !canPassLimit &&
    lastPayload?.paymentMethod === "CREDIT_STORE" &&
    !!error &&
    /limite de crédito|acima do limite|senha do gerente/i.test(error);

  async function submit(payload: CheckoutPayload) {
    setLastPayload(payload);
    if (payload.paymentMethod !== "CREDIT_STORE" || !customer) return onSubmit(payload);
    setCheckingCredit(true);
    try {
      const balances = await client.fetchQuery({
        ...customerBalancesQuery(companyId, customer.id),
        staleTime: 0, // sempre o saldo de agora
      });
      const warning = creditWarning(balances, storeId);
      const limit = creditLimitCheck(balances, total);
      const over = limit?.over ? limit : null;
      if (warning || over) {
        setCreditCheck({
          payload,
          customerName: customer.name,
          failed: false,
          warning,
          limit: over,
        });
      } else onSubmit(payload);
    } catch {
      setCreditCheck({
        payload,
        customerName: customer.name,
        failed: true,
        warning: null,
        limit: null,
      });
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
              channelId,
              discount: discountValue,
              customerId: customer?.id,
              bottleReturns: bottleBalance
                .filter((l) => l.gave > 0)
                .map((l) => ({ bottleTypeId: l.bottleTypeId, quantity: l.gave })),
              bottlePurchases: bottleBalance
                .filter((l) => l.bought > 0)
                .map((l) => ({ bottleTypeId: l.bottleTypeId, quantity: l.bought })),
            });
          }}
        >
          {channels.data && channels.data.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Origem da venda</legend>
              <div className="flex flex-wrap gap-2">
                {channels.data.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPickedChannel(c.id)}
                    aria-pressed={channelId === c.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      channelId === c.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

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
                Cada unidade com vasilhame leva um vasilhame. Informe quantos vazios o cliente
                devolve agora e, se ele não tem o vazio e quer ficar com o vasilhame, quantos cascos
                ele compra. O que sobrar fica emprestado. Troca 1 por 1 ou compra de todos os cascos
                não precisa de cliente.
              </p>
              {bottleBalance.map((line) => (
                <div
                  key={line.bottleTypeId}
                  className="space-y-1.5 border-t pt-2 first-of-type:border-t-0 first-of-type:pt-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Saem {line.taken}
                      {line.balance > 0 && ` · fica devendo ${line.balance}`}
                      {line.balance < 0 && ` · fica com crédito de ${-line.balance}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Devolve
                      <IntInput
                        className="w-20"
                        min={0}
                        max={100_000}
                        value={returned[line.bottleTypeId]}
                        onChange={(v) =>
                          setReturned((prev) => ({ ...prev, [line.bottleTypeId]: v }))
                        }
                      />
                    </label>
                    {line.price !== null ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <label className="flex items-center gap-1.5">
                          Compra o casco
                          <IntInput
                            className="w-20"
                            min={0}
                            max={line.taken}
                            value={bought[line.bottleTypeId]}
                            onChange={(v) =>
                              setBought((prev) => ({ ...prev, [line.bottleTypeId]: v }))
                            }
                          />
                        </label>
                        <span>× {formatMoney(line.price)}</span>
                        {line.bought < line.taken && (
                          <Button
                            type="button"
                            variant="link"
                            size="xs"
                            className="h-auto px-0"
                            onClick={() =>
                              setBought((prev) => ({ ...prev, [line.bottleTypeId]: line.taken }))
                            }
                          >
                            todos
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Casco sem preço: só troca ou empréstimo.
                      </span>
                    )}
                  </div>
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
            {cascos > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Cascos ({bottleBalance.reduce((n, l) => n + l.bought, 0)})
                </span>
                <span className="tabular-nums">+ {formatMoney(cascos)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t pt-1.5 text-lg font-semibold">
              <span>Total</span>
              <Money value={discountTooHigh ? roundMoney(subtotal + cascos) : total} />
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
            <div
              role="alert"
              className="space-y-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <p>{error}</p>
              {limitBlocked && lastPayload && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setApprovalFor(lastPayload)}
                >
                  Autorização do gerente
                </Button>
              )}
            </div>
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
            failed={creditCheck.failed}
            warning={creditCheck.warning}
            limit={creditCheck.limit}
            canPassLimit={canPassLimit}
            saleTotal={total}
            currentStoreId={storeId}
            onCancel={() => setCreditCheck(null)}
            onConfirm={() => {
              const { payload, limit } = creditCheck;
              setCreditCheck(null);
              onSubmit(limit ? { ...payload, allowOverCreditLimit: true } : payload);
            }}
            onApprove={(managerApproval) => {
              const { payload } = creditCheck;
              setCreditCheck(null);
              onSubmit({ ...payload, managerApproval });
            }}
          />
        )}

        {/* O backend barrou pelo limite sem a tela ter visto antes (o atendente não enxerga a
            dívida de todas as lojas): o gerente autoriza aqui mesmo. */}
        {approvalFor && (
          <ManagerApprovalDialog
            description="Esta venda passa do limite de crédito do cliente."
            onCancel={() => setApprovalFor(null)}
            onApprove={(managerApproval) => {
              const payload = approvalFor;
              setApprovalFor(null);
              onSubmit({ ...payload, managerApproval });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Venda do atendente acima do limite (decisão do usuário): o gerente ou dono digita o e-mail e a
 * senha aqui mesmo, sem o atendente sair da conta. As credenciais vão só nesta venda e não ficam
 * guardadas: os campos não têm autocompletar, a senha não usa `type="password"` onde o navegador
 * consegue mascarar texto comum (assim ele não oferece "salvar senha") e tudo some ao fechar.
 */
function ManagerApprovalDialog({
  description,
  onCancel,
  onApprove,
}: {
  description: React.ReactNode;
  onCancel: () => void;
  onApprove: (approval: ManagerApproval) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const masksText =
    typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc");
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && password !== "";

  function approve() {
    if (!valid) return;
    const approval = { email: email.trim(), password };
    setPassword("");
    onApprove(approval);
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Venda acima do limite de crédito</AlertDialogTitle>
          <AlertDialogDescription>
            {description} Para vender mesmo assim, o gerente ou o dono da loja digita o e-mail e a
            senha dele abaixo. Nada fica salvo neste aparelho.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Sem <form>: o navegador não trata como login (nem oferece salvar a senha). */}
        <div
          className="space-y-3"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              approve();
            }
          }}
        >
          <FormField label="E-mail do gerente ou dono" htmlFor="approval-email">
            <Input
              id="approval-email"
              type="text"
              inputMode="email"
              name="approval-email-no-save"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Senha" htmlFor="approval-password">
            <Input
              id="approval-password"
              type={masksText ? "text" : "password"}
              name="approval-secret-no-save"
              autoComplete={masksText ? "off" : "new-password"}
              autoCapitalize="none"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              style={masksText ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={!valid} onClick={approve}>
            Autorizar e vender
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Antes de vender no fiado: mostra a dívida em aberto e, se a venda passa do limite de crédito,
 * pede a autorização do gerente (atendente) ou a confirmação de gerente e dono.
 */
function CreditConfirmDialog({
  customerName,
  failed,
  warning,
  limit,
  canPassLimit,
  saleTotal,
  currentStoreId,
  onCancel,
  onConfirm,
  onApprove,
}: {
  customerName: string;
  failed: boolean;
  warning: CreditWarning | null;
  limit: CreditLimitCheck | null;
  canPassLimit: boolean;
  saleTotal: number;
  currentStoreId: string;
  onCancel: () => void;
  onConfirm: () => void;
  onApprove: (approval: ManagerApproval) => void;
}) {
  if (limit && !canPassLimit) {
    return (
      <ManagerApprovalDialog
        description={
          <>
            O limite de crédito de <strong className="text-foreground">{customerName}</strong> é{" "}
            <strong className="text-foreground">{formatMoney(limit.limit)}</strong>, e esta venda
            passa desse valor.
          </>
        }
        onCancel={onCancel}
        onApprove={onApprove}
      />
    );
  }

  if (failed) {
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

  const here = warning?.stores.find((s) => s.storeId === currentStoreId);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={limit ? "Venda acima do limite de crédito" : "Cliente com fiado em aberto"}
      description={
        warning ? (
          <>
            <strong className="text-foreground">{customerName}</strong> já possui{" "}
            <strong className="text-foreground">{formatMoney(warning.amount)}</strong> em venda
            fiada
            {warning.sales > 0 && (
              <>
                , divididos em{" "}
                <strong className="text-foreground">{salesLabel(warning.sales)}</strong>
              </>
            )}
            .{warning.oldest && ` A mais antiga em aberto é de ${formatDate(warning.oldest)}.`}
          </>
        ) : (
          <>
            <strong className="text-foreground">{customerName}</strong> não tem fiado em aberto.
          </>
        )
      }
      cancelLabel="Não, voltar"
      confirmLabel={limit ? "Sim, vender acima do limite" : "Sim, vender no fiado"}
      destructive={!!limit}
      onConfirm={onConfirm}
    >
      <div className="space-y-2 text-sm">
        {limit && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
          >
            O limite de crédito do cliente é <strong>{formatMoney(limit.limit)}</strong>. Com esta
            venda, a dívida em todas as lojas passa para <strong>{formatMoney(limit.after)}</strong>{" "}
            ({formatMoney(roundMoney(limit.after - limit.limit))} acima do limite).
          </p>
        )}
        {warning && warning.stores.length > 1 && (
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
        {warning && (
          <p className="rounded-lg bg-muted/50 px-3 py-2">
            Com esta venda de <Money value={saleTotal} />, a dívida{" "}
            {warning.stores.length > 1 ? "nesta loja " : ""}passa para{" "}
            <strong>
              <Money value={roundMoney((here?.amount ?? 0) + saleTotal)} />
            </strong>
            .
          </p>
        )}
        <p className="font-medium">
          {limit
            ? "Deseja realmente vender no fiado acima do limite?"
            : "Deseja realmente fazer a venda no fiado?"}
        </p>
      </div>
    </ConfirmDialog>
  );
}
