"use client";

import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
import { PlatformActionButton } from "@/components/app/platform-button";
import { PollDeadline, PollResults } from "@/components/app/poll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteNotification,
  usePlatformNotifications,
  useSaveNotification,
} from "@/lib/api/hooks/platform";
import type { NotificationType, PlatformNotification } from "@/lib/api/types";
import {
  formatDateTime,
  fromDatetimeLocal,
  NOTIFICATION_TYPE_LABEL,
  toDatetimeLocal,
} from "@/lib/format";
import {
  filledOptions,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  pollFormError,
} from "@/lib/poll";

const TYPE_OPTIONS = (Object.entries(NOTIFICATION_TYPE_LABEL) as [NotificationType, string][]).map(
  ([value, label]) => ({ value, label }),
);

/** Valor de um `<input type="datetime-local">` em milissegundos (vazio = null). */
const localMs = (value: string) => (value ? new Date(value).getTime() : null);

function NotificationDialog({
  notification,
  onClose,
}: {
  notification: PlatformNotification | null;
  onClose: () => void;
}) {
  const save = useSaveNotification();
  const [title, setTitle] = useState(notification?.title ?? "");
  const [body, setBody] = useState(notification?.body ?? "");
  const [type, setType] = useState<NotificationType>(notification?.type ?? "NEWS");
  const [publishedAt, setPublishedAt] = useState(toDatetimeLocal(notification?.publishedAt));
  const [expiresAt, setExpiresAt] = useState(toDatetimeLocal(notification?.expiresAt));
  // Enquete
  const [options, setOptions] = useState<string[]>(
    notification?.poll?.options.map((o) => o.label) ?? ["", ""],
  );
  const [pollEndsAt, setPollEndsAt] = useState(toDatetimeLocal(notification?.poll?.endsAt));
  const [pollMultiple, setPollMultiple] = useState(notification?.poll?.multiple ?? false);
  // Momento em que o formulário abriu: na criação, o prazo precisa estar depois dele.
  const [openedAt] = useState(() => Date.now());

  const isPoll = type === "POLL";
  // Com voto, as opções e o tipo de resposta não mudam mais (regra do backend).
  const hasVotes = (notification?.poll?.totalVoters ?? 0) > 0;
  // Ao editar, enquete não vira outro tipo nem o contrário.
  const typeOptions = notification
    ? TYPE_OPTIONS.filter((o) => (o.value === "POLL") === (notification.type === "POLL"))
    : TYPE_OPTIONS;
  const pollError = isPoll
    ? pollFormError({
        options,
        endsAt: localMs(pollEndsAt),
        publishedAt: localMs(publishedAt),
        expiresAt: localMs(expiresAt),
        now: notification ? null : openedAt,
      })
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{notification ? "Editar notificação" : "Nova notificação"}</DialogTitle>
          <DialogDescription>
            Aparece no sino de todos os usuários a partir da data de publicação. Uma data no futuro
            agenda a notificação.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                id: notification?.id,
                body: {
                  title: title.trim(),
                  body: body.trim(),
                  type,
                  publishedAt: fromDatetimeLocal(publishedAt),
                  expiresAt: expiresAt ? fromDatetimeLocal(expiresAt) : notification ? null : undefined,
                  ...(isPoll && {
                    pollEndsAt: fromDatetimeLocal(pollEndsAt),
                    // Com voto, as opções e o tipo de resposta ficam como estão.
                    ...(!hasVotes && { pollOptions: filledOptions(options), pollMultiple }),
                  }),
                },
              },
              {
                onSuccess: () => {
                  toast.success(notification ? "Notificação atualizada." : "Notificação criada.");
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Título" htmlFor="nt-title">
            <Input
              id="nt-title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Mensagem" htmlFor="nt-body">
            <Textarea
              id="nt-body"
              rows={5}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </FormField>
          <FormField label="Tipo" htmlFor="nt-type">
            <SelectField<NotificationType>
              id="nt-type"
              value={type}
              onChange={setType}
              options={typeOptions}
              disabled={notification?.type === "POLL"}
            />
          </FormField>
          {isPoll && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
              <FormField
                label="Opções da enquete"
                hint={
                  hasVotes
                    ? "A enquete já recebeu votos: as opções não mudam mais."
                    : `De ${POLL_MIN_OPTIONS} a ${POLL_MAX_OPTIONS} opções. As vazias são ignoradas.`
                }
              >
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        aria-label={`Opção ${index + 1}`}
                        placeholder={`Opção ${index + 1}`}
                        maxLength={POLL_OPTION_MAX_LENGTH}
                        value={option}
                        disabled={hasVotes}
                        onChange={(e) =>
                          setOptions((list) =>
                            list.map((o, i) => (i === index ? e.target.value : o)),
                          )
                        }
                      />
                      {!hasVotes && options.length > POLL_MIN_OPTIONS && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover opção ${index + 1}`}
                          onClick={() => setOptions((list) => list.filter((_, i) => i !== index))}
                        >
                          <XIcon />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!hasVotes && options.length < POLL_MAX_OPTIONS && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setOptions((list) => [...list, ""])}
                    >
                      <PlusIcon /> Adicionar opção
                    </Button>
                  )}
                </div>
              </FormField>
              <FormField
                label="Prazo para votar"
                htmlFor="nt-poll-end"
                hint="Depois dele ninguém vota, e todos veem o resultado."
              >
                <Input
                  id="nt-poll-end"
                  type="datetime-local"
                  value={pollEndsAt}
                  onChange={(e) => setPollEndsAt(e.target.value)}
                />
              </FormField>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={pollMultiple}
                  onCheckedChange={setPollMultiple}
                  disabled={hasVotes}
                />
                Permitir mais de uma resposta
              </label>
              {pollError && <p className="text-xs text-muted-foreground">{pollError}</p>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Publicar em" htmlFor="nt-pub" hint="Vazio = agora.">
              <Input
                id="nt-pub"
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </FormField>
            <FormField label="Expira em (opcional)" htmlFor="nt-exp" hint="Vazio = nunca expira.">
              <Input
                id="nt-exp"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                title.trim() === "" || body.trim() === "" || pollError !== null || save.isPending
              }
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlatformNotificationsView() {
  const [page, setPage] = useState(1);
  const list = usePlatformNotifications(page);
  const remove = useDeleteNotification();
  const [dialog, setDialog] = useState<{ notification: PlatformNotification | null } | null>(null);
  const [deleting, setDeleting] = useState<PlatformNotification | null>(null);
  // Referência fixa do momento em que a tela abriu (para marcar agendadas e expiradas).
  const [now] = useState(() => Date.now());

  return (
    <div>
      <PageHeader
        title="Notificações"
        description="Avisos e novidades para todos os usuários do sistema."
        help="plataforma-notificacoes"
        actions={
          <PlatformActionButton onClick={() => setDialog({ notification: null })}>
            <PlusIcon /> Nova notificação
          </PlatformActionButton>
        }
      />

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nenhuma notificação criada" />
      ) : (
        <div className="space-y-3">
          {list.data.data.map((n) => {
            const scheduled = new Date(n.publishedAt).getTime() > now;
            const expired = n.expiresAt !== null && new Date(n.expiresAt).getTime() <= now;
            return (
              <article key={n.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{n.title}</h2>
                  <Badge variant="secondary">{NOTIFICATION_TYPE_LABEL[n.type]}</Badge>
                  {scheduled && <Badge variant="outline">Agendada</Badge>}
                  {expired && <Badge variant="outline">Expirada</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(n.publishedAt)} · lida por {n.readCount}
                  </span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{n.body}</p>
                {n.poll && (
                  <div className="mt-3 space-y-2">
                    <PollDeadline poll={n.poll} />
                    <PollResults poll={n.poll} />
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <PlatformActionButton
                    variant="outline"
                    size="sm"
                    onClick={() => setDialog({ notification: n })}
                  >
                    <PencilIcon /> Editar
                  </PlatformActionButton>
                  <PlatformActionButton variant="ghost" size="sm" onClick={() => setDeleting(n)}>
                    <Trash2Icon /> Excluir
                  </PlatformActionButton>
                </div>
              </article>
            );
          })}
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </div>
      )}

      {dialog && (
        <NotificationDialog
          key={dialog.notification?.id ?? "new"}
          notification={dialog.notification}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir esta notificação?"
        description="Ela some do sino de todos os usuários."
        confirmLabel="Excluir"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Notificação excluída.");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
