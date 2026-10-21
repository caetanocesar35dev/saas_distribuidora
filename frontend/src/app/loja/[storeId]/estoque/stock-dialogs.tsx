"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/app/form";
import { IntInput, MoneyInput } from "@/components/app/inputs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useStockAdjustment,
  useStockEntry,
  useUpdateStoreProduct,
} from "@/lib/api/hooks/catalog";
import type { StoreProduct } from "@/lib/api/types";
import { formatInt } from "@/lib/format";

/**
 * Os diálogos abaixo são montados só enquanto há um item escolhido (`item` nunca é nulo aqui),
 * então o formulário recomeça do zero a cada abertura.
 */
interface DialogProps {
  storeId: string;
  item: StoreProduct;
  onClose: () => void;
}

/** Entrada de mercadoria: soma ao estoque (ação separada do ajuste, para o histórico saber a origem). */
export function StockEntryDialog({ storeId, item, onClose }: DialogProps) {
  const entry = useStockEntry(storeId);
  const [quantity, setQuantity] = useState<number | undefined>();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de mercadoria</DialogTitle>
          <DialogDescription>
            {item.product.name}: estoque atual de {formatInt(item.stock)}. A quantidade informada
            é somada ao estoque.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!quantity) return;
            entry.mutate(
              { id: item.id, quantity },
              {
                onSuccess: (saved) => {
                  toast.success(`Entrada registrada. Estoque agora: ${formatInt(saved.stock)}.`);
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Quantidade que chegou" htmlFor="entry-qty">
            <IntInput
              id="entry-qty"
              min={1}
              max={1_000_000}
              value={quantity}
              onChange={setQuantity}
              autoFocus
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!quantity || quantity < 1 || entry.isPending}>
              {entry.isPending ? "Salvando..." : "Registrar entrada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ajuste de inventário: o estoque passa a ser o valor contado, com motivo obrigatório. */
export function StockAdjustDialog({ storeId, item, onClose }: DialogProps) {
  const adjust = useStockAdjustment(storeId);
  const [newStock, setNewStock] = useState<number | undefined>();
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste de inventário</DialogTitle>
          <DialogDescription>
            {item.product.name}: o sistema mostra {formatInt(item.stock)}. Informe quanto você
            contou de verdade e o motivo da diferença.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (newStock === undefined) return;
            adjust.mutate(
              { id: item.id, newStock, reason: reason.trim() },
              {
                onSuccess: (saved) => {
                  toast.success(`Estoque ajustado para ${formatInt(saved.stock)}.`);
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Quantidade contada" htmlFor="adjust-qty">
            <IntInput
              id="adjust-qty"
              min={0}
              max={1_000_000}
              value={newStock}
              onChange={setNewStock}
              autoFocus
            />
          </FormField>
          <FormField
            label="Motivo do ajuste"
            htmlFor="adjust-reason"
            hint="Ex.: quebra, perda, contagem do inventário."
          >
            <Textarea
              id="adjust-reason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={newStock === undefined || reason.trim() === "" || adjust.isPending}
            >
              {adjust.isPending ? "Salvando..." : "Ajustar estoque"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Preço e custo valem só para esta loja; as outras lojas não são afetadas. */
export function PriceDialog({ storeId, item, onClose }: DialogProps) {
  const update = useUpdateStoreProduct(storeId);
  const [price, setPrice] = useState<number | undefined>(item.price);
  const [cost, setCost] = useState<number | undefined>(item.costPrice);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preço e custo</DialogTitle>
          <DialogDescription>
            {item.product.name}. Atenção: o preço e o custo mudam só nesta loja, não nas outras.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (price === undefined || cost === undefined) return;
            update.mutate(
              { id: item.id, body: { price, costPrice: cost } },
              {
                onSuccess: () => {
                  toast.success("Preço e custo atualizados nesta loja.");
                  onClose();
                },
              },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Preço de venda" htmlFor="price">
              <MoneyInput id="price" value={price} onChange={setPrice} autoFocus />
            </FormField>
            <FormField label="Custo" htmlFor="cost">
              <MoneyInput id="cost" value={cost} onChange={setCost} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={price === undefined || cost === undefined || update.isPending}
            >
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
