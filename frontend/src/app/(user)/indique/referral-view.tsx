"use client";

import { CheckIcon, CopyIcon, GiftIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, QueryBoundary } from "@/components/app/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizations } from "@/lib/api/hooks/admin";
import { useOrganizationReferral } from "@/lib/api/hooks/referrals";
import type { OrganizationReferral, OrganizationSummary } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import {
  DISCOUNT_REASON_LABEL,
  discountText,
  REFERRAL_STATUS_LABEL,
  referralLink,
  referralMessage,
  whatsappShareUrl,
} from "@/lib/referral";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success(`${label} copiado.`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />} Copiar {label.toLowerCase()}
    </Button>
  );
}

function ShareCard({ data }: { data: OrganizationReferral }) {
  // Só desenha depois que a consulta carrega (no navegador), mas o servidor também passa por aqui.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = referralLink(origin, data.code);
  const { discountPercent, discountMonths, maxMonths } = data.rules;

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Seu código</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quem se cadastrar com o seu código ganha {discountPercent}% de desconto nos{" "}
        {discountMonths} primeiros meses depois do teste grátis. Quando essa pessoa pagar a
        primeira mensalidade, você também ganha {discountMonths} meses com {discountPercent}% de
        desconto. Os descontos se somam, até {maxMonths} meses.
      </p>
      <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-center font-mono text-2xl font-semibold tracking-wider">
        {data.code}
      </p>
      <p className="mt-2 text-center text-xs break-all text-muted-foreground">{link}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          render={
            <a
              href={whatsappShareUrl(referralMessage(link, data.code, data.rules))}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          nativeButton={false}
        >
          <MessageCircleIcon /> Compartilhar no WhatsApp
        </Button>
        <CopyButton text={link} label="Link" />
        <CopyButton text={data.code} label="Código" />
      </div>
    </section>
  );
}

function OrganizationReferralPanel({ org }: { org: OrganizationSummary }) {
  const referral = useOrganizationReferral(org.id);

  return (
    <QueryBoundary query={referral}>
      {(data) => {
        const discount = discountText(data.remainingMonths, data.rules.discountPercent);
        return (
          <div className="space-y-4">
            <ShareCard data={data} />

            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Seus descontos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {discount
                  ? `Você tem ${discount} para usar nas próximas mensalidades.`
                  : "Você ainda não tem desconto para usar."}{" "}
                Os meses são usados um depois do outro, nas mensalidades pagas.
              </p>
              {data.discounts.length > 0 && (
                <ul className="mt-3 divide-y rounded-lg border">
                  {data.discounts.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">{DISCOUNT_REASON_LABEL[d.reason]}</span>
                      {d.from && <span className="text-muted-foreground">({d.from})</span>}
                      <span className="flex-1" />
                      <span className="tabular-nums">
                        {d.percent}% · {d.remaining} de {d.months}{" "}
                        {d.months === 1 ? "mês" : "meses"} a usar
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {data.referredBy?.status === "PENDING" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Você se cadastrou com o código {data.referredBy.code}: o desconto vale a partir da
                  primeira mensalidade depois do teste.
                </p>
              )}
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Quem você indicou</h2>
              {data.referrals.length === 0 ? (
                <EmptyState
                  className="mt-4"
                  title="Ninguém se cadastrou com o seu código ainda"
                  description="Compartilhe o link com outros donos de distribuidora."
                />
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Distribuidora</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.referrals.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.organizationName}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.status === "CONFIRMED"
                                  ? "default"
                                  : r.status === "CANCELED"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {REFERRAL_STATUS_LABEL[r.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

/** "Indique e ganhe": o código para compartilhar, quem se cadastrou com ele e os descontos. */
export function ReferralView() {
  const organizations = useOrganizations();

  return (
    <div>
      <PageHeader
        title="Indique e ganhe"
        description="Indique o sistema para outras distribuidoras e ganhe desconto na mensalidade."
        help="assinatura-indique-e-ganhe"
      />
      <QueryBoundary query={organizations}>
        {(list) => {
          const owned = list.filter((o) => o.isBillingOwner);
          if (owned.length === 0) {
            return (
              <EmptyState
                title="Só o responsável pela assinatura tem código de indicação"
                description="O desconto vai para a mensalidade, por isso o código é de quem criou a conta da distribuidora."
              />
            );
          }
          return (
            <div className="space-y-8">
              {owned.map((org) => (
                <div key={org.id}>
                  {owned.length > 1 && (
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                      <GiftIcon className="size-5" /> {org.name}
                    </h2>
                  )}
                  <OrganizationReferralPanel org={org} />
                </div>
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
