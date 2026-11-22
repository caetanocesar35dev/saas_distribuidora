"use client";

import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, QueryBoundary } from "@/components/app/common";
import { HistoryButton } from "@/components/app/history-dialog";
import { Badge } from "@/components/ui/badge";
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
import { extractRestorableId } from "@/lib/api/hooks/catalog";
import {
  useDeleteSaleChannel,
  useRestoreSaleChannel,
  useSaleChannels,
  useSaveSaleChannel,
  useSetDefaultSaleChannel,
} from "@/lib/api/hooks/sales";
import { errorMessage } from "@/lib/api/client";
import type { SaleChannel } from "@/lib/api/types";

/** Origens da venda da empresa: criar, renomear, escolher a padrão, excluir e reativar. */
export function ChannelsDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [showDeleted, setShowDeleted] = useState(false);
  const channels = useSaleChannels(companyId, showDeleted);
  const save = useSaveSaleChannel(companyId);
  const setDefault = useSetDefaultSaleChannel(companyId);
  const remove = useDeleteSaleChannel(companyId);
  const restore = useRestoreSaleChannel(companyId);

  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<SaleChannel | null>(null);
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
      onSuccess: (channel) => {
        toast.success(`Origem ${channel.name} reativada.`);
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
          <DialogTitle>Origens da venda</DialogTitle>
          <DialogDescription>
            De onde vêm as vendas (balcão, WhatsApp, iFood...). Valem para todas as lojas da
            empresa. A padrão já vem marcada no fechamento da venda.
          </DialogDescription>
        </DialogHeader>

        {!showDeleted && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveName({ name: newName.trim() }, () => {
                toast.success("Origem cadastrada.");
                setNewName("");
              });
            }}
          >
            <Input
              aria-label="Nome da nova origem"
              placeholder="Nova origem (ex.: Aiqfome)"
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
                Reativar a origem excluída
              </Button>
            )}
          </div>
        )}

        <QueryBoundary query={channels}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                title={showDeleted ? "Nenhuma origem excluída" : "Nenhuma origem cadastrada"}
              />
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {list.map((channel) => (
                  <li key={channel.id} className="flex items-center gap-1 px-3 py-2">
                    {editing?.id === channel.id ? (
                      <form
                        className="flex flex-1 items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveName({ id: channel.id, name: editing.name.trim() }, () => {
                            toast.success("Origem renomeada.");
                            setEditing(null);
                          });
                        }}
                      >
                        <Input
                          aria-label={`Novo nome de ${channel.name}`}
                          maxLength={50}
                          value={editing.name}
                          onChange={(e) => setEditing({ id: channel.id, name: e.target.value })}
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
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                          <span className="truncate">{channel.name}</span>
                          {channel.isDefault && <Badge variant="secondary">Padrão</Badge>}
                        </span>
                        {showDeleted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restore.isPending}
                            onClick={() => reactivate(channel.id)}
                          >
                            <RotateCcwIcon /> Reativar
                          </Button>
                        ) : (
                          <>
                            {!channel.isDefault && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Tornar ${channel.name} a origem padrão`}
                                title="Tornar padrão"
                                disabled={setDefault.isPending}
                                onClick={() =>
                                  setDefault.mutate(channel.id, {
                                    onSuccess: () =>
                                      toast.success(`${channel.name} agora é a origem padrão.`),
                                  })
                                }
                              >
                                <StarIcon />
                              </Button>
                            )}
                            <HistoryButton
                              size="xs"
                              label=""
                              target={{
                                scope: "company",
                                scopeId: companyId,
                                entity: "sale-channels",
                                id: channel.id,
                              }}
                              title={`Histórico de ${channel.name}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Renomear ${channel.name}`}
                              onClick={() => setEditing({ id: channel.id, name: channel.name })}
                            >
                              <PencilIcon />
                            </Button>
                            {!channel.isDefault && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Excluir ${channel.name}`}
                                onClick={() => setDeleting(channel)}
                              >
                                <Trash2Icon />
                              </Button>
                            )}
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
          title={`Excluir a origem ${deleting?.name ?? ""}?`}
          description="Ela deixa de aparecer no fechamento da venda. As vendas já feitas continuam com ela. Para trazê-la de volta, marque Mostrar só as excluídas e clique em Reativar."
          confirmLabel="Excluir origem"
          destructive
          pending={remove.isPending}
          onConfirm={() =>
            deleting &&
            remove.mutate(deleting.id, {
              onSuccess: () => toast.success("Origem excluída."),
              onSettled: () => setDeleting(null),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
