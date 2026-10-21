"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicApi } from "@/lib/api/client";
import type { MessageResponse } from "@/lib/api/types";

const schema = z.object({ email: z.email("Informe um e-mail válido.") });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const send = useMutation({
    mutationFn: (values: Values) =>
      publicApi.post<MessageResponse>("/auth/forgot-password", values),
  });

  if (send.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Verifique seu e-mail</h1>
        {/* A resposta é sempre a mesma, exista o e-mail ou não. */}
        <p className="text-sm text-muted-foreground">
          Se o e-mail estiver cadastrado, enviaremos as instruções para criar uma senha nova. O
          link vale por 30 minutos.
        </p>
        <p className="text-xs text-muted-foreground">
          Não chegou? Olhe a caixa de spam e confira se digitou o e-mail certo.{" "}
          <Link href="/duvidas/acesso-email-nao-chegou" className="text-primary hover:underline">
            Ver o que fazer
          </Link>
        </p>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit((values) => send.mutate(values))}
    >
      <div>
        <h1 className="text-xl font-semibold">Esqueci a senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o e-mail da sua conta e enviaremos um link para criar uma senha nova.
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
      <Button type="submit" className="w-full" size="lg" disabled={send.isPending}>
        {send.isPending ? "Enviando..." : "Enviar link"}
      </Button>
      <Link href="/login" className="block text-center text-sm text-primary hover:underline">
        Voltar para entrar
      </Link>
    </form>
  );
}
