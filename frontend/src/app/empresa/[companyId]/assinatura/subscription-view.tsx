"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { ActionButton } from "@/components/app/guards";
import { Badge } from "@/components/ui/badge";
import { useChangePlan, useOrganizations, usePlans } from "@/lib/api/hooks/admin";
import type { OrganizationSummary, Plan } from "@/lib/api/types";
import { daysUntil, formatCents, formatDate, SUBSCRIPTION_STATUS_LABEL } from "@/lib/format";
import { choosablePlans, planFit, planLimits } from "@/lib/plans";
import { useCompany } from "@/lib/session/context";
import { subscriptionNotice } from "@/lib/subscription";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * Troca de plano pelo responsável pela assinatura (decisão do usuário): upgrade e downgrade valem
 * na hora; o downgrade que não cabe fica desabilitado com o motivo (o backend confere de novo). O
 * plano gratuito é só o do período de teste e não aparece aqui. Liberado em somente leitura, porque
 * escolher o plano faz parte de regularizar.
 */
function PlanPicker({ org }: { org: OrganizationSummary }) {
  const plans = usePlans();
  const change = useChangePlan(org.id);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const onTrialPlan = !plans.data?.some((p) => p.id === org.plan.id && p.priceInCents > 0);
  const current = plans.data?.find((p) => p.id === org.plan.id);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Planos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {org.isBillingOwner
            ? "Você pode mudar de plano quando quiser, para cima ou para baixo. A mudança vale na hora e o valor novo vale a partir da próxima cobrança."
            : "Só o responsável pela assinatura pode mudar o plano."}
          {org.isBillingOwner &&
            onTrialPlan &&
            " Você está no plano do período de teste: escolha um plano para continuar usando depois do teste."}
        </p>
      </div>
      <QueryBoundary query={plans}>
        {(list) => (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {choosablePlans(list).map((plan) => {
              const isCurrent = plan.id === org.plan.id;
              const blocked = isCurrent ? null : planFit(plan, org.companies);
              return (
                <li
                  key={plan.id}
                  className={cn(
                    "flex flex-col rounded-xl border bg-card p-4",
                    isCurrent && "border-primary ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{plan.name}</p>
                    {isCurrent && <Badge>Seu plano</Badge>}
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatCents(plan.priceInCents)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{planLimits(plan)}</p>
                  {!isCurrent && org.isBillingOwner && (
                    <div className="mt-3 space-y-1">
                      <ActionButton
                        variant="outline"
                        size="sm"
                        className="w-full"
                        allowWhenReadOnly
                        disabled={blocked !== null || change.isPending}
                        onClick={() => setChosen(plan)}
                      >
                        {current && plan.priceInCents < current.priceInCents
                          ? "Mudar para este plano"
                          : "Fazer upgrade"}
                      </ActionButton>
                      {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </QueryBoundary>

      <ConfirmDialog
        open={chosen !== null}
        onOpenChange={(open) => !open && setChosen(null)}
        title={`Mudar para o plano ${chosen?.name ?? ""}?`}
        description={
          chosen
            ? `O plano muda agora: ${planLimits(chosen)}, por ${formatCents(chosen.priceInCents)}/mês a partir da próxima cobrança.`
            : ""
        }
        confirmLabel="Mudar de plano"
        pending={change.isPending}
        onConfirm={() =>
          chosen &&
          change.mutate(chosen.id, {
            onSuccess: (result) => {
              toast.success(result.message);
              setChosen(null);
            },
          })
        }
      />
    </section>
  );
}

/**
 * Situação da assinatura. A cobrança automática (cartão recorrente e Pix Automático com Asaas)
 * ainda não existe no backend: por enquanto a assinatura é regularizada pelo suporte.
 */
export function SubscriptionView() {
  const company = useCompany();
  const organizations = useOrganizations();
  const notice = subscriptionNotice(company.subscription);
  const sub = company.subscription;
  const org = organizations.data?.find((o) => o.id === company.organizationId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assinatura"
        description="Plano, situação e o que fazer para regularizar."
        help="assinatura-regularizar"
      />

      {notice && (
        <div
          className={cn(
            "rounded-xl border p-4 text-sm",
            notice.tone === "danger" && "border-destructive/40 bg-destructive/5",
            notice.tone === "warning" && "border-amber-300 bg-amber-50",
            notice.tone === "info" && "border-sky-200 bg-sky-50",
          )}
        >
          <p className="font-medium">{notice.title}</p>
          <p className="mt-1 text-muted-foreground">{notice.description}</p>
        </div>
      )}

      <section className="rounded-xl border bg-card p-5">
        <dl>
          <Row label="Situação" value={SUBSCRIPTION_STATUS_LABEL[sub.status]} />
          {sub.status === "TRIAL" && sub.trialEndsAt && (
            <Row
              label="Fim do período de teste"
              value={`${formatDate(sub.trialEndsAt)} (${daysUntil(sub.trialEndsAt)} dia(s))`}
            />
          )}
          {sub.pastDueSince && (
            <Row label="Em atraso desde" value={formatDate(sub.pastDueSince)} />
          )}
          {sub.graceEndsAt && (
            <Row label="Consulta somente a partir de" value={formatDate(sub.graceEndsAt)} />
          )}
          {org && (
            <Row label="Plano" value={`${org.plan.name} (${planLimits(org.plan)})`} />
          )}
        </dl>
      </section>

      {org && <PlanPicker org={org} />}

      <section className="rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-semibold">Como regularizar</h2>
        <p className="mt-2 text-muted-foreground">
          O pagamento pela internet (cartão ou Pix) ainda não está disponível. Por enquanto, a
          assinatura é regularizada pelo nosso suporte: entre em contato e informe o nome da sua
          empresa.
        </p>
        {!company.isBillingOwner && (
          <p className="mt-2 text-muted-foreground">
            Apenas o responsável pela assinatura pode tratar disso. Fale com ele.
          </p>
        )}
        <p className="mt-3 text-muted-foreground">
          Enquanto isso, mesmo com a assinatura vencida você continua podendo consultar tudo e
          fechar o caixa que já estava aberto.
        </p>
      </section>
    </div>
  );
}
