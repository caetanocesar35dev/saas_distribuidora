"use client";

import { useQueries } from "@tanstack/react-query";
import { ArrowLeftIcon, BanIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Money, PageHeader, QueryBoundary } from "@/components/app/common";
import { ActionButton } from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { CheckoutDialog, type BottleLine, type CheckoutPayload } from "@/components/app/pos/checkout-dialog";
import { ProductSearch } from "@/components/app/pos/product-search";
import { Badge } from "@/components/ui/badge";
import { errorMessage, storeApi } from "@/lib/api/client";
import {
  useAddTabItem,
  useCancelCommandTab,
  useCloseCommandTab,
  useCommandTab,
  useRemoveTabItem,
} from "@/lib/api/hooks/sales";
import type { CommandTab, StoreProduct } from "@/lib/api/types";
import { formatDateTime, formatInt, roundMoney } from "@/lib/format";
import { useAccess, useStore } from "@/lib/session/context";

/** Os itens da comanda não trazem o vasilhame do produto: busca os produtos para saber. */
function useTabBottles(storeId: string, tab: CommandTab): BottleLine[] {
  const ids = [...new Set(tab.items.map((i) => i.storeProductId))];
  const products = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["store", storeId, "store-products", "detail", id],
      queryFn: () => storeApi(storeId).get<StoreProduct>(`/store-products/${id}`),
      staleTime: 60_000,
    })),
  });

  return useMemo(() => {
    const byType = new Map<string, BottleLine>();
    for (const item of tab.items) {
      const product = products.find((q) => q.data?.id === item.storeProductId)?.data;
      const bottle = product?.product.bottleType;
      if (!bottle) continue;
      const current = byType.get(bottle.id);
      byType.set(bottle.id, {
        bottleTypeId: bottle.id,
        name: bottle.name,
        taken: (current?.taken ?? 0) + item.quantity,
      });
    }
    return [...byType.values()];
  }, [tab.items, products]);
}

function TabBody({ tab }: { tab: CommandTab }) {
  const router = useRouter();
  const { storeId, companyId } = useStore();
  const { readOnly } = useAccess();
  const add = useAddTabItem(storeId, tab.id);
  const removeItem = useRemoveTabItem(storeId, tab.id);
  const close = useCloseCommandTab(storeId, tab.id);
  const cancel = useCancelCommandTab(storeId, tab.id);
  const bottles = useTabBottles(storeId, tab);

  const [checkout, setCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const open = tab.status === "OPEN";

  function pick(item: StoreProduct) {
    add.mutate({ storeProductId: item.id, quantity: 1 });
  }

  function submit(payload: CheckoutPayload) {
    setCheckoutError(null);
    close.mutate(
      {
        paymentMethod: payload.paymentMethod,
        discount: payload.discount > 0 ? payload.discount : undefined,
        customerId: payload.customerId,
        bottleReturns: payload.bottleReturns.length > 0 ? payload.bottleReturns : undefined,
      },
      {
        onSuccess: (sale) => {
          toast.success("Comanda fechada e venda registrada.");
          router.push(`/loja/${storeId}/vendas/${sale.id}`);
        },
        onError: (error) => setCheckoutError(errorMessage(error)),
      },
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
      {open ? (
        <section aria-label="Adicionar itens">
          <h2 className="mb-2 font-medium">Adicionar item</h2>
          <ProductSearch storeId={storeId} onPick={pick} disabled={readOnly || add.isPending} />
        </section>
      ) : (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          Esta comanda já foi fechada. Os itens estão ao lado e a venda gerada fica em Vendas.
        </p>
      )}

      <aside className="h-fit rounded-xl border bg-card p-4 lg:sticky lg:top-20">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">{tab.name}</h2>
          {open ? <Badge variant="secondary">Aberta</Badge> : <Badge variant="outline">Fechada</Badge>}
        </div>
        {tab.customer && (
          <p className="mb-2 text-sm text-muted-foreground">Cliente: {tab.customer.name}</p>
        )}

        {tab.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item lançado.</p>
        ) : (
          <ul className="divide-y">
            {tab.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.storeProduct.product.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatInt(item.quantity)} × <Money value={item.price} /> · {formatDateTime(item.addedAt)}
                  </p>
                </div>
                <Money value={roundMoney(item.price * item.quantity)} className="text-sm font-semibold" />
                {open && (
                  <ActionButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover ${item.storeProduct.product.name}`}
                    disabled={removeItem.isPending}
                    onClick={() =>
                      removeItem.mutate(item.id, {
                        onSuccess: () => toast.success("Item removido e estoque devolvido."),
                      })
                    }
                  >
                    <Trash2Icon />
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 border-t pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total parcial</span>
            <Money value={tab.total} className="text-2xl font-semibold" />
          </div>
          {open && (
            <div className="mt-3 flex flex-col gap-2">
              <ActionButton
                size="lg"
                className="h-11 w-full"
                disabled={tab.items.length === 0}
                onClick={() => {
                  setCheckoutError(null);
                  setCheckout(true);
                }}
              >
                <ReceiptTextIcon /> Fechar comanda
              </ActionButton>
              <ActionButton variant="outline" className="w-full" onClick={() => setCancelling(true)}>
                <BanIcon /> Cancelar comanda
              </ActionButton>
            </div>
          )}
        </div>
      </aside>

      {checkout && (
        <CheckoutDialog
          companyId={companyId}
          title="Fechar comanda"
          subtotal={tab.total}
          bottleLines={bottles}
          initialCustomer={tab.customer}
          pending={close.isPending}
          error={checkoutError}
          onSubmit={submit}
          onClose={() => setCheckout(false)}
        />
      )}

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancelar esta comanda?"
        description="Todos os itens voltam para o estoque e a comanda sai da lista. Nenhuma venda é registrada."
        confirmLabel="Cancelar comanda"
        destructive
        pending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: () => {
              toast.success("Comanda cancelada e estoque devolvido.");
              router.push(`/loja/${storeId}/comandas`);
            },
          })
        }
      />
    </div>
  );
}

export function TabDetailView({ tabId }: { tabId: string }) {
  const { storeId } = useStore();
  const tab = useCommandTab(storeId, tabId);

  return (
    <div>
      <Link
        href={`/loja/${storeId}/comandas`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" /> Comandas
      </Link>
      <PageHeader
        title="Comanda"
        help="comandas-itens"
        actions={
          <HistoryButton
            target={{ scope: "store", scopeId: storeId, entity: "command-tabs", id: tabId }}
            title="Histórico de alterações desta comanda"
          />
        }
      />
      <QueryBoundary query={tab}>{(data) => <TabBody tab={data} />}</QueryBoundary>
    </div>
  );
}
