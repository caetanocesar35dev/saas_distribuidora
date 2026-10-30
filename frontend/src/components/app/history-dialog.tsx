"use client";

import { useQuery } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingRows } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { companyApi, storeApi } from "@/lib/api/client";
import type {
  AuditHistory,
  CompanyAuditEntity,
  StoreAuditEntity,
} from "@/lib/api/types";
import {
  ACTION_LABEL,
  fieldLabel,
  formatAuditValue,
  isHiddenField,
} from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import { useAccess } from "@/lib/session/context";
import { hasMinRole } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AuditTarget =
  | { scope: "store"; scopeId: string; entity: StoreAuditEntity; id: string }
  | { scope: "company"; scopeId: string; entity: CompanyAuditEntity; id: string };

function useAuditHistory(target: AuditTarget, enabled: boolean) {
  return useQuery({
    queryKey: ["audit", target.scope, target.scopeId, target.entity, target.id],
    enabled,
    queryFn: () => {
      const api =
        target.scope === "store" ? storeApi(target.scopeId) : companyApi(target.scopeId);
      return api.get<AuditHistory>(`/audit/${target.entity}/${target.id}`);
    },
  });
}

const ACTION_STYLE = {
  CREATED: "bg-emerald-100 text-emerald-800",
  UPDATED: "bg-sky-100 text-sky-800",
  DELETED: "bg-red-100 text-red-800",
  RESTORED: "bg-amber-100 text-amber-800",
} as const;

function HistoryBody({ target }: { target: AuditTarget }) {
  const history = useAuditHistory(target, true);
  if (history.isPending) return <LoadingRows rows={3} />;
  if (history.isError) {
    return <ErrorState error={history.error} onRetry={() => void history.refetch()} />;
  }

  // Mais recente primeiro.
  const versions = [...history.data.versions].reverse();
  return (
    <ol className="space-y-3">
      {versions.map((v) => {
        const changes = (v.changes ?? []).filter((c) => !isHiddenField(c.field));
        return (
          <li key={v.version} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ACTION_STYLE[v.action])}>
                {ACTION_LABEL[v.action]}
              </span>
              <span className="text-muted-foreground">{formatDateTime(v.historyStart)}</span>
              <span className="ml-auto text-muted-foreground">
                por {v.author.name ?? "autor desconhecido"}
              </span>
            </div>
            {v.action === "UPDATED" && changes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {changes.map((c) => (
                  <li key={c.field}>
                    <span className="font-medium">{fieldLabel(c.field)}:</span>{" "}
                    <span className="text-muted-foreground line-through">
                      {formatAuditValue(c.field, c.from)}
                    </span>{" "}
                    → <span>{formatAuditValue(c.field, c.to)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Botão "Histórico" (gerente ou dono) que mostra quem mudou o quê e quando. */
export function HistoryButton({
  target,
  title = "Histórico de alterações",
  size = "sm",
  label = "Histórico",
}: {
  target: AuditTarget;
  title?: string;
  size?: "sm" | "xs" | "default";
  label?: string;
}) {
  const { role, isCompanyAdmin } = useAccess();
  const [open, setOpen] = useState(false);

  // Histórico da loja: gerente ou mais. Histórico da empresa: dono ou gerente geral.
  const allowed =
    target.scope === "store" ? hasMinRole(role, "MANAGER") : isCompanyAdmin;
  if (!allowed) return null;

  return (
    <>
      <Button
        variant="outline"
        size={size}
        aria-label={label ? undefined : "Histórico de alterações"}
        title={label ? undefined : "Histórico de alterações"}
        onClick={() => setOpen(true)}
      >
        <HistoryIcon /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Quem alterou, quando e o que mudou. O mais recente aparece primeiro.
            </DialogDescription>
          </DialogHeader>
          {open && <HistoryBody target={target} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
