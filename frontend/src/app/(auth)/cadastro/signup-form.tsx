"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage, publicApi } from "@/lib/api/client";
import type { AuthResponse, Membership, Plan, SignupBody } from "@/lib/api/types";
import { companyFieldsFromCnpj, useCnpjAutofill } from "@/hooks/use-cnpj-autofill";
import { formatCents, isValidCnpj, maskCnpj, normalizeCnpj } from "@/lib/format";
import { resolveHome } from "@/lib/session/last-selection";
import { sessionKeys } from "@/lib/session/queries";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(120),
    email: z.email("Informe um e-mail válido."),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres.")
      .max(72, "A senha deve ter no máximo 72 caracteres."),
    confirm: z.string(),
    cnpj: z.string().refine(isValidCnpj, "CNPJ inválido."),
    razaoSocial: z.string().trim().min(1, "Informe a razão social.").max(200),
    nomeFantasia: z.string().trim().max(200).optional(),
    storeName: z.string().trim().min(1, "Informe o nome da primeira loja.").max(120),
    planId: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "As senhas não são iguais.",
  });
type Values = z.infer<typeof schema>;

function planSummary(plan: Plan) {
  const companies =
    plan.maxCompanies === null ? "empresas ilimitadas" : `${plan.maxCompanies} empresa(s)`;
  const stores =
    plan.maxStoresPerCompany === null
      ? "lojas ilimitadas"
      : `até ${plan.maxStoresPerCompany} loja(s) por empresa`;
  return `${companies}, ${stores}`;
}

export function SignupForm() {
  const router = useRouter();
  const client = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => publicApi.get<Plan[]>("/plans"),
    staleTime: 5 * 60_000,
  });

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { cnpj: "" } });
  const cnpjLookup = useCnpjAutofill({
    get: (name) => getValues(name),
    set: (name, value) => setValue(name, value, { shouldDirty: true, shouldValidate: true }),
    pick: companyFieldsFromCnpj,
  });

  const signup = useMutation({
    mutationFn: (body: SignupBody) => publicApi.post<AuthResponse>("/auth/signup", body),
    meta: { silent: true },
    onSuccess: async () => {
      client.clear();
      const memberships = await client.fetchQuery({
        queryKey: sessionKeys.memberships,
        queryFn: () => api.get<Membership[]>("/me/memberships"),
      });
      router.replace(resolveHome(memberships));
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        signup.mutate({
          name: v.name,
          email: v.email,
          password: v.password,
          cnpj: normalizeCnpj(v.cnpj),
          razaoSocial: v.razaoSocial,
          nomeFantasia: v.nomeFantasia || undefined,
          storeName: v.storeName,
          planId: v.planId || undefined,
        });
      })}
    >
      <div>
        <h1 className="text-xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teste grátis por 14 dias, sem informar cartão.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-medium">Seus dados</legend>
        <FormField label="Seu nome" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Senha" htmlFor="password" error={errors.password?.message} hint="Mínimo de 8 caracteres.">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
          </FormField>
          <FormField label="Repita a senha" htmlFor="confirm" error={errors.confirm?.message}>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-medium">Sua distribuidora</legend>
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
        <FormField label="Nome fantasia (opcional)" htmlFor="nomeFantasia" error={errors.nomeFantasia?.message}>
          <Input id="nomeFantasia" {...register("nomeFantasia")} />
        </FormField>
        <FormField
          label="Nome da primeira loja"
          htmlFor="storeName"
          error={errors.storeName?.message}
          hint="Ex.: Loja Centro. Você poderá cadastrar outras lojas depois."
        >
          <Input id="storeName" aria-invalid={!!errors.storeName} {...register("storeName")} />
        </FormField>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Plano</legend>
        {plans.isPending && <p className="text-sm text-muted-foreground">Carregando planos...</p>}
        {plans.isError && (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os planos. O cadastro usa o plano mais simples.
          </p>
        )}
        {plans.data && (
          <Controller
            control={control}
            name="planId"
            render={({ field }) => (
              <div className="grid gap-2">
                {plans.data.map((plan) => {
                  const selected = (field.value ?? plans.data[0]?.id) === plan.id;
                  return (
                    <label
                      key={plan.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                        selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="plan"
                        className="mt-1 accent-[var(--primary)]"
                        checked={selected}
                        onChange={() => field.onChange(plan.id)}
                      />
                      <span className="flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">{plan.name}</span>
                          <span className="text-sm tabular-nums">
                            {plan.priceInCents === 0 ? "Grátis" : `${formatCents(plan.priceInCents)}/mês`}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">{planSummary(plan)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          />
        )}
        <p className="text-xs text-muted-foreground">
          Os 14 dias de teste valem para qualquer plano. Nenhuma cobrança é feita agora.
        </p>
      </fieldset>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={signup.isPending}>
        {signup.isPending ? "Criando conta..." : "Criar conta e começar"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
        {" · "}
        <Link href="/duvidas/acesso-criar-conta" className="text-primary hover:underline">
          Dúvidas sobre o cadastro
        </Link>
      </p>
    </form>
  );
}
