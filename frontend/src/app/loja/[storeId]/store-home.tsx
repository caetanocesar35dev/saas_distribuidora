"use client";

import {
  ClipboardListIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { DashboardView } from "@/components/app/dashboard-view";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { RequireRole } from "@/components/app/guards";
import { useStoreDashboard } from "@/lib/api/hooks/dashboard";
import { ROLE_LABEL } from "@/lib/format";
import { useStore } from "@/lib/session/context";

function Shortcut({ href, label, hint, icon: Icon }: { href: string; label: string; hint: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}

function StoreDashboard() {
  const { storeId } = useStore();
  const dashboard = useStoreDashboard(storeId);
  return <QueryBoundary query={dashboard}>{(data) => <DashboardView data={data} />}</QueryBoundary>;
}

export function StoreHome() {
  const store = useStore();
  const base = `/loja/${store.storeId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={store.storeName}
        description={`${store.companyName} · você entra como ${store.role ? ROLE_LABEL[store.role].toLowerCase() : ""}`}
        help="gestao-painel"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Shortcut href={`${base}/pdv`} label="Vender" hint="Abrir o PDV" icon={ShoppingCartIcon} />
        <Shortcut href={`${base}/comandas`} label="Comandas" hint="Mesas e contas abertas" icon={ClipboardListIcon} />
        <Shortcut href={`${base}/caixa`} label="Caixa" hint="Abrir, conferir e fechar" icon={WalletIcon} />
        <Shortcut href={`${base}/clientes`} label="Clientes e fiado" hint="Cadastro e pagamentos" icon={UsersIcon} />
      </div>

      <RequireRole min="MANAGER">
        <StoreDashboard />
      </RequireRole>
    </div>
  );
}
