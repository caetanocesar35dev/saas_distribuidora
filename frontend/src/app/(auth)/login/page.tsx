import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre no Minha Distribuidora Online para vender, abrir o caixa e cuidar da sua loja.",
  // ?next= muda a cada página protegida: o endereço oficial é sempre /login.
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
