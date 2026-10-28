"use client";

import { useRef, useState } from "react";
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
import { useCepAutofill } from "@/hooks/use-cep-autofill";
import { useSaveCustomer } from "@/lib/api/hooks/customers";
import type { Customer } from "@/lib/api/types";
import { maskCep } from "@/lib/cep-lookup";
import { formatMoney } from "@/lib/format";
import { useHasRole } from "@/lib/session/context";

type Address = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};
/** Campos que a consulta de CEP preenche (número e complemento a pessoa digita). */
type AddressFilledByCep = "street" | "neighborhood" | "city" | "state";

/**
 * Endereço para o corpo da requisição. Ao editar, vai tudo (texto vazio apaga o campo no backend);
 * ao criar, só o que foi preenchido. A UF incompleta (1 letra) não vai: o backend exige 2.
 */
function addressBody(address: Address, editing: boolean): Partial<Address> {
  const body: Partial<Address> = {};
  for (const key of Object.keys(address) as (keyof Address)[]) {
    const value = address[key].trim();
    if (key === "state" && value.length === 1) continue;
    if (editing || value !== "") body[key] = value;
  }
  return body;
}

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

  // Endereço (opcional). O espelho em ref deixa a consulta de CEP, que termina depois da
  // digitação, ler o valor atual dos campos para nunca apagar o que a pessoa digitou.
  const [address, setAddress] = useState<Address>({
    zipCode: customer?.zipCode ?? "",
    street: customer?.street ?? "",
    number: customer?.number ?? "",
    complement: customer?.complement ?? "",
    neighborhood: customer?.neighborhood ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
  });
  const addressRef = useRef(address);
  function setField(name: keyof Address, value: string) {
    addressRef.current = { ...addressRef.current, [name]: value };
    setAddress(addressRef.current);
  }
  const cep = useCepAutofill<AddressFilledByCep>({
    get: (name) => addressRef.current[name],
    set: setField,
    pick: (data) => data,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
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
                  // Endereço: ao editar, texto vazio apaga o campo; ao criar, só vai o que foi preenchido.
                  ...addressBody(address, !!customer),
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
          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Endereço (opcional)</legend>
            <FormField
              label="CEP"
              htmlFor="cu-zip"
              hint={<span aria-live="polite">{cep.hint}</span>}
            >
              <Input
                id="cu-zip"
                inputMode="numeric"
                autoComplete="off"
                placeholder="00000-000"
                value={address.zipCode}
                onChange={(e) => {
                  const value = maskCep(e.target.value);
                  setField("zipCode", value);
                  cep.onCepChange(value);
                }}
              />
            </FormField>
            <FormField label="Rua" htmlFor="cu-street">
              <Input
                id="cu-street"
                maxLength={200}
                value={address.street}
                onChange={(e) => setField("street", e.target.value)}
              />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Número" htmlFor="cu-number">
                <Input
                  id="cu-number"
                  maxLength={20}
                  value={address.number}
                  onChange={(e) => setField("number", e.target.value)}
                />
              </FormField>
              <FormField label="Complemento" htmlFor="cu-complement" className="col-span-2">
                <Input
                  id="cu-complement"
                  maxLength={100}
                  value={address.complement}
                  onChange={(e) => setField("complement", e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Bairro" htmlFor="cu-neighborhood">
                <Input
                  id="cu-neighborhood"
                  maxLength={100}
                  value={address.neighborhood}
                  onChange={(e) => setField("neighborhood", e.target.value)}
                />
              </FormField>
              <FormField label="Cidade" htmlFor="cu-city">
                <Input
                  id="cu-city"
                  maxLength={100}
                  value={address.city}
                  onChange={(e) => setField("city", e.target.value)}
                />
              </FormField>
              <FormField label="UF" htmlFor="cu-state">
                <Input
                  id="cu-state"
                  maxLength={2}
                  className="uppercase"
                  value={address.state}
                  onChange={(e) => setField("state", e.target.value.toUpperCase())}
                />
              </FormField>
            </div>
          </fieldset>
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
