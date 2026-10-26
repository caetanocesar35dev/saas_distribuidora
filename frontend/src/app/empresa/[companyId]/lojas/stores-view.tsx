"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import {
  ActionButton,
  RequireCompanyOwner,
  RequireCompanyOwnerPage,
} from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MaskedInput } from "@/components/app/inputs";
import { Input } from "@/components/ui/input";
import { useCnpjAutofill } from "@/hooks/use-cnpj-autofill";
import { useDeleteStore, useSaveStore, useStores } from "@/lib/api/hooks/admin";
import type { Store, StoreBody } from "@/lib/api/types";
import type { CnpjData } from "@/lib/cnpj-lookup";
import { maskCep } from "@/lib/cep-lookup";
import {
  isValidCnpj,
  isValidPhone,
  maskCnpj,
  maskPhone,
  maskUf,
  normalizeCnpj,
} from "@/lib/format";
import { useCompany } from "@/lib/session/context";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome da loja.").max(120),
  cnpj: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidCnpj(v), "CNPJ inválido."),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || isValidPhone(v),
      "Telefone inválido: use DDD + número (fixo ou celular).",
    ),
  // Endereço obrigatório, menos o complemento (decisão do usuário; o backend confere igual).
  zipCode: z
    .string()
    .trim()
    .min(1, "Informe o CEP.")
    .refine((v) => /^\d{5}-\d{3}$/.test(v), "CEP inválido: use 8 números (00000-000)."),
  street: z.string().trim().min(1, "Informe a rua.").max(200, "Use no máximo 200 caracteres."),
  number: z
    .string()
    .trim()
    .min(1, "Informe o número (ou S/N).")
    .max(20, "Use no máximo 20 caracteres."),
  complement: z.string().trim().max(100, "Use no máximo 100 caracteres."),
  neighborhood: z
    .string()
    .trim()
    .min(1, "Informe o bairro.")
    .max(100, "Use no máximo 100 caracteres."),
  city: z.string().trim().min(1, "Informe a cidade.").max(100, "Use no máximo 100 caracteres."),
  state: z
    .string()
    .trim()
    .refine((v) => /^[A-Z]{2}$/.test(v), "Informe a UF com 2 letras (ex.: SP)."),
  cashAutoCloseTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário (ex.: 00:00)."),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: "",
  cnpj: "",
  phone: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  cashAutoCloseTime: "00:00",
};

function toValues(store: Store): Values {
  return {
    name: store.name,
    cnpj: store.cnpj ? maskCnpj(store.cnpj) : "",
    phone: store.phone ? maskPhone(store.phone) : "",
    zipCode: store.zipCode ? maskCep(store.zipCode) : "",
    street: store.street ?? "",
    number: store.number ?? "",
    complement: store.complement ?? "",
    neighborhood: store.neighborhood ?? "",
    city: store.city ?? "",
    state: store.state ? maskUf(store.state) : "",
    cashAutoCloseTime: store.cashAutoCloseTime ?? "00:00",
  };
}

/** Campos vazios não vão para a API (a UF vazia seria recusada). */
function toBody(values: Values): Partial<StoreBody> {
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "name" || value !== "") {
      body[key] =
        key === "state" ? value.toUpperCase() : key === "cnpj" ? normalizeCnpj(value) : value;
    }
  }
  return body;
}

function addressLine(store: Store): string {
  const street = store.street ? `${store.street}${store.number ? `, ${store.number}` : ""}` : "";
  const city = store.city ? `${store.city}${store.state ? `/${store.state}` : ""}` : "";
  return [street, city, store.phone].filter(Boolean).join(" · ") || "Sem endereço cadastrado";
}

/** Campos da loja que a consulta pública do CNPJ preenche (o nome vira o nome fantasia). */
const storeFieldsFromCnpj = (data: CnpjData) => ({
  name: data.nomeFantasia,
  phone: data.phone,
  zipCode: data.zipCode,
  street: data.street,
  number: data.number,
  complement: data.complement,
  neighborhood: data.neighborhood,
  city: data.city,
  state: data.state,
});

const STORE_CNPJ_HINTS = {
  idle: "Se o CNPJ da loja for o mesmo da empresa, deixe em branco. Se ela tem CNPJ próprio (filial), digite: pode ter letras e números, e buscamos o endereço e o telefone.",
  found: "Endereço e telefone preenchidos com a consulta pública do CNPJ. Confira antes de salvar.",
  "not-found": "CNPJ não encontrado na consulta pública. Preencha o endereço abaixo.",
  unavailable: "Não foi possível consultar o CNPJ agora. Preencha o endereço abaixo.",
};

