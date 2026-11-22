import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Criar conta grátis",
  description:
    "Crie a conta da sua distribuidora de bebidas e teste grátis por 14 dias, sem cartão: PDV, caixa, estoque, fiado e vasilhame.",
  // ?ref= (código de indicação) não é outra página: o endereço oficial é sempre /cadastro.
  alternates: { canonical: "/cadastro" },
};

export default function SignupPage() {
  // O formulário lê o código de indicação da URL (?ref=), o que exige o Suspense.
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
