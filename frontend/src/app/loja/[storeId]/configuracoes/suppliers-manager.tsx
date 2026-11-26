"use client";

import { CheckIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, QueryBoundary } from "@/components/app/common";
import { HistoryButton } from "@/components/app/history-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  useDeleteSupplier,
  useRestoreSupplier,
  useSaveSupplier,
  useSuppliers,
} from "@/lib/api/hooks/bottles";
import { extractRestorableId } from "@/lib/api/hooks/catalog";
import { errorMessage } from "@/lib/api/client";
import type { Supplier } from "@/lib/api/types";

/**
 * Fornecedores da empresa (só o nome): escolhidos no envio e no recebimento de vasilhames. Criar,
 * renomear, excluir e reativar.
 */
export function SuppliersManager({ companyId }: { companyId: string }) {
  const [showDeleted, setShowDeleted] = useState(false);
  const suppliers = useSuppliers(companyId, showDeleted);
  const save = useSaveSupplier(companyId);
  const remove = useDeleteSupplier(companyId);
  const restore = useRestoreSupplier(companyId);

  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restorableId, setRestorableId] = useState<string | null>(null);

  function saveName(body: { id?: string; name: string }, onSuccess: () => void) {
    setError(null);
    setRestorableId(null);
    save.mutate(body, {
      onSuccess,
      onError: (err) => {
        const message = errorMessage(err);
        setError(message);
        setRestorableId(extractRestorableId(message));
      },
    });
  }

  function reactivate(id: string) {
    restore.mutate(id, {
      onSuccess: (supplier) => {
        toast.success(`Fornecedor ${supplier.name} reativado.`);
        setError(null);
        setRestorableId(null);
        setNewName("");
      },
    });
  }

  return (
    <div className="grid gap-4">
      {!showDeleted && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveName({ name: newName.trim() }, () => {
              toast.success("Fornecedor cadastrado.");
              setNewName("");
            });
          }}
        >
          <Input
            aria-label="Nome do novo fornecedor"
            placeholder="Novo fornecedor (ex.: Ambev)"
            maxLength={80}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" disabled={newName.trim() === "" || save.isPending}>
            <PlusIcon /> Adicionar
          </Button>
        </form>
      )}

      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>{error}</p>
          {restorableId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={restore.isPending}
              onClick={() => reactivate(restorableId)}
            >
              Reativar o fornecedor excluído
            </Button>
          )}
        </div>
      )}

      <QueryBoundary query={suppliers}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title={showDeleted ? "Nenhum fornecedor excluído" : "Nenhum fornecedor cadastrado"}
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {list.map((supplier) => (
                <li key={supplier.id} className="flex items-center gap-1 px-3 py-2">
                  {editing?.id === supplier.id ? (
                    <form
                      className="flex flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveName({ id: supplier.id, name: editing.name.trim() }, () => {
                          toast.success("Fornecedor renomeado.");
                          setEditing(null);
                        });
                      }}
                    >
                      <Input
                        aria-label={`Novo nome de ${supplier.name}`}
                        maxLength={80}
                        value={editing.name}
                        onChange={(e) => setEditing({ id: supplier.id, name: e.target.value })}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Salvar nome"
                        disabled={editing.name.trim() === "" || save.isPending}
                      >
                        <CheckIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Cancelar"
                        onClick={() => setEditing(null)}
                      >
                        <XIcon />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {supplier.name}
                      </span>
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={restore.isPending}
                          onClick={() => reactivate(supplier.id)}
                        >
                          <RotateCcwIcon /> Reativar
                        </Button>
                      ) : (
                        <>
                          <HistoryButton
                            size="xs"
                            label=""
                            target={{
                              scope: "company",
                              scopeId: companyId,
                              entity: "suppliers",
                              id: supplier.id,
                            }}
                            title={`Histórico de ${supplier.name}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Renomear ${supplier.name}`}
                            onClick={() => setEditing({ id: supplier.id, name: supplier.name })}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${supplier.name}`}
                            onClick={() => setDeleting(supplier)}
                          >
                            <Trash2Icon />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={showDeleted}
          onCheckedChange={(checked) => {
            setShowDeleted(checked);
            setEditing(null);
            setError(null);
            setRestorableId(null);
          }}
        />
        Mostrar só os excluídos
      </label>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir o fornecedor ${deleting?.name ?? ""}?`}
        description="Ele deixa de aparecer no envio e no recebimento de vasilhames. As movimentações já feitas continuam com ele. Para trazê-lo de volta, marque Mostrar só os excluídos e clique em Reativar."
        confirmLabel="Excluir fornecedor"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => toast.success("Fornecedor excluído."),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </div>
  );
}
