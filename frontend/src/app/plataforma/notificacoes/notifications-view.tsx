"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
import { PlatformActionButton } from "@/components/app/platform-button";
import { Badge } from "@/components/ui/badge";
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

const TYPE_OPTIONS = (Object.entries(NOTIFICATION_TYPE_LABEL) as [NotificationType, string][]).map(
  ([value, label]) => ({ value, label }),
);

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
              options={TYPE_OPTIONS}
            />
          </FormField>
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
              disabled={title.trim() === "" || body.trim() === "" || save.isPending}
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
