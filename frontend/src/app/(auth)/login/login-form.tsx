"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage, publicApi } from "@/lib/api/client";
import type { AuthResponse, Membership } from "@/lib/api/types";
import { safeNextPath } from "@/lib/format";
import { resolveHome } from "@/lib/session/last-selection";
import { sessionKeys } from "@/lib/session/queries";

const schema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const login = useMutation({
    mutationFn: (values: Values) => publicApi.post<AuthResponse>("/auth/login", values),
    meta: { silent: true },
    onSuccess: async ({ user }) => {
      // Já com a sessão nos cookies, descobre para onde ir (loja única, última loja ou seleção).
      client.clear();
      const memberships = await client.fetchQuery({
        queryKey: sessionKeys.memberships,
        queryFn: () => api.get<Membership[]>("/me/memberships"),
      });
      router.replace(safeNextPath(params.get("next")) ?? resolveHome(memberships, user.platformRole));
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        login.mutate(values);
      })}
    >
      <div>
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use o e-mail e a senha da sua conta.
        </p>
      </div>

      <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>

      <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </FormField>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>
        {login.isPending ? "Entrando..." : "Entrar"}
      </Button>

      <div className="flex flex-col gap-1 text-center text-sm">
        <Link href="/esqueci-a-senha" className="text-primary hover:underline">
          Esqueci a senha
        </Link>
        <span className="text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-primary hover:underline">
            Teste grátis por 14 dias
          </Link>
        </span>
      </div>
    </form>
  );
}
