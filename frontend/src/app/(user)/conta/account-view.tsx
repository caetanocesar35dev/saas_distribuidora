"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangePassword, useUpdateProfile } from "@/lib/api/hooks/account";
import { errorMessage } from "@/lib/api/client";
import { useLogoutAll } from "@/lib/session/actions";
import { useMe } from "@/lib/session/queries";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120, "Use no máximo 120 caracteres."),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileForm({ name, email }: { name: string; email: string }) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({ resolver: zodResolver(nameSchema), defaultValues: { name } });

  return (
    <form
      className="max-w-sm space-y-4"
      noValidate
      onSubmit={handleSubmit((values) =>
        update.mutate(values, {
          onSuccess: (profile) => {
            reset({ name: profile.name });
            toast.success("Nome atualizado.");
          },
        }),
      )}
    >
      <FormField label="Nome" htmlFor="name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField label="E-mail" htmlFor="email" hint="O e-mail é o seu acesso e não pode ser alterado aqui.">
        <Input id="email" value={email} disabled readOnly />
      </FormField>
      <Button type="submit" disabled={!isDirty || update.isPending}>
        {update.isPending ? "Salvando..." : "Salvar nome"}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(passwordSchema) });

  return (
    <form
      className="max-w-sm space-y-4"
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        change.mutate(
          { currentPassword: values.currentPassword, newPassword: values.newPassword },
          {
            onSuccess: () => {
              reset();
              toast.success("Senha alterada. Os outros aparelhos foram desconectados.");
            },
            onError: (error) => setFormError(errorMessage(error)),
          },
        );
      })}
    >
      <FormField label="Senha atual" htmlFor="currentPassword" error={errors.currentPassword?.message}>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.currentPassword}
          {...register("currentPassword")}
        />
      </FormField>
      <FormField label="Nova senha" htmlFor="newPassword" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres.">
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...register("newPassword")}
        />
      </FormField>
      <FormField label="Repita a nova senha" htmlFor="confirm" error={errors.confirm?.message}>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          {...register("confirm")}
        />
      </FormField>
      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={change.isPending}>
        {change.isPending ? "Salvando..." : "Trocar senha"}
      </Button>
    </form>
  );
}

export function AccountView() {
  const me = useMe();
  const logoutAll = useLogoutAll();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader title="Minha conta" help="acesso-minha-conta" />
      <QueryBoundary query={me}>
        {(profile) => (
          <>
            <Section title="Seus dados">
              <ProfileForm name={profile.name} email={profile.email} />
            </Section>
            <Section
              title="Trocar a senha"
              description="Ao trocar a senha, você continua conectado neste aparelho e é desconectado dos outros."
            >
              <PasswordForm />
            </Section>
            <Section
              title="Aparelhos conectados"
              description="Se perdeu um celular ou entrou em um computador emprestado, saia de todos os aparelhos de uma vez."
            >
              <Button variant="destructive" onClick={() => setConfirm(true)}>
                Sair de todos os aparelhos
              </Button>
            </Section>
          </>
        )}
      </QueryBoundary>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Sair de todos os aparelhos?"
        description="Você será desconectado deste e de todos os outros aparelhos. Será preciso entrar de novo."
        confirmLabel="Sair de todos"
        destructive
        pending={logoutAll.isPending}
        onConfirm={() => logoutAll.mutate()}
      />
    </div>
  );
}
