"use client";

import { ScanBarcodeIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingRows, Money } from "@/components/app/common";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { ApiError, storeApi } from "@/lib/api/client";
import { useStoreProducts } from "@/lib/api/hooks/catalog";
import type { StoreProduct } from "@/lib/api/types";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Busca de produtos do PDV e das comandas.
 *  - Digitando: lista os produtos ativos da loja (nome ou código).
 *  - Enter (ou o leitor de código de barras, que "digita" o código e dá Enter): procura o código
 *    exato e já adiciona. Se não achar código, mas a busca tiver um resultado só, adiciona esse.
 */
export function ProductSearch({
  storeId,
  onPick,
  onPickPack,
  inputRef,
  disabled,
}: {
  storeId: string;
  onPick: (item: StoreProduct) => void;
  /** Venda em lote: mostra "+ fardo" nos produtos com fardo cadastrado (`packQuantity` > 1). */
  onPickPack?: (item: StoreProduct) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  disabled?: boolean;
}) {
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const [text, setText] = useState("");
  const debounced = useDebounced(text, 250);
  const [scanning, setScanning] = useState(false);
  const term = debounced.trim();

  const results = useStoreProducts(storeId, {
    search: term || undefined,
    isActive: true,
    limit: 18,
  });

  /** Depois de escolher um produto, limpa a busca e volta o foco para o próximo (leitor ou digitação). */
  function pick(item: StoreProduct, asPack = false) {
    if (asPack && onPickPack) onPickPack(item);
    else onPick(item);
    setText("");
    ref.current?.focus();
  }

  async function handleEnter() {
    const code = text.trim();
    if (!code || scanning) return;
    setScanning(true);
    try {
      const item = await storeApi(storeId).get<StoreProduct>(
        `/store-products/by-code/${encodeURIComponent(code)}`,
      );
      pick(item);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Não é um código: se a busca por nome só tem um resultado, usa esse.
        const only = results.data?.data;
        if (only && only.length === 1 && term === code) {
          pick(only[0]);
        } else {
          toast.error(`Nenhum produto ativo com "${code}" nesta loja.`);
        }
      } else if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <ScanBarcodeIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          autoFocus
          autoComplete="off"
          disabled={disabled}
          className="h-11 pl-10 text-base"
          placeholder="Passe o leitor ou digite o nome do produto (F2)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleEnter();
            }
          }}
          aria-label="Buscar produto por nome ou código de barras"
        />
      </div>

      {results.isPending ? (
        <LoadingRows rows={3} />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : results.data.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {term ? "Nenhum produto encontrado." : "Nenhum produto à venda nesta loja."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
          {results.data.data.map((item) => {
            const out = item.stock <= 0;
            const packSize = item.product.packQuantity;
            const sellsPack = !!onPickPack && packSize > 1;
            return (
              // Um card só por produto: a faixa de fardo fica DENTRO da borda do card, para não
              // haver dúvida sobre a qual produto ela pertence numa grade cheia.
              <li
                key={item.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-xl border bg-card transition-colors",
                  out ? "opacity-50" : "hover:border-primary/50",
                )}
              >
                <button
                  type="button"
                  disabled={disabled || out}
                  onClick={() => pick(item)}
                  className={cn(
                    "flex w-full flex-1 flex-col items-start gap-1 p-3 text-left transition-colors",
                    out ? "cursor-not-allowed" : "hover:bg-primary/5 active:bg-primary/10",
                  )}
                >
                  <span className="line-clamp-2 text-sm font-medium">{item.product.name}</span>
                  <span className="mt-auto flex w-full items-baseline justify-between gap-2">
                    <Money value={item.price} className="font-semibold" />
                    <span
                      className={cn(
                        "text-xs",
                        out ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {out ? "Sem estoque" : `${formatInt(item.stock)} em estoque`}
                    </span>
                  </span>
                </button>
                {sellsPack && (
                  <div className="grid grid-cols-2 divide-x border-t text-xs font-medium">
                    <button
                      type="button"
                      disabled={disabled || out}
                      onClick={() => pick(item)}
                      aria-label={`Adicionar 1 unidade de ${item.product.name}`}
                      className="whitespace-nowrap px-2 py-2 transition-colors hover:bg-primary/5 active:bg-primary/10 disabled:cursor-not-allowed"
                    >
                      + 1 un.
                    </button>
                    <button
                      type="button"
                      disabled={disabled || item.stock < packSize}
                      onClick={() => pick(item, true)}
                      aria-label={`Adicionar 1 fardo de ${packSize} de ${item.product.name}`}
                      className="whitespace-nowrap px-2 py-2 text-primary transition-colors hover:bg-primary/5 active:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
                    >
                      + fardo ({packSize})
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
