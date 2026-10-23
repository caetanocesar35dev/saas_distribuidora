"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/app/brand";
import { LinkButton } from "@/components/app/link-button";
import { useHelpViewer } from "@/lib/help/viewer";

export function HelpShell({ children }: { children: React.ReactNode }) {
  const viewer = useHelpViewer();

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <Link href="/" aria-label="Início">
          <Brand />
        </Link>
        <div className="flex-1" />
        {viewer.isLoggedIn ? (
          <LinkButton href={viewer.backHref} variant="outline" size="sm">
            <ArrowLeftIcon /> Voltar ao sistema
          </LinkButton>
        ) : (
          <LinkButton href="/login" variant="outline" size="sm">
            Entrar
          </LinkButton>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
