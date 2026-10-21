"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton, PageGuard } from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  extractRestorableId,
  useBottleTypes,
  useDeleteBottleType,
  useRestoreBottleType,
  useSaveBottleType,
} from "@/lib/api/hooks/catalog";
import { errorMessage } from "@/lib/api/client";
import type { BottleType } from "@/lib/api/types";
import { useStore } from "@/lib/session/context";

function TypeDialog({
  companyId,
  type,
  onClose,
}: {
  companyId: string;
  type: BottleType | null;
  onClose: () => void;
}) {
  const save = useSaveBottleType(companyId);
  const restore = useRestoreBottleType(companyId);
  const [name, setName] = useState(type?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [restorableId, setRestorableId] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type ? "Renomear tipo de vasilhame" : "Novo tipo de vasilhame"}</DialogTitle>
          <DialogDescription>
            Ex.: Garrafa 600 ml, Caixa de cerveja, Botijão. O tipo vale para todas as lojas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setRestorableId(null);
            save.mutate(
              { id: type?.id, name: name.trim() },
              {
                onSuccess: () => {
                  toast.success(type ? "Tipo atualizado." : "Tipo cadastrado.");
                  onClose();
                },
                onError: (err) => {
                  const message = errorMessage(err);
                  setError(message);
                  setRestorableId(extractRestorableId(message));
                },
              },
            );
          }}
        >
          <FormField label="Nome" htmlFor="type-name">
            <Input
              id="type-name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>
          {error && (
            <div role="alert" className="space-y-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p>{error}</p>
              {restorableId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={restore.isPending}
                  onClick={() =>
                    restore.mutate(restorableId, {
                      onSuccess: () => {
                        toast.success("Tipo reativado.");
                        onClose();
                      },
                    })
                  }
                >
                  Reativar o tipo excluído
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim() === "" || save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TypesList() {
  const { companyId } = useStore();
  const types = useBottleTypes(companyId);
  const remove = useDeleteBottleType(companyId);
  const [dialog, setDialog] = useState<{ type: BottleType | null } | null>(null);
  const [deleting, setDeleting] = useState<BottleType | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ActionButton minRole="MANAGER" onClick={() => setDialog({ type: null })}>
          <PlusIcon /> Novo tipo
        </ActionButton>
      </div>
      <QueryBoundary query={types}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="Nenhum tipo cadastrado" />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {list.map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="flex-1 font-medium">{t.name}</span>
                  <HistoryButton
                    size="xs"
                    label=""
                    target={{ scope: "company", scopeId: companyId, entity: "bottle-types", id: t.id }}
                    title={`Histórico de ${t.name}`}
                  />
                  <ActionButton variant="outline" size="sm" minRole="MANAGER" onClick={() => setDialog({ type: t })}>
                    <PencilIcon /> Renomear
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    size="icon-sm"
                    minRole="MANAGER"
                    aria-label={`Excluir ${t.name}`}
                    onClick={() => setDeleting(t)}
                  >
                    <Trash2Icon />
                  </ActionButton>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>

      {dialog && (
        <TypeDialog
          key={dialog.type?.id ?? "new"}
          companyId={companyId}
          type={dialog.type}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir o tipo ${deleting?.name ?? ""}?`}
        description="Só é possível excluir se nenhum cliente deve este vasilhame e nenhum produto o usa. O nome continua reservado: ao cadastrar o mesmo nome de novo, o sistema oferece reativar."
        confirmLabel="Excluir tipo"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Tipo excluído.");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

export function TypesTab() {
  return (
    <PageGuard min="MANAGER">
      <TypesList />
    </PageGuard>
  );
}
