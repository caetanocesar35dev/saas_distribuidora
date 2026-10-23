"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { SelectField } from "@/components/app/inputs";
import { PlatformActionButton } from "@/components/app/platform-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  usePlatformOrganization,
  usePlatformPlans,
  useUpdateOrganization,
} from "@/lib/api/hooks/platform";
import type {
  PlatformOrganization,
  SubscriptionStatus,
  UpdateOrganizationBody,
} from "@/lib/api/types";
import {
  dayEndIso,
  formatCnpj,
  formatDate,
  SUBSCRIPTION_STATUS_LABEL,
  todayString,
} from "@/lib/format";
import { StatusBadge } from "../organizations-view";

/** Data (ISO) -> dia do calendário (AAAA-MM-DD) no fuso de São Paulo, para o campo de data. */
const toDay = (iso: string | null) => (iso ? todayString(new Date(iso)) : "");

function AdjustForm({ org }: { org: PlatformOrganization }) {
  const update = useUpdateOrganization(org.id);
  const plans = usePlatformPlans();
  const [status, setStatus] = useState<SubscriptionStatus>(org.subscriptionStatus);
  const [planId, setPlanId] = useState(org.plan.id);
  const [trialEnd, setTrialEnd] = useState(toDay(org.trialEndsAt));
  const [pastDue, setPastDue] = useState(toDay(org.pastDueSince));

  const body: UpdateOrganizationBody = {};
  if (status !== org.subscriptionStatus) body.subscriptionStatus = status;
  if (planId !== org.plan.id) body.planId = planId;
  if (trialEnd !== toDay(org.trialEndsAt)) {
    body.trialEndsAt = trialEnd ? dayEndIso(trialEnd) : null;
  }
  if (pastDue !== toDay(org.pastDueSince)) {
    body.pastDueSince = pastDue ? dayEndIso(pastDue) : null;
  }
  const changed = Object.keys(body).length > 0;

  return (
    <form
      className="max-w-xl space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return;
        update.mutate(body, { onSuccess: () => toast.success("Assinatura ajustada.") });
      }}
    >
      <div>
        <h2 className="font-semibold">Ajustar a assinatura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste manual (cortesia, suporte). Hoje é assim que a assinatura é regularizada, porque o
          pagamento automático ainda não existe. A mudança vale na hora para todas as lojas.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Situação" htmlFor="adj-status">
          <SelectField<SubscriptionStatus>
            id="adj-status"
            value={status}
            onChange={setStatus}
            options={(
              Object.entries(SUBSCRIPTION_STATUS_LABEL) as [SubscriptionStatus, string][]
            ).map(([value, label]) => ({ value, label }))}
          />
        </FormField>
        <FormField label="Plano" htmlFor="adj-plan">
          <SelectField
            id="adj-plan"
            value={planId}
            onChange={setPlanId}
            options={(plans.data ?? [org.plan]).map((p) => ({ value: p.id, label: p.name }))}
          />
        </FormField>
        <FormField label="Fim do período de teste" htmlFor="adj-trial" hint="Vazio = sem data.">
          <div className="flex gap-1">
            <Input
              id="adj-trial"
              type="date"
              value={trialEnd}
              onChange={(e) => setTrialEnd(e.target.value)}
            />
            {trialEnd && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setTrialEnd("")}>
                Limpar
              </Button>
            )}
          </div>
        </FormField>
        <FormField
          label="Em atraso desde"
          htmlFor="adj-pastdue"
          hint="A carência de 5 dias conta a partir desta data. Limpar = em dia."
        >
          <div className="flex gap-1">
            <Input
              id="adj-pastdue"
              type="date"
              value={pastDue}
              onChange={(e) => setPastDue(e.target.value)}
            />
            {pastDue && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPastDue("")}>
                Limpar
              </Button>
            )}
          </div>
        </FormField>
      </div>
      <PlatformActionButton type="submit" disabled={!changed || update.isPending}>
        {update.isPending ? "Salvando..." : "Salvar ajuste"}
      </PlatformActionButton>
    </form>
  );
}

function OrganizationBody({ org }: { org: PlatformOrganization }) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-5">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Responsável pela assinatura</dt>
            <dd className="font-medium">
              {org.owner.name} <span className="font-normal text-muted-foreground">({org.owner.email})</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Situação</dt>
            <dd>
              <StatusBadge status={org.subscriptionStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plano</dt>
            <dd className="font-medium">{org.plan.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Usuários com acesso</dt>
            <dd className="font-medium tabular-nums">{org.userCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fim do teste</dt>
            <dd>{org.trialEndsAt ? formatDate(org.trialEndsAt) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Em atraso desde</dt>
            <dd>{org.pastDueSince ? formatDate(org.pastDueSince) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cadastrada em</dt>
            <dd>{formatDate(org.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cobrança automática</dt>
            <dd>{org.billingProvider ? `${org.billingProvider} (${org.billingMethod ?? "sem forma"})` : "Ainda não configurada"}</dd>
          </div>
        </dl>
      </section>

      <AdjustForm key={`${org.subscriptionStatus}-${org.plan.id}-${org.trialEndsAt}-${org.pastDueSince}`} org={org} />

      <section>
        <h2 className="mb-2 font-medium">Empresas e lojas</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {org.companies.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{c.nomeFantasia || c.razaoSocial}</p>
              <p className="text-xs text-muted-foreground">
                {c.razaoSocial} · CNPJ {formatCnpj(c.cnpj)}
              </p>
              <p className="mt-1 text-muted-foreground">
                Lojas: {c.stores.map((s) => s.name).join(", ") || "nenhuma"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function OrganizationDetailView({ orgId }: { orgId: string }) {
  const org = usePlatformOrganization(orgId);

  return (
    <div>
      <Link
        href="/plataforma/organizacoes"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" /> Organizações
      </Link>
      <QueryBoundary query={org}>
        {(data) => (
          <>
            <PageHeader title={data.name} help="plataforma-organizacoes" />
            <OrganizationBody org={data} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
