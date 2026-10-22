"use client";

import { CheckCircle2Icon, MinusIcon, PlusIcon, ShoppingCartIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Money, PageHeader } from "@/components/app/common";
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
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/client";
import { useCurrentCash } from "@/lib/api/hooks/cash";
import { useCreateSale } from "@/lib/api/hooks/sales";
import type { Sale, StoreProduct } from "@/lib/api/types";
import { formatInt, PAYMENT_METHOD_LABEL, roundMoney } from "@/lib/format";
import { useAccess, useStore } from "@/lib/session/context";
import { cartBottles, cartReducer, cartSubtotal } from "./cart";

function CashClosedNotice({ storeId }: { storeId: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
      <ShoppingCartIcon className="size-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">O caixa está fechado</h2>
      <p className="text-sm text-muted-foreground">
        Para vender (inclusive no fiado) é preciso ter o caixa aberto nesta loja.
      </p>
      <LinkButton href={`/loja/${storeId}/caixa`} size="lg">
        Abrir o caixa
      </LinkButton>
    </div>
  );
}

function SaleDoneDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { storeId } = useStore();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2Icon className="size-7" />
          </div>
          <DialogTitle className="text-center text-lg">Venda concluída</DialogTitle>
          <DialogDescription className="text-center">
            {PAYMENT_METHOD_LABEL[sale.paymentMethod]}
            {sale.customer && ` · ${sale.customer.name}`}
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
                  {m.quantity > 0 ? `devolveu ${formatInt(m.quantity)}` : `levou ${formatInt(-m.quantity)}`}
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
            Nova venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PosView() {
  const { storeId, companyId } = useStore();
  const { readOnly } = useAccess();
  const cash = useCurrentCash(storeId);
  const createSale = useCreateSale(storeId);

  const [cart, dispatch] = useReducer(cartReducer, []);
  const [checkout, setCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [done, setDone] = useState<Sale | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const subtotal = cartSubtotal(cart);
  const bottles = useMemo(() => cartBottles(cart), [cart]);
  const cashOpen = !!cash.data;
  const blocked = readOnly || !cashOpen;

  const addItem = useCallback(
    (item: StoreProduct) => {
      const inCart = cart.find((l) => l.item.id === item.id)?.quantity ?? 0;
      if (item.stock <= 0) {
        toast.error(`${item.product.name} está sem estoque.`);
        return;
      }
      if (inCart + 1 > item.stock) {
        toast.error(`Só há ${formatInt(item.stock)} de ${item.product.name} em estoque.`);
        return;
      }
      dispatch({ type: "add", item });
    },
    [cart],
  );

  const openCheckout = useCallback(() => {
    if (cart.length === 0 || blocked) return;
    setCheckoutError(null);
    setCheckout(true);
  }, [cart.length, blocked]);

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
    createSale.mutate(
      {
        paymentMethod: payload.paymentMethod,
        customerId: payload.customerId,
        discount: payload.discount > 0 ? payload.discount : undefined,
        items: cart.map((l) => ({ storeProductId: l.item.id, quantity: l.quantity })),
        bottleReturns: payload.bottleReturns.length > 0 ? payload.bottleReturns : undefined,
        allowOverCreditLimit: payload.allowOverCreditLimit,
      },
      {
        onSuccess: (sale) => {
          setCheckout(false);
          dispatch({ type: "clear" });
          setDone(sale);
        },
        // Estoque insuficiente, caixa fechado... a mensagem do backend aparece e o carrinho fica.
        onError: (error) => setCheckoutError(errorMessage(error)),
      },
    );
  }

  return (
    <div>
      <PageHeader
        title="Vender"
        description="Passe o leitor de código de barras ou busque o produto. F2 busca, F9 finaliza."
        help="vendas-vender"
      />

      {cash.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !cashOpen ? (
        <CashClosedNotice storeId={storeId} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
          <section aria-label="Produtos">
            <ProductSearch storeId={storeId} onPick={addItem} inputRef={searchRef} disabled={readOnly} />
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
                          {line.item.product.bottleType && ` · ${line.item.product.bottleType.name}`}
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
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Diminuir quantidade"
                          disabled={line.quantity <= 1}
                          onClick={() =>
                            dispatch({ type: "set", id: line.item.id, quantity: line.quantity - 1 })
                          }
                        >
                          <MinusIcon />
                        </Button>
                        <input
                          aria-label={`Quantidade de ${line.item.product.name}`}
                          inputMode="numeric"
                          className="h-8 w-12 rounded-lg border bg-transparent text-center text-sm tabular-nums"
                          value={line.quantity}
                          onChange={(e) => {
                            const n = Math.trunc(Number(e.target.value.replace(/\D/g, "")));
                            if (n >= 1) {
                              dispatch({
                                type: "set",
                                id: line.item.id,
                                quantity: Math.min(n, Math.max(line.item.stock, 1)),
                              });
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Aumentar quantidade"
                          onClick={() => addItem(line.item)}
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                      <Money
                        value={roundMoney(line.item.price * line.quantity)}
                        className="font-semibold"
                      />
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
                disabled={cart.length === 0}
                onClick={openCheckout}
              >
                Finalizar venda (F9)
              </ActionButton>
              {readOnly && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sistema somente para consulta: não é possível vender agora.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      {checkout && (
        <CheckoutDialog
          companyId={companyId}
          title="Finalizar venda"
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
          onClose={() => {
            setDone(null);
            searchRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
