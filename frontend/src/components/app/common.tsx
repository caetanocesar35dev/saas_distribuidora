"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { CircleHelpIcon, InboxIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---- Cabeçalho de página ---------------------------------------------------------------------

/** Título da tela, ações e o botão "?" que abre o artigo da Central de Dúvidas daquela tela. */
export function PageHeader({
  title,
  description,
  actions,
  help,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Identificador do artigo da Central de Dúvidas. */
  help?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {help && (
            <Link
              href={`/duvidas/${help}`}
              className="text-muted-foreground transition-colors hover:text-primary"
              title="Ajuda sobre esta tela"
              aria-label="Ajuda sobre esta tela"
            >
              <CircleHelpIcon className="size-5" />
            </Link>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---- Estados de carregamento, vazio e erro ---------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center",
        className,
      )}
    >
      <InboxIcon className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <p className="font-medium text-destructive">Não foi possível carregar</p>
      <p className="max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCwIcon /> Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Mostra carregando / erro / conteúdo de uma consulta. */
export function QueryBoundary<T>({
  query,
  children,
  loading,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
}) {
  if (query.isPending) return <>{loading !== undefined ? loading : <LoadingRows />}</>;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}

// ---- Números e cartões -----------------------------------------------------------------------

export function Money({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(value)}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-emerald-600",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
