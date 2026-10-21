"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton, RequireCompanyOwnerPage } from "@/components/app/guards";
import { Input } from "@/components/ui/input";
import { useCompanyData, useUpdateCompany } from "@/lib/api/hooks/admin";
import type { Company } from "@/lib/api/types";
import { formatCnpj } from "@/lib/format";
import { useCompany } from "@/lib/session/context";

const schema = z.object({
  razaoSocial: z.string().trim().min(1, "Informe a razão social.").max(200),
  nomeFantasia: z.string().trim().max(200),
});

function CompanyForm({ company }: { company: Company }) {
  const update = useUpdateCompany(company.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      razaoSocial: company.razaoSocial,
      nomeFantasia: company.nomeFantasia ?? "",
    },
  });

  return (
    <form
      className="max-w-lg space-y-4 rounded-xl border bg-card p-5"
      noValidate
      onSubmit={handleSubmit((values) =>
        update.mutate(values, {
          onSuccess: (saved) => {
            reset({ razaoSocial: saved.razaoSocial, nomeFantasia: saved.nomeFantasia ?? "" });
            toast.success("Dados da empresa salvos.");
          },
        }),
      )}
    >
      <FormField label="CNPJ" htmlFor="cnpj" hint="O CNPJ não pode ser alterado.">
        <Input id="cnpj" value={formatCnpj(company.cnpj)} disabled readOnly />
      </FormField>
      <FormField label="Razão social" htmlFor="razaoSocial" error={errors.razaoSocial?.message}>
        <Input id="razaoSocial" aria-invalid={!!errors.razaoSocial} {...register("razaoSocial")} />
      </FormField>
      <FormField label="Nome fantasia" htmlFor="nomeFantasia" error={errors.nomeFantasia?.message}>
        <Input id="nomeFantasia" {...register("nomeFantasia")} />
      </FormField>
      <ActionButton type="submit" disabled={!isDirty || update.isPending}>
        {update.isPending ? "Salvando..." : "Salvar"}
      </ActionButton>
    </form>
  );
}

export function CompanyDataView() {
  const { companyId } = useCompany();
  const company = useCompanyData(companyId);

  return (
    <div>
      <PageHeader
        title="Dados da empresa"
        help="gestao-empresa"
      />
      <RequireCompanyOwnerPage>
        <QueryBoundary query={company}>{(data) => <CompanyForm company={data} />}</QueryBoundary>
      </RequireCompanyOwnerPage>
    </div>
  );
}
