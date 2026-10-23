"use client";

import { PlusIcon, SearchIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingRows } from "@/components/app/common";
import { FormField } from "@/components/app/form";
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
import { useCustomers, useSaveCustomer } from "@/lib/api/hooks/customers";
import type { Customer } from "@/lib/api/types";
import { formatPhone } from "@/lib/format";

export interface PickedCustomer {
  id: string;
  name: string;
}

function NewCustomerForm({
  companyId,
  initialName,
  onCreated,
  onCancel,
}: {
  companyId: string;
  initialName: string;
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
}) {
  const save = useSaveCustomer(companyId);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { body: { name: name.trim(), phone: phone.trim() || undefined } },
          {
            onSuccess: (customer) => {
              toast.success(`${customer.name} cadastrado.`);
              onCreated(customer);
            },
          },
        );
      }}
    >
      <FormField label="Nome do cliente" htmlFor="nc-name">
        <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </FormField>
      <FormField label="Telefone (opcional)" htmlFor="nc-phone">
        <Input
          id="nc-phone"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Voltar
        </Button>
        <Button type="submit" disabled={name.trim() === "" || save.isPending}>
          {save.isPending ? "Salvando..." : "Cadastrar e escolher"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PickerDialog({
  companyId,
  onPick,
  onClose,
}: {
  companyId: string;
  onPick: (customer: PickedCustomer) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(search);
  const list = useCustomers(companyId, { search: debounced || undefined, limit: 8 });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{creating ? "Novo cliente" : "Escolher cliente"}</DialogTitle>
          <DialogDescription>
            {creating
              ? "Cadastre o cliente na hora para seguir com a venda."
              : "Busque pelo nome ou telefone."}
          </DialogDescription>
        </DialogHeader>

        {creating ? (
          <NewCustomerForm
            companyId={companyId}
            initialName={search}
            onCancel={() => setCreating(false)}
            onCreated={(customer) => onPick({ id: customer.id, name: customer.name })}
          />
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9"
                placeholder="Nome ou telefone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar cliente"
              />
            </div>
            {list.isPending ? (
              <LoadingRows rows={3} />
            ) : list.data?.data.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            ) : (
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {list.data?.data.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-muted/60"
                      onClick={() => onPick({ id: customer.id, name: customer.name })}
                    >
                      <span className="text-sm font-medium">{customer.name}</span>
                      {customer.phone && (
                        <span className="text-xs text-muted-foreground">
                          {formatPhone(customer.phone)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
              <PlusIcon /> Cadastrar novo cliente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Mostra o cliente escolhido e abre a busca (com cadastro rápido) para escolher ou trocar. */
export function CustomerPicker({
  companyId,
  value,
  onChange,
  required,
  disabled,
}: {
  companyId: string;
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-9 flex-1 justify-start py-1.5"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <UserRoundIcon />
          {value ? (
            <span className="truncate">{value.name}</span>
          ) : (
            <span className="text-muted-foreground">
              {required ? "Escolher cliente (obrigatório)" : "Escolher cliente (opcional)"}
            </span>
          )}
        </Button>
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Tirar cliente"
            onClick={() => onChange(null)}
          >
            <XIcon />
          </Button>
        )}
      </div>
      {open && (
        <PickerDialog
          companyId={companyId}
          onClose={() => setOpen(false)}
          onPick={(customer) => {
            onChange(customer);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
