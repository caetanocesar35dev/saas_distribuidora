"use client";

import { CheckCircle2Icon, MinusIcon, PlusIcon, ShoppingCartIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Money, PageHeader } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton } from "@/components/app/guards";
import { LinkButton } from "@/components/app/link-button";
import { CheckoutDialog, type CheckoutPayload } from "@/components/app/pos/checkout-dialog";
import { ProductSearch } from "@/components/app/pos/product-search";
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
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/client";
import { useCurrentCash } from "@/lib/api/hooks/cash";
import { useCreateLateSale, useCreateSale } from "@/lib/api/hooks/sales";
import type { CreateSaleBody, Sale, StoreProduct } from "@/lib/api/types";
import {
  formatDateTime,
  formatInt,
  fromDatetimeLocal,
  PAYMENT_METHOD_LABEL,
  roundMoney,
  toDatetimeLocal,
} from "@/lib/format";
import { lateSaleDateError } from "@/lib/late-sale";
import { useAccess, useStore } from "@/lib/session/context";
import { cartBottles, cartReducer, cartSubtotal, lineUnits, packSizeOf } from "./cart";

/**
 * Sem caixa aberto, o PDV não bloqueia mais (decisão do usuário): a primeira venda abre o caixa
 * sozinha, com o troco inicial igual ao saldo do último fechamento. Só avisa.
 */
function CashAutoOpenNote() {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <ShoppingCartIcon className="size-4 shrink-0" />O caixa está fechado: ele abre sozinho na
      primeira venda, com o saldo do último fechamento.
    </p>
  );
}

