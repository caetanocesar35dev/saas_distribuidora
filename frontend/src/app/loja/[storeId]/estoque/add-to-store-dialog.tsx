"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingRows } from "@/components/app/common";
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
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import {
  useAddStoreProduct,
  useProducts,
  useStoreProducts,
} from "@/lib/api/hooks/catalog";
import type { Product } from "@/lib/api/types";
import { useStore } from "@/lib/session/context";

/**
 * Coloca à venda nesta loja um produto que já existe no catálogo da empresa. Para um produto que
 * ainda não existe, use Produtos › Novo produto.
 */
export function AddToStoreDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { storeId, companyId } = useStore();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [chosen, setChosen] = useState<Product | null>(null);
  const [price, setPrice] = useState<number | undefined>();
  const [cost, setCost] = useState<number | undefined>();
  const [stock, setStock] = useState<number | undefined>(0);

  const catalog = useProducts(companyId, { search: debounced || undefined, limit: 8 }, open);
  const inStore = useStoreProducts(storeId, { search: debounced || undefined, limit: 100 });
  const add = useAddStoreProduct(storeId);

  const alreadyHere = new Set(inStore.data?.data.map((p) => p.productId));

  function reset() {
    setChosen(null);
    setSearch("");
    setPrice(undefined);
    setCost(undefined);
    setStock(0);
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Colocar produto na loja</DialogTitle>
          <DialogDescription>
            Escolha um produto do catálogo da empresa e defina o preço desta loja.
          </DialogDescription>
        </DialogHeader>

        {!chosen ? (
          <div className="space-y-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9"
                placeholder="Buscar por nome ou código de barras"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {catalog.isPending ? (
              <LoadingRows rows={3} />
            ) : catalog.data?.data.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado no catálogo.
              </p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {catalog.data?.data.map((product) => {
                  const here = alreadyHere.has(product.id);
                  return (
                    <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.code}</p>
                      </div>
                      {here ? (
                        <span className="text-xs text-muted-foreground">Já está na loja</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setChosen(product)}>
                          Escolher
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (price === undefined) return;
              add.mutate(
                { productId: chosen.id, price, costPrice: cost ?? 0, stock: stock ?? 0 },
                {
                  onSuccess: () => {
                    toast.success(`${chosen.name} agora é vendido nesta loja.`);
                    close();
                  },
                },
              );
            }}
          >
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <strong>{chosen.name}</strong>
              <span className="text-muted-foreground"> · {chosen.code}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Preço de venda" htmlFor="add-price">
                <MoneyInput id="add-price" value={price} onChange={setPrice} autoFocus />
              </FormField>
              <FormField label="Custo" htmlFor="add-cost">
                <MoneyInput id="add-cost" value={cost} onChange={setCost} />
              </FormField>
            </div>
            <FormField
              label="Estoque inicial"
              htmlFor="add-stock"
              hint="Quantas unidades já estão nesta loja agora."
            >
              <IntInput id="add-stock" value={stock} onChange={setStock} max={1_000_000} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChosen(null)}>
                Voltar
              </Button>
              <Button type="submit" disabled={price === undefined || add.isPending}>
                {add.isPending ? "Salvando..." : "Colocar na loja"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
