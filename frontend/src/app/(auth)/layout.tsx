import Link from "next/link";
import { CircleHelpIcon } from "lucide-react";
import { Brand } from "@/components/app/brand";

/** Moldura das telas públicas (entrar, cadastro, esqueci a senha, redefinir senha). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6">
        <Brand size="lg" />
      </div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
      <Link
        href="/duvidas/acesso-entrar"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <CircleHelpIcon className="size-4" /> Dúvidas sobre o acesso
      </Link>
    </div>
  );
}
