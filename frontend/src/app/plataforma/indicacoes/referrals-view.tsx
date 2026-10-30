"use client";

import { BanIcon, SearchIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Money,
  PageHeader,
  QueryBoundary,
  StatCard,
} from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
import { PlatformActionButton } from "@/components/app/platform-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounced } from "@/hooks/use-debounced";
import {
  useCancelReferral,
  useMarkCommissionPaid,
  usePlatformReferrals,
  useReferralSummary,
  useRepresentatives,
  type PlatformReferralsQuery,
} from "@/lib/api/hooks/referrals";
import type { PlatformReferral, ReferralStatus, ReferralSummary } from "@/lib/api/types";
import { formatCents, formatDate, formatInt } from "@/lib/format";
import { REFERRAL_STATUS_LABEL } from "@/lib/referral";
import { StatusBadge } from "../organizacoes/organizations-view";

const ALL = "all";

function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const variant =
    status === "CONFIRMED" ? "default" : status === "CANCELED" ? "destructive" : "secondary";
  return <Badge variant={variant}>{REFERRAL_STATUS_LABEL[status]}</Badge>;
}

const orgLink = (id: string, name: string) => (
  <Link href={`/plataforma/organizacoes/${id}`} className="font-medium text-primary hover:underline">
    {name}
  </Link>
);