function SaleDoneDialog({
  sale,
  late,
  onClose,
}: {
  sale: Sale;
  late: boolean;
  onClose: () => void;
}) {
  const { storeId } = useStore();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2Icon className="size-7" />
          </div>
          <DialogTitle className="text-center text-lg">
            {late ? "Venda antiga lançada" : "Venda concluída"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {PAYMENT_METHOD_LABEL[sale.paymentMethod]}
            {sale.customer && ` · ${sale.customer.name}`}
            {late && ` · venda de ${formatDateTime(sale.createdAt)}`}
          </DialogDescription>
        </DialogHeader>
        <p className="text-center text-3xl font-semibold tabular-nums">
          <Money value={sale.total} />
        </p>
        {sale.bottleMovements.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            {sale.bottleMovements.map((m) => (
              <li key={m.id} className="flex justify-between gap-3">
                <span>{m.bottleType.name}</span>
                <span className="tabular-nums">
                  {m.quantity > 0
                    ? `devolveu ${formatInt(m.quantity)}`
                    : `levou ${formatInt(-m.quantity)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <LinkButton variant="outline" href={`/loja/${storeId}/vendas/${sale.id}`}>
            Ver venda
          </LinkButton>
          <Button autoFocus onClick={onClose}>
            {late ? "Lançar outra" : "Nova venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Contador − [n] + de uma linha do carrinho (unidades ou fardos). */
function Stepper({
  label,
  name,
  value,
  min,
  max,
  onChange,
}: {
  label?: string;
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  // Passar do estoque (pelo "+" ou digitando) avisa "Estoque insuficiente" e fica no máximo.
  const set = (n: number) => {
    const top = Math.max(max, min);
    if (n > top) toast.error("Estoque insuficiente");
    onChange(Math.max(min, Math.min(n, top)));
  };
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label={`Diminuir ${name}`}
        disabled={value <= min}
        onClick={() => set(value - 1)}
      >
        <MinusIcon />
      </Button>
      <input
        aria-label={name}
        inputMode="numeric"
        className="h-8 w-12 rounded-lg border bg-transparent text-center text-sm tabular-nums"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (digits !== "") set(Math.trunc(Number(digits)));
        }}
      />
      <Button
        variant="outline"
        size="icon"
        aria-label={`Aumentar ${name}`}
        onClick={() => set(value + 1)}
      >
        <PlusIcon />
      </Button>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

/**
 * PDV. Com `late`, vira "Lançar venda antiga" (só gerente e dono): a mesma venda, com a data e
 * hora em que aconteceu (ex.: a internet caiu e a venda foi anotada no papel). O estoque baixa
 * agora e o dinheiro entra no caixa aberto agora.
 */
export function PosView({ late = false }: { late?: boolean }) {
  const { storeId, companyId } = useStore();
  const { readOnly } = useAccess();
  const cash = useCurrentCash(storeId);
  const createNow = useCreateSale(storeId);
  const createLate = useCreateLateSale(storeId);
  const createSale = late ? createLate : createNow;
  const [soldAt, setSoldAt] = useState("");
  const soldAtError = late ? lateSaleDateError(soldAt) : null;

  const [cart, dispatch] = useReducer(cartReducer, []);
  const [checkout, setCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [done, setDone] = useState<Sale | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const subtotal = cartSubtotal(cart);
  const bottles = useMemo(() => cartBottles(cart), [cart]);
  const cashOpen = !!cash.data;
  const blocked = readOnly;

  /** Adiciona 1 unidade ou 1 fardo (venda em lote), conferindo o estoque em unidades. */
  const addToCart = useCallback(
    (item: StoreProduct, asPack: boolean) => {
      const line = cart.find((l) => l.item.id === item.id);
      const inCart = line ? lineUnits(line) : 0;
      const adding = asPack ? packSizeOf(item) : 1;
      // Mensagem curta (pedido do usuário); o estoque disponível aparece no cartão do produto.
      if (inCart + adding > item.stock) {
        toast.error("Estoque insuficiente");
        return;
      }
      dispatch({ type: asPack ? "addPack" : "add", item });
    },
    [cart],
  );
  const addItem = useCallback((item: StoreProduct) => addToCart(item, false), [addToCart]);
  const addPack = useCallback((item: StoreProduct) => addToCart(item, true), [addToCart]);

  const openCheckout = useCallback(() => {
    if (cart.length === 0 || blocked || soldAtError) return;
    setCheckoutError(null);
    setCheckout(true);
  }, [cart.length, blocked, soldAtError]);

  // Atalhos: F2 foca a busca, F9 finaliza a venda.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        openCheckout();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCheckout]);

  function submit(payload: CheckoutPayload) {
    setCheckoutError(null);
    const body: CreateSaleBody = {
      paymentMethod: payload.paymentMethod,
      customerId: payload.customerId,
      discount: payload.discount > 0 ? payload.discount : undefined,
      items: cart.map((l) => ({
        storeProductId: l.item.id,
        quantity: l.quantity,
        ...(l.packs ? { packs: l.packs } : {}),
      })),
      bottleReturns: payload.bottleReturns.length > 0 ? payload.bottleReturns : undefined,
      allowOverCreditLimit: payload.allowOverCreditLimit,
      managerApproval: payload.managerApproval,
    };
    const handlers = {
      onSuccess: (sale: Sale) => {
        setCheckout(false);
        dispatch({ type: "clear" });
        setDone(sale);
      },
      // Estoque insuficiente, caixa fechado... a mensagem do backend aparece e o carrinho fica.
      onError: (error: Error) => setCheckoutError(errorMessage(error)),
    };
    const lateDate = fromDatetimeLocal(soldAt);
    if (late && lateDate) createLate.mutate({ ...body, soldAt: lateDate }, handlers);
    else createNow.mutate(body, handlers);
  }

  return (
    <div>
      {late ? (
        <PageHeader
          title="Lançar venda antiga"
          description="Para vendas que aconteceram sem o sistema (internet caiu, venda anotada no papel). O estoque baixa agora e o dinheiro entra no caixa aberto agora."
          help="vendas-lancar-antiga"
        />
      ) : (
        <PageHeader
          title="Vender"
          description="Passe o leitor de código de barras ou busque o produto. F2 busca, F9 finaliza."
          help="vendas-vender"
        />
      )}

      {late && (
        <div className="mb-4 max-w-sm">
          <FormField
            label="Data e hora em que a venda aconteceu"
            htmlFor="late-sold-at"
            error={soldAt ? (soldAtError ?? undefined) : undefined}
            hint="A venda aparece nos relatórios nesse dia. Pode ser qualquer data passada."
          >
            <Input
              id="late-sold-at"
              type="datetime-local"
              value={soldAt}
              max={toDatetimeLocal(new Date().toISOString())}
              onChange={(e) => setSoldAt(e.target.value)}
              aria-invalid={!!soldAt && !!soldAtError}
            />
          </FormField>
        </div>
      )}

      {cash.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {!cashOpen && <CashAutoOpenNote />}
          <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
            <section aria-label="Produtos">
              <ProductSearch
                storeId={storeId}
                onPick={addItem}
                onPickPack={addPack}
                inputRef={searchRef}
                disabled={readOnly}
              />
            </section>

            <aside
              aria-label="Carrinho"
              className="h-fit rounded-xl border bg-card p-4 lg:sticky lg:top-20"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Carrinho</h2>
                {cart.length > 0 && (
                  <Button variant="ghost" size="xs" onClick={() => dispatch({ type: "clear" })}>
                    Limpar
                  </Button>
                )}
              </div>

              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum item ainda. Passe o leitor ou toque num produto.
                </p>
              ) : (
                <ul className="divide-y">
                  {cart.map((line) => (
                    <li key={line.item.id} className="py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{line.item.product.name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            <Money value={line.item.price} /> cada
                            {line.item.product.bottleType &&
                              ` · ${line.item.product.bottleType.name}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${line.item.product.name}`}
                          onClick={() => dispatch({ type: "remove", id: line.item.id })}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      <div className="mt-1.5 flex items-end justify-between gap-2">
                        <div className="space-y-1">
                          {packSizeOf(line.item) > 1 && (
                            <Stepper
                              label={`Fardos de ${packSizeOf(line.item)}`}
                              name={`Fardos de ${line.item.product.name}`}
                              value={line.packs ?? 0}
                              min={0}
                              max={Math.floor(
                                (line.item.stock - line.quantity) / packSizeOf(line.item),
                              )}
                              onChange={(packs) =>
                                dispatch({ type: "setPacks", id: line.item.id, packs })
                              }
                            />
                          )}
                          <Stepper
                            label={packSizeOf(line.item) > 1 ? "Unidades" : undefined}
                            name={`Quantidade de ${line.item.product.name}`}
                            value={line.quantity}
                            min={(line.packs ?? 0) > 0 ? 0 : 1}
                            max={line.item.stock - (line.packs ?? 0) * packSizeOf(line.item)}
                            onChange={(quantity) =>
                              dispatch({ type: "set", id: line.item.id, quantity })
                            }
                          />
                        </div>
                        <div className="text-right">
                          {(line.packs ?? 0) > 0 && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {formatInt(lineUnits(line))} un.
                            </p>
                          )}
                          <Money
                            value={roundMoney(line.item.price * lineUnits(line))}
                            className="font-semibold"
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 border-t pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <Money value={subtotal} className="text-2xl font-semibold" />
                </div>
                <ActionButton
                  size="lg"
                  className="mt-3 h-12 w-full text-base"
                  disabled={cart.length === 0 || !!soldAtError}
                  onClick={openCheckout}
                >
                  {late ? "Lançar venda (F9)" : "Finalizar venda (F9)"}
                </ActionButton>
                {late && soldAtError && cart.length > 0 && (
                  <p className="mt-2 text-xs text-destructive">{soldAtError}</p>
                )}
                {readOnly && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sistema somente para consulta: não é possível vender agora.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {checkout && (
        <CheckoutDialog
          companyId={companyId}
          title={late ? "Lançar venda antiga" : "Finalizar venda"}
          subtotal={subtotal}
          bottleLines={bottles}
          pending={createSale.isPending}
          error={checkoutError}
          onSubmit={submit}
          onClose={() => setCheckout(false)}
        />
      )}
      {done && (
        <SaleDoneDialog
          sale={done}
          late={late}
          onClose={() => {
            setDone(null);
            searchRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
