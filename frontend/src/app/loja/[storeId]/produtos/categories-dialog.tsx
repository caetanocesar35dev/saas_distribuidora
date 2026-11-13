"use client";

import { CheckIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, QueryBoundary } from "@/components/app/common";
import { HistoryButton } from "@/components/app/history-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  extractRestorableId,
  useDeleteProductCategory,
  useProductCategories,
  useRestoreProductCategory,
  useSaveProductCategory,
} from "@/lib/api/hooks/catalog";
import { errorMessage } from "@/lib/api/client";
import type { ProductCategory } from "@/lib/api/types";

/** Categorias de produto da empresa: criar, renomear, excluir e reativar. */
export function CategoriesDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [showDeleted, setShowDeleted] = useState(false);
  const categories = useProductCategories(companyId, showDeleted);
  const save = useSaveProductCategory(companyId);
  const remove = useDeleteProductCategory(companyId);
  const restore = useRestoreProductCategory(companyId);

  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<ProductCategory | null>(null);
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
      onSuccess: (category) => {
        toast.success(`Categoria ${category.name} reativada.`);
        setError(null);
        setRestorableId(null);
        setNewName("");
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorias de produto</DialogTitle>
          <DialogDescription>
            Valem para todas as lojas da empresa. Servem para filtrar os produtos e ver o faturamento
            por categoria no painel.
          </DialogDescription>
        </DialogHeader>

        {!showDeleted && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveName({ name: newName.trim() }, () => {
                toast.success("Categoria cadastrada.");
                setNewName("");
              });
            }}
          >
            <Input
              aria-label="Nome da nova categoria"
              placeholder="Nova categoria"
              maxLength={50}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={newName.trim() === "" || save.isPending}>
              <PlusIcon /> Adicionar
            </Button>
          </form>
        )}

        {error && (
          <div role="alert" className="space-y-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>{error}</p>
            {restorableId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={restore.isPending}
                onClick={() => reactivate(restorableId)}
              >
                Reativar a categoria excluída
              </Button>
            )}
          </div>
        )}

        <QueryBoundary query={categories}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                title={showDeleted ? "Nenhuma categoria excluída" : "Nenhuma categoria cadastrada"}
              />
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {list.map((category) => (
                  <li key={category.id} className="flex items-center gap-1 px-3 py-2">
                    {editing?.id === category.id ? (
                      <form
                        className="flex flex-1 items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveName({ id: category.id, name: editing.name.trim() }, () => {
                            toast.success("Categoria renomeada.");
                            setEditing(null);
                          });
                        }}
                      >
                        <Input
                          aria-label={`Novo nome de ${category.name}`}
                          maxLength={50}
                          value={editing.name}
                          onChange={(e) => setEditing({ id: category.id, name: e.target.value })}
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
                          {category.name}
                        </span>
                        {showDeleted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restore.isPending}
                            onClick={() => reactivate(category.id)}
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
                                entity: "product-categories",
                                id: category.id,
                              }}
                              title={`Histórico de ${category.name}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Renomear ${category.name}`}
                              onClick={() => setEditing({ id: category.id, name: category.name })}
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Excluir ${category.name}`}
                              onClick={() => setDeleting(category)}
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
          Mostrar só as excluídas
        </label>

        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Excluir a categoria ${deleting?.name ?? ""}?`}
          description="Só é possível excluir se nenhum produto estiver nela. Para trazê-la de volta, marque Mostrar só as excluídas e clique em Reativar."
          confirmLabel="Excluir categoria"
          destructive
          pending={remove.isPending}
          onConfirm={() =>
            deleting &&
            remove.mutate(deleting.id, {
              onSuccess: () => toast.success("Categoria excluída."),
              onSettled: () => setDeleting(null),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
