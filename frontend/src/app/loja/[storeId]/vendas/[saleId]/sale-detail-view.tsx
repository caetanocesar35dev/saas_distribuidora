"use client";

import { ArrowLeftIcon, BanIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Money, PageHeader, QueryBoundary, StatCard } from "@/components/app/common";
import { ActionButton, RequireRole } from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCancelSale, useSale } from "@/lib/api/hooks/sales";
import type { Sale } from "@/lib/api/types";
import {
  BOTTLE_MOVEMENT_LABEL,
  formatDateTime,
  formatInt,
  formatItemQuantity,
  hasMinRole,
  PAYMENT_METHOD_LABEL,
  roundMoney,
  SALE_STATUS_LABEL,
} from "@/lib/format";
import { useStore } from "@/lib/session/context";

function SaleBody({ sale }: { sale: Sale }) {
  const { role } = useStore();
  const manager = hasMinRole(role, "MANAGER");
  const subtotal = roundMoney(sale.items.reduce((s, i) => s + roundMoney(i.price * i.quantity), 0));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={<Money value={sale.total} />} />
        <StatCard label="Pagamento" value={PAYMENT_METHOD_LABEL[sale.paymentMethod]} />
        <StatCard
          label="Data"
          value={formatDateTime(sale.createdAt)}
          hint={
            sale.registeredAt
              ? `Venda antiga, lançada depois em ${formatDateTime(sale.registeredAt)}.`
              : undefined
          }
        />
        <StatCard label="Vendedor" value={sale.user.name} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Situação:</span>
        {sale.status === "CANCELED" ? (
          <Badge variant="destructive">{SALE_STATUS_LABEL.CANCELED}</Badge>
        ) : (
          <Badge variant="secondary">{SALE_STATUS_LABEL.COMPLETED}</Badge>
        )}
        {sale.customer && (
          <span className="text-muted-foreground">· Cliente: {sale.customer.name}</span>
        )}
        {sale.commandTabId && <span className="text-muted-foreground">· Veio de uma comanda</span>}
        {sale.creditApprovedBy && (
          <Badge variant="outline" title="A venda fiada passou do limite de crédito do cliente.">
            Acima do limite, autorizado por {sale.creditApprovedBy.name}
          </Badge>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-medium">Itens</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                {manager && <TableHead className="text-right">Custo</TableHead>}
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.storeProduct.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.storeProduct.product.code}
                    </p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInt(item.quantity)}
                    {item.packs > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatItemQuantity(item.quantity, item.packs, item.packSize)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={item.price} />
                  </TableCell>
                  {manager && (
                    <TableCell className="text-right">
                      <Money value={item.costPrice} />
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Money value={roundMoney(item.price * item.quantity)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={manager ? 4 : 3} className="text-right text-muted-foreground">
                  Subtotal
                </TableCell>
                <TableCell className="text-right">
                  <Money value={subtotal} />
                </TableCell>
              </TableRow>
              {sale.discount > 0 && (
                <TableRow>
                  <TableCell colSpan={manager ? 4 : 3} className="text-right text-muted-foreground">
                    Desconto
                  </TableCell>
                  <TableCell className="text-right">
                    - <Money value={sale.discount} />
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={manager ? 4 : 3} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={sale.total} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      {sale.bottleMovements.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Vasilhames</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {sale.bottleMovements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="font-medium">{m.bottleType.name}</span>
                <span className="text-muted-foreground">{BOTTLE_MOVEMENT_LABEL[m.type]}</span>
                <span className="ml-auto tabular-nums">
                  {m.quantity > 0 ? "+" : ""}
                  {formatInt(m.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function SaleDetailView({ saleId }: { saleId: string }) {
  const { storeId } = useStore();
  const sale = useSale(storeId, saleId);
  const cancel = useCancelSale(storeId);
  const [confirming, setConfirming] = useState(false);

  return (
    <div>
      <Link
        href={`/loja/${storeId}/vendas`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" /> Vendas
      </Link>
      <PageHeader
        title={`Venda #${saleId.slice(0, 8)}`}
        help="vendas-cancelar"
        actions={
          <>
            <HistoryButton
              target={{ scope: "store", scopeId: storeId, entity: "sales", id: saleId }}
              title="Histórico de alterações desta venda"
            />
            <RequireRole min="MANAGER">
              {sale.data?.status === "COMPLETED" && (
                <ActionButton
                  variant="destructive"
                  minRole="MANAGER"
                  onClick={() => setConfirming(true)}
                >
                  <BanIcon /> Cancelar venda
                </ActionButton>
              )}
            </RequireRole>
          </>
        }
      />
      <QueryBoundary query={sale}>{(data) => <SaleBody sale={data} />}</QueryBoundary>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Cancelar esta venda?"
        description="O estoque dos produtos volta, o valor é estornado no caixa (ou na dívida do cliente, se foi fiado) e os vasilhames são desfeitos. É preciso ter o caixa aberto. Venda no fiado já paga em parte não pode ser cancelada."
        confirmLabel="Cancelar venda"
        destructive
        pending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(saleId, {
            onSuccess: () => {
              toast.success("Venda cancelada.");
              setConfirming(false);
            },
          })
        }
      />
    </div>
  );
}
