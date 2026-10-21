"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton } from "@/components/app/guards";
import { Input } from "@/components/ui/input";
import { useCreateCompany, useOrganizations } from "@/lib/api/hooks/admin";
import type { OrganizationSummary } from "@/lib/api/types";
import { companyFieldsFromCnpj, useCnpjAutofill } from "@/hooks/use-cnpj-autofill";
import { isValidCnpj, maskCnpj, normalizeCnpj } from "@/lib/format";
import { useCompany } from "@/lib/session/context";

const schema = z.object({
  cnpj: z.string().refine(isValidCnpj, "CNPJ inválido."),
  razaoSocial: z.string().trim().min(1, "Informe a razão social.").max(200),
  nomeFantasia: z.string().trim().max(200),
  storeName: z.string().trim().min(1, "Informe o nome da primeira loja.").max(120),
});

function limitText(organization: OrganizationSummary): string {
  const max = organization.plan.maxCompanies;
  const used = organization.companies.length;
  return max === null
    ? `Seu plano (${organization.plan.name}) permite empresas ilimitadas. Hoje você tem ${used}.`
    : `Seu plano (${organization.plan.name}) permite ${max} empresa(s). Hoje você tem ${used}.`;
}

function NewCompanyForm({ organization }: { organization: OrganizationSummary }) {
  const router = useRouter();
  const create = useCreateCompany(organization.id);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { cnpj: "", razaoSocial: "", nomeFantasia: "", storeName: "" },
  });
  const cnpjLookup = useCnpjAutofill({
    get: (name) => getValues(name),
    set: (name, value) => setValue(name, value, { shouldDirty: true, shouldValidate: true }),
    pick: companyFieldsFromCnpj,
  });

  return (
    <form
      noValidate
      className="max-w-lg space-y-4 rounded-xl border bg-card p-5"
      onSubmit={handleSubmit((values) =>
        create.mutate(
          {
            cnpj: normalizeCnpj(values.cnpj),
            razaoSocial: values.razaoSocial,
            nomeFantasia: values.nomeFantasia || undefined,
            storeName: values.storeName,
          },
          {
            onSuccess: ({ store }) => {
              toast.success("Empresa criada.");
              router.push(`/loja/${store.id}`);
            },
          },
        ),
      )}
    >
      <p className="text-sm text-muted-foreground">{limitText(organization)}</p>
      <FormField
        label="CNPJ"
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
      <FormField label="Razão social" htmlFor="razaoSocial" error={errors.razaoSocial?.message}>
        <Input id="razaoSocial" aria-invalid={!!errors.razaoSocial} {...register("razaoSocial")} />
      </FormField>
      <FormField label="Nome fantasia (opcional)" htmlFor="nomeFantasia">
        <Input id="nomeFantasia" {...register("nomeFantasia")} />
      </FormField>
      <FormField label="Nome da primeira loja" htmlFor="storeName" error={errors.storeName?.message}>
        <Input id="storeName" aria-invalid={!!errors.storeName} {...register("storeName")} />
      </FormField>
      <ActionButton type="submit" disabled={create.isPending}>
        {create.isPending ? "Criando..." : "Criar empresa"}
      </ActionButton>
    </form>
  );
}

export function NewCompanyView() {
  const { organizationId, isBillingOwner } = useCompany();
  const organizations = useOrganizations();

  return (
    <div>
      <PageHeader
        title="Nova empresa"
        description="Cadastre outra distribuidora na mesma conta de cobrança."
        help="gestao-nova-empresa"
      />
      {!isBillingOwner ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          Só o responsável pela assinatura pode cadastrar uma nova empresa.
        </p>
      ) : (
        <QueryBoundary query={organizations}>
          {(list) => {
            const organization = list.find((o) => o.id === organizationId);
            return organization ? (
              <NewCompanyForm organization={organization} />
            ) : (
              <p className="text-sm text-muted-foreground">Organização não encontrada.</p>
            );
          }}
        </QueryBoundary>
      )}
    </div>
  );
}
