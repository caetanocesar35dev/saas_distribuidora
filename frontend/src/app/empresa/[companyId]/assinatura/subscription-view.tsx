"use client";

import { PageHeader, QueryBoundary } from "@/components/app/common";
import { useOrganizations } from "@/lib/api/hooks/admin";
import { daysUntil, formatDate, SUBSCRIPTION_STATUS_LABEL } from "@/lib/format";
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
 * Situação da assinatura. A cobrança automática (cartão recorrente e Pix Automático com Asaas)
 * ainda não existe no backend: por enquanto a assinatura é regularizada pelo suporte.
 */
export function SubscriptionView() {
  const company = useCompany();
  const organizations = useOrganizations();
  const notice = subscriptionNotice(company.subscription);
  const sub = company.subscription;

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
          <QueryBoundary query={organizations} loading={null}>
            {(list) => {
              const org = list.find((o) => o.id === company.organizationId);
              return org ? <Row label="Plano" value={org.plan.name} /> : null;
            }}
          </QueryBoundary>
        </dl>
      </section>

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