function Panel({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SummaryPanels({ summary }: { summary: ReferralSummary }) {
  const { totals, commissions, rules } = summary;
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Indicações"
          value={formatInt(totals.all)}
          hint={`${formatInt(totals.fromCustomers)} de clientes · ${formatInt(totals.fromRepresentatives)} de representantes`}
        />
        <StatCard
          label="Aguardando o 1º pagamento"
          value={formatInt(totals.pending)}
          hint={`${formatInt(totals.confirmed)} confirmadas · ${formatInt(totals.canceled)} canceladas`}
        />
        <StatCard
          label="Comissão a pagar"
          value={formatCents(commissions.toPayInCents)}
          tone={commissions.toPayInCents > 0 ? "danger" : "default"}
          hint="Representantes com indicação confirmada"
        />
        <StatCard
          label="Comissão já paga"
          value={formatCents(commissions.paidInCents)}
          tone="success"
        />
      </div>
      <p className="-mt-5 text-xs text-muted-foreground">
        Regras: quem se cadastra com código ganha {rules.discountPercent}% por {rules.discountMonths}{" "}
        meses; o cliente que indicou ganha o mesmo quando o indicado paga (acumula até{" "}
        {rules.maxMonths} meses).
      </p>

      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title="Representantes" description="Quem mais trouxe clientes e quanto falta pagar.">
          {summary.representatives.length === 0 ? (
            <EmptyState
              title="Nenhum representante"
              action={
                <Link href="/plataforma/representantes" className="text-sm text-primary hover:underline">
                  Cadastrar representante
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Representante</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Confirmadas</TableHead>
                    <TableHead className="text-right">A pagar</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.representatives.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono">{r.code}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.confirmed} de {r.referrals}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Money value={r.toPayInCents / 100} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={r.paidInCents / 100} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        <Panel title="Clientes que mais indicam" description="Os 10 com mais indicações.">
          {summary.topCustomers.length === 0 ? (
            <EmptyState title="Nenhum cliente indicou ainda" />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organização</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Confirmadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.topCustomers.map((c) => (
                    <TableRow key={c.organizationId}>
                      <TableCell>{orgLink(c.organizationId, c.name)}</TableCell>
                      <TableCell className="font-mono">{c.code ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.confirmed} de {c.referrals}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Descontos a usar"
        description="Organizações com meses de desconto acumulados (por terem sido indicadas ou por terem indicado)."
      >
        {summary.discounts.length === 0 ? (
          <EmptyState title="Nenhum desconto a usar" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Meses a usar</TableHead>
                  <TableHead className="text-right">Já usados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.discounts.map((d) => (
                  <TableRow key={d.organizationId}>
                    <TableCell>{orgLink(d.organizationId, d.name)}</TableCell>
                    <TableCell>{d.planName}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.subscriptionStatus} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.percent}%</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {d.remainingMonths}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.usedMonths}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReferralActions({
  referral,
  onPay,
  onCancel,
}: {
  referral: PlatformReferral;
  onPay: () => void;
  onCancel: () => void;
}) {
  const canPay =
    referral.representative !== null &&
    referral.status === "CONFIRMED" &&
    referral.commissionPaidAt === null;
  const canCancel = referral.status !== "CANCELED" && referral.commissionPaidAt === null;
  return (
    <div className="flex justify-end gap-1">
      {canPay && (
        <PlatformActionButton variant="outline" size="sm" onClick={onPay}>
          <SendIcon /> Pix enviado
        </PlatformActionButton>
      )}
      {canCancel && (
        <PlatformActionButton
          variant="ghost"
          size="icon-sm"
          aria-label="Cancelar indicação"
          title="Cancelar indicação"
          onClick={onCancel}
        >
          <BanIcon />
        </PlatformActionButton>
      )}
    </div>
  );
}

function CommissionCell({ referral }: { referral: PlatformReferral }) {
  if (!referral.representative) return <span className="text-muted-foreground">Desconto</span>;
  if (referral.commissionInCents === null)
    return <span className="text-muted-foreground">Após o pagamento</span>;
  return (
    <div>
      <Money value={referral.commissionInCents / 100} className="font-medium" />
      <p className="text-xs text-muted-foreground">
        {referral.commissionPaidAt
          ? `Pago em ${formatDate(referral.commissionPaidAt)}`
          : "A pagar"}
        {referral.confirmedPlan ? ` · ${referral.confirmedPlan.name}` : ""}
      </p>
    </div>
  );
}

function ReferralList() {
  const params = useSearchParams();
  const representatives = useRepresentatives();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [source, setSource] = useState<string>(ALL);
  const [commission, setCommission] = useState<string>(ALL);
  const [representativeId, setRepresentativeId] = useState<string>(
    params.get("representante") ?? ALL,
  );
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const [paying, setPaying] = useState<PlatformReferral | null>(null);
  const [payNote, setPayNote] = useState("");
  const [canceling, setCanceling] = useState<PlatformReferral | null>(null);
  const [reason, setReason] = useState("");
  const markPaid = useMarkCommissionPaid();
  const cancel = useCancelReferral();

  const list = usePlatformReferrals({
    page,
    limit: 20,
    search: debounced.trim() || undefined,
    status: status === ALL ? undefined : (status as ReferralStatus),
    source: source === ALL ? undefined : (source as PlatformReferralsQuery["source"]),
    commission: commission === ALL ? undefined : (commission as PlatformReferralsQuery["commission"]),
    representativeId: representativeId === ALL ? undefined : representativeId,
  });

  function change<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <Panel title="Todas as indicações" description="Onde cada código foi usado e por quem.">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Código, organização indicada ou quem indicou"
            value={search}
            onChange={(e) => change(setSearch)(e.target.value)}
            aria-label="Buscar indicações"
          />
        </div>
        <SelectField
          className="w-52"
          value={status}
          onChange={change(setStatus)}
          options={[
            { value: ALL, label: "Todas as situações" },
            ...(Object.entries(REFERRAL_STATUS_LABEL) as [ReferralStatus, string][]).map(
              ([value, label]) => ({ value, label }),
            ),
          ]}
        />
        <SelectField
          className="w-48"
          value={source}
          onChange={change(setSource)}
          options={[
            { value: ALL, label: "Clientes e representantes" },
            { value: "CUSTOMER", label: "Indicadas por clientes" },
            { value: "REPRESENTATIVE", label: "Indicadas por representantes" },
          ]}
        />
        <SelectField
          className="w-48"
          value={representativeId}
          onChange={change(setRepresentativeId)}
          options={[
            { value: ALL, label: "Todos os representantes" },
            ...(representatives.data ?? []).map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
        <SelectField
          className="w-44"
          value={commission}
          onChange={change(setCommission)}
          options={[
            { value: ALL, label: "Qualquer comissão" },
            { value: "TO_PAY", label: "Comissão a pagar" },
            { value: "PAID", label: "Comissão paga" },
          ]}
        />
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nenhuma indicação encontrada" />
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Quem indicou</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Recompensa</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {orgLink(r.referredOrganization.id, r.referredOrganization.name)}
                      <p className="text-xs text-muted-foreground">
                        {r.referredOrganization.owner.email} · {r.referredOrganization.plan.name}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>
                      {r.referrerOrganization ? (
                        <>
                          {orgLink(r.referrerOrganization.id, r.referrerOrganization.name)}
                          <p className="text-xs text-muted-foreground">Cliente</p>
                        </>
                      ) : r.representative ? (
                        <>
                          <p className="font-medium">{r.representative.name}</p>
                          <p className="text-xs text-muted-foreground">Representante</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <ReferralStatusBadge status={r.status} />
                      <p className="mt-1 text-xs whitespace-nowrap text-muted-foreground">
                        Cadastro {formatDate(r.createdAt)}
                        {r.confirmedAt ? ` · pagou ${formatDate(r.confirmedAt)}` : ""}
                      </p>
                      {r.note && (
                        <p className="max-w-56 text-xs text-muted-foreground">{r.note}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <CommissionCell referral={r} />
                    </TableCell>
                    <TableCell>
                      <ReferralActions
                        referral={r}
                        onPay={() => {
                          setPayNote("");
                          setPaying(r);
                        }}
                        onCancel={() => {
                          setReason("");
                          setCanceling(r);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={paying !== null}
        onOpenChange={(open) => !open && setPaying(null)}
        title="Marcar a comissão como paga?"
        description={
          paying?.representative && paying.commissionInCents !== null
            ? `Confirme que você enviou ${formatCents(paying.commissionInCents)} por Pix para ${paying.representative.name}.`
            : undefined
        }
        confirmLabel="Pix enviado"
        pending={markPaid.isPending}
        onConfirm={() =>
          paying &&
          markPaid.mutate(
            { id: paying.id, note: payNote.trim() || undefined },
            {
              onSuccess: () => {
                toast.success("Comissão marcada como paga.");
                setPaying(null);
              },
            },
          )
        }
      >
        <FormField label="Observação (opcional)" htmlFor="pay-note" hint="Ex.: id da transação Pix.">
          <Input
            id="pay-note"
            maxLength={300}
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
          />
        </FormField>
      </ConfirmDialog>

      <ConfirmDialog
        open={canceling !== null}
        onOpenChange={(open) => !open && setCanceling(null)}
        title="Cancelar esta indicação?"
        description="Os meses de desconto ainda não usados (de quem indicou e de quem foi indicado) deixam de valer, e o representante não recebe comissão. Use para conta duplicada ou fraude."
        confirmLabel="Cancelar indicação"
        destructive
        pending={cancel.isPending}
        onConfirm={() => {
          if (!canceling) return;
          if (reason.trim() === "") {
            toast.error("Informe o motivo.");
            return;
          }
          cancel.mutate(
            { id: canceling.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast.success("Indicação cancelada.");
                setCanceling(null);
              },
            },
          );
        }}
      >
        <FormField label="Motivo" htmlFor="cancel-reason">
          <Input
            id="cancel-reason"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </ConfirmDialog>
    </Panel>
  );
}

/** Painel do programa de indicação: totais, representantes, clientes, descontos e a lista. */
export function ReferralsView() {
  const summary = useReferralSummary();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Indicações"
        description="Quem indicou quem, os códigos usados, as comissões dos representantes e os descontos dos clientes."
        help="plataforma-indicacoes"
        actions={
          <Link href="/plataforma/representantes" className="text-sm text-primary hover:underline">
            Representantes
          </Link>
        }
      />
      <QueryBoundary query={summary}>{(data) => <SummaryPanels summary={data} />}</QueryBoundary>
      <ReferralList />
    </div>
  );
}