function StoreFormDialog({
  companyId,
  store,
  open,
  onOpenChange,
}: {
  companyId: string;
  store: Store | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{store ? "Editar loja" : "Nova loja"}</DialogTitle>
          <DialogDescription>
            {store
              ? "Altere os dados da loja."
              : "A loja nova já nasce com todos os donos da empresa como donos dela."}
          </DialogDescription>
        </DialogHeader>
        {/* Remonta a cada loja: o formulário e a consulta de CNPJ começam do zero. */}
        <StoreForm
          key={store?.id ?? "nova"}
          companyId={companyId}
          store={store}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function StoreForm({
  companyId,
  store,
  onDone,
}: {
  companyId: string;
  store: Store | null;
  onDone: () => void;
}) {
  const save = useSaveStore(companyId);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: store ? toValues(store) : EMPTY,
  });
  const cnpjLookup = useCnpjAutofill({
    get: (name) => getValues(name),
    set: (name, value) => setValue(name, value, { shouldDirty: true, shouldValidate: true }),
    pick: storeFieldsFromCnpj,
    hints: STORE_CNPJ_HINTS,
  });

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={handleSubmit((values) =>
        save.mutate(
          { id: store?.id, body: toBody(values) },
          {
            onSuccess: () => {
              toast.success(store ? "Loja atualizada." : "Loja criada.");
              onDone();
            },
          },
        ),
      )}
    >
      <FormField
        label="CNPJ da loja (opcional)"
        htmlFor="cnpj"
        error={errors.cnpj?.message}
        hint={<span aria-live="polite">{cnpjLookup.hint}</span>}
      >
        <Controller
          control={control}
          name="cnpj"
          render={({ field }) => (
            <Input
              id="cnpj"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="00.000.000/0000-00"
              aria-invalid={!!errors.cnpj}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => {
                const value = maskCnpj(e.target.value);
                field.onChange(value);
                cnpjLookup.onCnpjChange(value);
              }}
            />
          )}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nome da loja" htmlFor="name" error={errors.name?.message}>
          <Input id="name" maxLength={120} aria-invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="Telefone (opcional)" htmlFor="phone" error={errors.phone?.message}>
          <MaskedInput
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="(81) 3333-4444"
            maxLength={15}
            mask={maskPhone}
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="CEP" htmlFor="zipCode" error={errors.zipCode?.message}>
          <MaskedInput
            id="zipCode"
            inputMode="numeric"
            placeholder="00000-000"
            maxLength={9}
            mask={maskCep}
            aria-invalid={!!errors.zipCode}
            {...register("zipCode")}
          />
        </FormField>
        <FormField
          label="Rua"
          htmlFor="street"
          className="sm:col-span-2"
          error={errors.street?.message}
        >
          <Input id="street" maxLength={200} {...register("street")} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Número" htmlFor="number" error={errors.number?.message}>
          <Input id="number" maxLength={20} {...register("number")} />
        </FormField>
        <FormField
          label="Complemento (opcional)"
          htmlFor="complement"
          className="sm:col-span-2"
          error={errors.complement?.message}
        >
          <Input id="complement" maxLength={100} {...register("complement")} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Bairro" htmlFor="neighborhood" error={errors.neighborhood?.message}>
          <Input id="neighborhood" maxLength={100} {...register("neighborhood")} />
        </FormField>
        <FormField label="Cidade" htmlFor="city" error={errors.city?.message}>
          <Input id="city" maxLength={100} {...register("city")} />
        </FormField>
        <FormField label="UF" htmlFor="state" error={errors.state?.message}>
          <MaskedInput
            id="state"
            maxLength={2}
            placeholder="PE"
            mask={maskUf}
            aria-invalid={!!errors.state}
            {...register("state")}
          />
        </FormField>
      </div>
      <FormField
        label="Fechamento automático do caixa"
        htmlFor="cashAutoCloseTime"
        error={errors.cashAutoCloseTime?.message}
        hint="Se o caixa ficar aberto, ele fecha sozinho neste horário todo dia. Padrão: meia-noite."
      >
        <Input
          id="cashAutoCloseTime"
          type="time"
          className="w-32"
          aria-invalid={!!errors.cashAutoCloseTime}
          {...register("cashAutoCloseTime")}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function StoresList({
  companyId,
  creating,
  onCloseCreate,
}: {
  companyId: string;
  creating: boolean;
  onCloseCreate: () => void;
}) {
  const stores = useStores(companyId);
  const remove = useDeleteStore(companyId);
  const [editing, setEditing] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState<Store | null>(null);

  return (
    <>
      <QueryBoundary query={stores}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="Nenhuma loja cadastrada" />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {list.map((store) => (
                <li key={store.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{store.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{addressLine(store)}</p>
                  </div>
                  <HistoryButton
                    target={{
                      scope: "company",
                      scopeId: companyId,
                      entity: "stores",
                      id: store.id,
                    }}
                    title={`Histórico da loja ${store.name}`}
                  />
                  <ActionButton variant="outline" size="sm" onClick={() => setEditing(store)}>
                    <PencilIcon /> Editar
                  </ActionButton>
                  <ActionButton variant="destructive" size="sm" onClick={() => setDeleting(store)}>
                    <Trash2Icon /> Excluir
                  </ActionButton>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>

      <StoreFormDialog
        companyId={companyId}
        store={editing}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            onCloseCreate();
            setEditing(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir a loja ${deleting?.name ?? ""}?`}
        description="A loja some das listas. Só é possível excluir sem caixa aberto e sem comandas abertas. O histórico dela continua guardado."
        confirmLabel="Excluir loja"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Loja excluída.");
              setDeleting(null);
            },
          })
        }
      />
    </>
  );
}

export function StoresView() {
  const { companyId } = useCompany();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Lojas"
        description="As lojas da empresa. O plano pode limitar quantas lojas você tem."
        help="gestao-lojas"
        actions={
          <RequireCompanyOwner>
            <ActionButton onClick={() => setCreating(true)}>
              <PlusIcon /> Nova loja
            </ActionButton>
          </RequireCompanyOwner>
        }
      />
      <RequireCompanyOwnerPage>
        <StoresList
          companyId={companyId}
          creating={creating}
          onCloseCreate={() => setCreating(false)}
        />
      </RequireCompanyOwnerPage>
    </div>
  );
}
