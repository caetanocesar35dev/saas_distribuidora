"use client";

import {
  CircleCheckIcon,
  CircleIcon,
  ClipboardListIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DashboardView } from "@/components/app/dashboard-view";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { RequireRole } from "@/components/app/guards";
import { Button } from "@/components/ui/button";
import { useStoreDashboard, useStoreOnboarding } from "@/lib/api/hooks/dashboard";
import { ROLE_LABEL } from "@/lib/format";
import { onboardingSteps } from "@/lib/onboarding";
import { useStore } from "@/lib/session/context";
import { cn } from "@/lib/utils";

function Shortcut({
  href,
  label,
  hint,
  icon: Icon,
}: {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}) {
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

const HIDE_KEY = (storeId: string) => `primeiros-passos-escondido:${storeId}`;

/**
 * "Primeiros passos" (decisão do usuário): para o dono, até completar tudo. Cada item marca
 * sozinho quando a tarefa é feita (o backend confere). "Esconder" vale só neste navegador.
 */
function OnboardingCard() {
  const { storeId, companyId } = useStore();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY(storeId)) === "1";
    } catch {
      return false;
    }
  });
  const status = useStoreOnboarding(storeId, !hidden);
  if (hidden || !status.data) return null;

  const steps = onboardingSteps(status.data, { storeId, companyId });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section
      aria-labelledby="primeiros-passos"
      className="rounded-xl border border-primary/30 bg-primary/5 p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="primeiros-passos" className="font-semibold">
            Primeiros passos
          </h2>
          <p className="text-sm text-muted-foreground">
            {done} de {steps.length} feitos. Cada item marca sozinho quando você conclui.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_KEY(storeId), "1");
            } catch {
              // sem armazenamento: esconde só nesta visita
            }
            setHidden(true);
          }}
        >
          Esconder
        </Button>
      </div>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50",
                step.done && "opacity-60",
              )}
            >
              {step.done ? (
                <CircleCheckIcon className="size-5 shrink-0 text-emerald-600" aria-label="Feito" />
              ) : (
                <CircleIcon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-label="A fazer"
                />
              )}
              <span className="min-w-0">
                <span className={cn("block text-sm font-medium", step.done && "line-through")}>
                  {step.label}
                </span>
                <span className="block text-xs text-muted-foreground">{step.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
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

      {store.isCompanyOwner && store.role === "OWNER" && <OnboardingCard />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Shortcut href={`${base}/pdv`} label="Vender" hint="Abrir o PDV" icon={ShoppingCartIcon} />
        <Shortcut
          href={`${base}/comandas`}
          label="Comandas"
          hint="Mesas e contas abertas"
          icon={ClipboardListIcon}
        />
        <Shortcut
          href={`${base}/caixa`}
          label="Caixa"
          hint="Abrir, conferir e fechar"
          icon={WalletIcon}
        />
        <Shortcut
          href={`${base}/clientes`}
          label="Clientes e fiado"
          hint="Cadastro e pagamentos"
          icon={UsersIcon}
        />
      </div>

      <RequireRole min="MANAGER">
        <StoreDashboard />
      </RequireRole>
    </div>
  );
}
