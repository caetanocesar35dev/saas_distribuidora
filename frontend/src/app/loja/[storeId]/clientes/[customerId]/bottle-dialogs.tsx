"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/app/form";
import { IntInput, SelectField } from "@/components/app/inputs";
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
import { errorMessage } from "@/lib/api/client";
import { useCustomerBottleLoan, useCustomerBottleReturn } from "@/lib/api/hooks/bottles";
import { useBottleTypes } from "@/lib/api/hooks/catalog";
import type { CustomerBalances } from "@/lib/api/types";
import { formatInt } from "@/lib/format";
import { useStore } from "@/lib/session/context";

/**
 * Devolução de vasilhame. Regra do produto: a devolução só abate a dívida da PRÓPRIA loja onde o
 * cliente levou. Quem deve na loja A devolve na loja A.
 */
export function BottleReturnDialog({
  customerId,
  balances,
  onClose,
}: {
  customerId: string;
  balances: CustomerBalances;
  onClose: () => void;
}) {
  const { storeId, storeName } = useStore();
  const giveBack = useCustomerBottleReturn(storeId);
  const here = balances.bottles.filter((b) => b.storeId === storeId && b.balance > 0);
  const elsewhere = balances.bottles.filter((b) => b.storeId !== storeId && b.balance > 0);

  const [bottleTypeId, setBottleTypeId] = useState(here[0]?.bottleTypeId ?? "");
  const [quantity, setQuantity] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const owed = here.find((b) => b.bottleTypeId === bottleTypeId)?.balance ?? 0;
  const tooMany = quantity !== undefined && quantity > owed;

  return (
    <Dialog open onOpenChange={(open) => !open && !giveBack.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolução de vasilhame</DialogTitle>
          <DialogDescription>
            A devolução só abate a dívida de vasilhames da loja <strong>{storeName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {elsewhere.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Este cliente também deve vasilhames em outra loja (
            {[...new Set(elsewhere.map((b) => b.storeName))].join(", ")}). Esses só podem ser
            devolvidos lá.
          </div>
        )}

        {here.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este cliente não deve vasilhames nesta loja.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!quantity || tooMany) return;
              setError(null);
              giveBack.mutate(
                { customerId, body: { bottleTypeId, quantity } },
                {
                  onSuccess: () => {
                    toast.success("Devolução registrada.");
                    onClose();
                  },
                  onError: (err) => setError(errorMessage(err)),
                },
              );
            }}
          >
            <FormField label="Vasilhame" htmlFor="br-type">
              <SelectField
                id="br-type"
                value={bottleTypeId}
                onChange={setBottleTypeId}
                options={here.map((b) => ({
                  value: b.bottleTypeId,
                  label: `${b.bottleTypeName} (deve ${formatInt(b.balance)})`,
                }))}
              />
            </FormField>
            <FormField
              label="Quantidade devolvida"
              htmlFor="br-qty"
              error={tooMany ? `O cliente deve só ${formatInt(owed)} desse vasilhame aqui.` : undefined}
            >
              <IntInput id="br-qty" min={1} max={1_000_000} value={quantity} onChange={setQuantity} autoFocus />
            </FormField>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!quantity || tooMany || giveBack.isPending}>
                {giveBack.isPending ? "Registrando..." : "Registrar devolução"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Empréstimo avulso (fora de uma venda): o vasilhame sai da loja e vira dívida do cliente. */
export function BottleLoanDialog({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const { storeId, companyId, storeName } = useStore();
  const types = useBottleTypes(companyId);
  const lend = useCustomerBottleLoan(storeId);
  const [bottleTypeId, setBottleTypeId] = useState("");
  const [quantity, setQuantity] = useState<number | undefined>();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && !lend.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Empréstimo de vasilhame</DialogTitle>
          <DialogDescription>
            O vasilhame sai do estoque de <strong>{storeName}</strong> e passa a ser dívida do
            cliente nesta loja.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!quantity || !bottleTypeId) return;
            setError(null);
            lend.mutate(
              {
                customerId,
                body: { bottleTypeId, quantity, description: description.trim() || undefined },
              },
              {
                onSuccess: () => {
                  toast.success("Empréstimo registrado.");
                  onClose();
                },
                onError: (err) => setError(errorMessage(err)),
              },
            );
          }}
        >
          <FormField label="Vasilhame" htmlFor="bl-type">
            <SelectField
              id="bl-type"
              value={bottleTypeId}
              onChange={setBottleTypeId}
              placeholder="Escolha o tipo"
              options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </FormField>
          <FormField label="Quantidade" htmlFor="bl-qty">
            <IntInput id="bl-qty" min={1} max={1_000_000} value={quantity} onChange={setQuantity} />
          </FormField>
          <FormField label="Observação (opcional)" htmlFor="bl-desc">
            <Input
              id="bl-desc"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!quantity || !bottleTypeId || lend.isPending}>
              {lend.isPending ? "Registrando..." : "Registrar empréstimo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
