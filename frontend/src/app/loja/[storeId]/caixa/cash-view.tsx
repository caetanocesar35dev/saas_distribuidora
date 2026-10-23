"use client";

import { ArrowDownIcon, ArrowUpIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MovementsTable, PaymentSummaryTable } from "@/components/app/cash-parts";
import { ErrorState, LoadingRows, Money, PageHeader, StatCard } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton, RequireRole } from "@/components/app/guards";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCashMovement,
  useCloseCash,
  useCurrentCash,
  useOpenCash,
} from "@/lib/api/hooks/cash";
import type { CloseCashResponse, CurrentCashRegister } from "@/lib/api/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { CashHistory } from "./cash-history";

function OpenCashCard({ storeId }: { storeId: string }) {
  const open = useOpenCash(storeId);
  const [initial, setInitial] = useState<number | undefined>(0);

  return (
    <form
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (initial === undefined) return;
        open.mutate(initial, { onSuccess: () => toast.success("Caixa aberto. Boas vendas!") });
      }}
    >
      <div className="flex items-center gap-2">
        <LockIcon className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">O caixa está fechado</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Conte o dinheiro que está na gaveta e informe como saldo inicial. Sem o caixa aberto não é
        possível vender.
      </p>
      <FormField label="Saldo inicial (dinheiro na gaveta)" htmlFor="initial">
        <MoneyInput id="initial" value={initial} onChange={setInitial} autoFocus />
      </FormField>
      <ActionButton type="submit" size="lg" disabled={initial === undefined || open.isPending}>
        {open.isPending ? "Abrindo..." : "Abrir caixa"}
      </ActionButton>
    </form>
  );
}

function MovementDialog({
  storeId,
  type,
  onClose,
}: {
  storeId: string;
  type: "IN" | "OUT";
  onClose: () => void;
}) {
  const movement = useCashMovement(storeId);
  const [amount, setAmount] = useState<number | undefined>();
  const [description, setDescription] = useState("");
  const isOut = type === "OUT";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isOut ? "Saída de dinheiro (sangria)" : "Entrada de dinheiro"}</DialogTitle>
          <DialogDescription>
            {isOut
              ? "Dinheiro que sai do caixa (sangria, pagamento de despesa). O saldo não pode ficar negativo."
              : "Dinheiro que entra no caixa fora de uma venda (reforço de troco, por exemplo)."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!amount) return;
            movement.mutate(
              { type, amount, description: description.trim() || undefined },
              {
                onSuccess: () => {
                  toast.success(isOut ? "Saída registrada." : "Entrada registrada.");
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Valor" htmlFor="mv-amount">
            <MoneyInput id="mv-amount" value={amount} onChange={setAmount} autoFocus />
          </FormField>
          <FormField label="Descrição (opcional)" htmlFor="mv-description">
            <Input
              id="mv-description"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isOut ? "Ex.: sangria, pagamento de frete" : "Ex.: reforço de troco"}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!amount || amount < 0.01 || movement.isPending}>
              {movement.isPending ? "Salvando..." : isOut ? "Registrar saída" : "Registrar entrada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Confirma e fecha o caixa; depois mostra o saldo final e o resumo por forma de pagamento. */
function CloseDialog({
  storeId,
  register,
  onClose,
}: {
  storeId: string;
  register: CurrentCashRegister;
  onClose: () => void;
}) {
  const close = useCloseCash(storeId);
  const [result, setResult] = useState<CloseCashResponse | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && !close.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Caixa fechado</DialogTitle>
              <DialogDescription>
                Confira o saldo e o resumo por forma de pagamento.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Saldo final do caixa" value={<Money value={result.register.finalBalance} />} />
              <StatCard label="Saldo inicial" value={<Money value={result.register.initialBalance} />} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Vendas do período por forma de pagamento</h3>
              <PaymentSummaryTable summary={result.summary} />
              <p className="mt-2 text-xs text-muted-foreground">
                O saldo do caixa soma dinheiro, PIX e cartão. Para conferir só o dinheiro da gaveta,
                use o total em dinheiro do resumo.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Fechar o caixa?</DialogTitle>
              <DialogDescription>
                O saldo atual é <strong>{formatMoney(register.currentBalance)}</strong>. Depois de
                fechar, só é possível vender abrindo um caixa novo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" disabled={close.isPending} onClick={onClose}>
                Cancelar
              </Button>
              <Button
                disabled={close.isPending}
                onClick={() => close.mutate(undefined, { onSuccess: setResult })}
              >
                {close.isPending ? "Fechando..." : "Fechar caixa"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CurrentCash({ register, storeId }: { register: CurrentCashRegister; storeId: string }) {
  const [movement, setMovement] = useState<"IN" | "OUT" | null>(null);
  const [closing, setClosing] = useState(false);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Saldo atual" value={<Money value={register.currentBalance} />} />
        <StatCard label="Saldo inicial" value={<Money value={register.initialBalance} />} />
        <StatCard label="Aberto em" value={formatDateTime(register.openedAt)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton variant="outline" onClick={() => setMovement("IN")}>
          <ArrowDownIcon /> Entrada de dinheiro
        </ActionButton>
        <RequireRole min="MANAGER">
          <ActionButton variant="outline" minRole="MANAGER" onClick={() => setMovement("OUT")}>
            <ArrowUpIcon /> Saída (sangria)
          </ActionButton>
        </RequireRole>
        {/* Fechar o caixa já aberto continua liberado mesmo com a assinatura em somente leitura. */}
        <ActionButton variant="destructive" allowWhenReadOnly onClick={() => setClosing(true)}>
          <LockIcon /> Fechar caixa
        </ActionButton>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Movimentações</h2>
        <MovementsTable movements={register.movements} />
      </section>

      {movement && (
        <MovementDialog storeId={storeId} type={movement} onClose={() => setMovement(null)} />
      )}
      {closing && (
        <CloseDialog storeId={storeId} register={register} onClose={() => setClosing(false)} />
      )}
    </div>
  );
}

export function CashView() {
  const { storeId } = useStore();
  const current = useCurrentCash(storeId);

  return (
    <div>
      <PageHeader
        title="Caixa"
        description="Abra o caixa para vender, registre entradas e saídas e feche ao fim do dia."
        help="caixa-abrir"
      />
      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Caixa atual</TabsTrigger>
          <TabsTrigger value="history">Caixas anteriores</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {current.isPending ? (
            <LoadingRows rows={3} />
          ) : current.isError ? (
            <ErrorState error={current.error} onRetry={() => void current.refetch()} />
          ) : current.data ? (
            <CurrentCash register={current.data} storeId={storeId} />
          ) : (
            <OpenCashCard storeId={storeId} />
          )}
        </TabsContent>
        <TabsContent value="history">
          <CashHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
