"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/app/form";
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
import { useSaveCustomer } from "@/lib/api/hooks/customers";
import type { Customer } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { useHasRole } from "@/lib/session/context";

/** Cadastro e edição de cliente (o cliente vale para todas as lojas da empresa). */
export function CustomerFormDialog({
  companyId,
  customer,
  onClose,
  onSaved,
}: {
  companyId: string;
  customer: Customer | null;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}) {
  const save = useSaveCustomer(companyId);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  // Limite de crédito do fiado: só gerente e dono definem (o backend recusa o atendente).
  const canSetLimit = useHasRole("MANAGER");
  const [creditLimit, setCreditLimit] = useState<number | undefined>(
    customer?.creditLimit ?? undefined,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            O cadastro vale para todas as lojas da empresa. A dívida (fiado) é separada por loja.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                id: customer?.id,
                body: {
                  name: name.trim(),
                  phone: phone.trim() || undefined,
                  // vazio = sem limite (null); o atendente não envia o campo
                  ...(canSetLimit ? { creditLimit: creditLimit ?? null } : {}),
                },
              },
              {
                onSuccess: (saved) => {
                  toast.success(customer ? "Cliente atualizado." : "Cliente cadastrado.");
                  onSaved?.(saved);
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Nome" htmlFor="cu-name">
            <Input
              id="cu-name"
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Telefone (opcional)" htmlFor="cu-phone">
            <Input
              id="cu-phone"
              inputMode="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>
          {canSetLimit ? (
            <FormField
              label="Limite de crédito no fiado (opcional)"
              htmlFor="cu-limit"
              hint="Soma da dívida em todas as lojas. Acima dele, o atendente não vende no fiado; gerente e dono podem confirmar. Vazio = sem limite."
            >
              <MoneyInput id="cu-limit" value={creditLimit} onChange={setCreditLimit} />
            </FormField>
          ) : (
            customer?.creditLimit != null && (
              <p className="text-sm text-muted-foreground">
                Limite de crédito no fiado: {formatMoney(customer.creditLimit)} (só gerente ou dono
                altera).
              </p>
            )
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim() === "" || save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
