"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, Money, QueryBoundary } from "@/components/app/common";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { useBottleStock, useSetStoreBottlePrice } from "@/lib/api/hooks/bottles";
import type { BottleStockLine } from "@/lib/api/types";
import { CASCO_SOURCE_LABEL, cascoPriceSource } from "@/lib/bottle-price";
import { formatInt, formatMoney } from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { cn } from "@/lib/utils";

/** Preço próprio do casco nesta loja; vazio (ou "Usar o preço da empresa") volta ao da empresa. */
function StorePriceDialog({
  line,
  storeName,
  onClose,
}: {
  line: BottleStockLine;
  storeName: string;
  onClose: () => void;
}) {
  const { storeId } = useStore();
  const save = useSetStoreBottlePrice(storeId);
  const [price, setPrice] = useState<number | undefined>(line.storePrice ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const priceInvalid = price !== undefined && price <= 0;

  function submit(value: number | null) {
    setError(null);
    save.mutate(
      { bottleTypeId: line.bottleTypeId, price: value },
      {
        onSuccess: () => {
          toast.success(
            value === null
              ? `${line.bottleTypeName}: vale o preço da empresa nesta loja.`
              : `${line.bottleTypeName}: preço do casco nesta loja salvo.`,
          );
          onClose();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preço do casco em {storeName}</DialogTitle>
          <DialogDescription>
            {line.bottleTypeName}.{" "}
            {line.companyPrice !== null
              ? `O preço da empresa é ${formatMoney(line.companyPrice)}.`
              : "A empresa não definiu preço para este casco."}{" "}
            Deixe em branco para usar o preço da empresa nesta loja.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(price ?? null);
          }}
        >
          <FormField
            label="Preço do casco nesta loja"
            htmlFor="store-casco-price"
            hint="Vale só nesta loja. As outras continuam com o preço da empresa (ou com o delas)."
            error={priceInvalid ? "O preço do casco deve ser maior que zero." : undefined}
          >
            <MoneyInput id="store-casco-price" value={price} onChange={setPrice} autoFocus />
          </FormField>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {line.storePrice !== null ? (
              <Button
                type="button"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => submit(null)}
              >
                Usar o preço da empresa
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={priceInvalid || save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StockTab() {
  const { storeId, storeName } = useStore();
  const stock = useBottleStock(storeId);
  const [editing, setEditing] = useState<BottleStockLine | null>(null);

  return (
    <QueryBoundary query={stock}>
      {(lines) =>
        lines.length === 0 ? (
          <EmptyState
            title="Nenhum tipo de vasilhame cadastrado"
            description="Cadastre os tipos (ex.: Garrafa 600 ml, Caixa de cerveja) para controlar o estoque."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de vasilhame</TableHead>
                    <TableHead className="text-right">Na loja agora</TableHead>
                    <TableHead>Preço do casco</TableHead>
                    <RequireRole min="MANAGER">
                      <TableHead className="w-0" />
                    </RequireRole>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const source = cascoPriceSource(line);
                    return (
                      <TableRow key={line.bottleTypeId}>
                        <TableCell className="font-medium">{line.bottleTypeName}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            line.stock < 0 && "font-semibold text-destructive",
                          )}
                        >
                          {formatInt(line.stock)}
                        </TableCell>
                        <TableCell>
                          {line.price !== null && (
                            <Money value={line.price} className="font-medium" />
                          )}
                          <span
                            className={cn(
                              "text-xs text-muted-foreground",
                              line.price !== null && "ml-2",
                            )}
                          >
                            {source === "none"
                              ? "Não é vendido (só troca ou empréstimo)"
                              : CASCO_SOURCE_LABEL[source]}
                          </span>
                        </TableCell>
                        <RequireRole min="MANAGER">
                          <TableCell className="text-right">
                            <ActionButton
                              variant="outline"
                              size="sm"
                              minRole="MANAGER"
                              aria-label={`Preço do casco ${line.bottleTypeName} nesta loja`}
                              onClick={() => setEditing(line)}
                            >
                              <PencilIcon /> Preço nesta loja
                            </ActionButton>
                          </TableCell>
                        </RequireRole>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {editing && (
              <StorePriceDialog
                line={editing}
                storeName={storeName}
                onClose={() => setEditing(null)}
              />
            )}
          </>
        )
      }
    </QueryBoundary>
  );
}
