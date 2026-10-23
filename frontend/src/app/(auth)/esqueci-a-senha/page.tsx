import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
