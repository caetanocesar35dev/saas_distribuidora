"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/app/brand";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { UserMenu } from "@/components/app/user-menu";
import { getValidLastSelection } from "@/lib/session/last-selection";
import { useMemberships } from "@/lib/session/queries";

/** Moldura das telas da pessoa (minha conta, notificações), fora de uma loja específica. */
export function UserShell({ children }: { children: React.ReactNode }) {
  const memberships = useMemberships();
  const last = memberships.data ? getValidLastSelection(memberships.data) : null;
  const backHref = last ? `/loja/${last.storeId}` : "/selecionar?trocar=1";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex items-center gap-2 border-b bg-background px-4 py-2">
        <Link href="/" aria-label="Início">
          <Brand />
        </Link>
        <div className="flex-1" />
        <NotificationsBell />
        <UserMenu />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" /> Voltar ao sistema
        </Link>
        {children}
      </main>
    </div>
  );
}
