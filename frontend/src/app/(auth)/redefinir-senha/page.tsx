import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Criar nova senha" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
