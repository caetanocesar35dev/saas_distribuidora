import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  // O formulário lê o código de indicação da URL (?ref=), o que exige o Suspense.
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
