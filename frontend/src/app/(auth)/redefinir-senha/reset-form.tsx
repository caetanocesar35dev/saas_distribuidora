"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/app/form";
import { PasswordInput } from "@/components/app/inputs";
import { LinkButton } from "@/components/app/link-button";
import { Button } from "@/components/ui/button";
import { publicApi } from "@/lib/api/client";
import type { MessageResponse } from "@/lib/api/types";

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres.")
      .max(72, "A senha deve ter no máximo 72 caracteres."),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "As senhas não são iguais.",
  });
type Values = z.infer<typeof schema>;

/**
 * Link enviado por e-mail: serve para redefinir a senha (vale 30 min) e também para o convidado
 * de uma equipe criar a primeira senha (vale 7 dias). Só funciona uma vez.
 */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const reset = useMutation({
    mutationFn: (values: Values) =>
      publicApi.post<MessageResponse>("/auth/reset-password", {
        token,
        newPassword: values.newPassword,
      }),
    meta: { silent: true },
  });

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Link incompleto</h1>
        <p className="text-sm text-muted-foreground">
          Abra o link completo que enviamos por e-mail. Se precisar, peça um novo.
        </p>
        <Link href="/esqueci-a-senha" className="text-sm text-primary hover:underline">
          Pedir novo link
        </Link>
      </div>
    );
  }

  if (reset.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Senha criada</h1>
        <p className="text-sm text-muted-foreground">
          Pronto! Agora você já pode entrar com a nova senha.
        </p>
        <LinkButton href="/login" size="lg" className="w-full">
          Ir para entrar
        </LinkButton>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit((values) => reset.mutate(values))}
    >
      <div>
        <h1 className="text-xl font-semibold">Criar nova senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma senha com pelo menos 8 caracteres.
        </p>
      </div>
      <FormField label="Nova senha" htmlFor="newPassword" error={errors.newPassword?.message}>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          autoFocus
          aria-invalid={!!errors.newPassword}
          {...register("newPassword")}
        />
      </FormField>
      <FormField label="Repita a nova senha" htmlFor="confirm" error={errors.confirm?.message}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          {...register("confirm")}
        />
      </FormField>

      {reset.isError && (
        <div
          role="alert"
          className="space-y-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>{reset.error.message}</p>
          <Link href="/esqueci-a-senha" className="font-medium underline">
            Pedir um novo link
          </Link>
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={reset.isPending}>
        {reset.isPending ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
