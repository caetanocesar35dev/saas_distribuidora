"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app/common";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
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
import { usePlatformOrganizations, usePlatformPlans } from "@/lib/api/hooks/platform";
import type { SubscriptionStatus } from "@/lib/api/types";
import { formatDate, SUBSCRIPTION_STATUS_LABEL } from "@/lib/format";

const ALL = "all";

export function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const variant =
    status === "ACTIVE" ? "secondary" : status === "TRIAL" ? "outline" : "destructive";
  return <Badge variant={variant}>{SUBSCRIPTION_STATUS_LABEL[status]}</Badge>;
}

export function OrganizationsView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [planId, setPlanId] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const plans = usePlatformPlans();

  const list = usePlatformOrganizations({
    page,
    limit: 20,
    search: debounced.trim() || undefined,
    status: status === ALL ? undefined : (status as SubscriptionStatus),
    planId: planId === ALL ? undefined : planId,
  });

  function change<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      <PageHeader
        title="Organizações"
        description="Os clientes do sistema. Aqui você consulta e ajusta a assinatura de cada um."
        help="plataforma-organizacoes"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nome da organização ou e-mail do responsável"
            value={search}
            onChange={(e) => change(setSearch)(e.target.value)}
            aria-label="Buscar organizações"
          />
        </div>
        <SelectField
          className="w-48"
          value={status}
          onChange={change(setStatus)}
          options={[
            { value: ALL, label: "Todas as situações" },
            ...(Object.entries(SUBSCRIPTION_STATUS_LABEL) as [SubscriptionStatus, string][]).map(
              ([value, label]) => ({ value, label }),
            ),
          ]}
        />
        <SelectField
          className="w-44"
          value={planId}
          onChange={change(setPlanId)}
          options={[
            { value: ALL, label: "Todos os planos" },
            ...(plans.data ?? []).map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nenhuma organização encontrada" />
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Empresas</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <p>{org.owner.name}</p>
                      <p className="text-xs text-muted-foreground">{org.owner.email}</p>
                    </TableCell>
                    <TableCell>{org.plan.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={org.subscriptionStatus} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {org.subscriptionStatus === "TRIAL" && org.trialEndsAt
                        ? `Teste até ${formatDate(org.trialEndsAt)}`
                        : org.pastDueSince
                          ? `Atraso desde ${formatDate(org.pastDueSince)}`
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{org.companies}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/plataforma/organizacoes/${org.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Abrir
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
