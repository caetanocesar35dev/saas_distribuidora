"use client";

import { useEffect, useState } from "react";
import { EmptyState, PageHeader, QueryBoundary } from "@/components/app/common";
import { Pagination } from "@/components/app/pagination";
import { PollVote } from "@/components/app/poll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/lib/api/hooks/notifications";
import { formatDateTime, NOTIFICATION_TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsView() {
  const [page, setPage] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const list = useNotifications({ page, unread: onlyUnread });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unreadCount = useUnreadCount().data?.count ?? 0;

  // O sino leva a /notificacoes#n-<id> (enquete): a lista chega depois, então rola até ela aqui.
  useEffect(() => {
    if (!list.data) return;
    const target = window.location.hash.slice(1);
    if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [list.data]);

  return (
    <div>
      <PageHeader
        title="Notificações"
        description="Avisos e novidades do sistema."
        help="gestao-notificacoes"
        actions={
          <>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                disabled={markAll.isPending}
                onClick={() =>
                  markAll.mutate(undefined, {
                    onSuccess: () =>
                      toast.success("Todas as notificações foram marcadas como lidas."),
                  })
                }
              >
                <CheckCheckIcon /> Marcar todas como lidas
              </Button>
            )}
            <Button
              variant={onlyUnread ? "default" : "outline"}
              onClick={() => {
                setOnlyUnread((v) => !v);
                setPage(1);
              }}
            >
              {onlyUnread ? "Mostrando só não lidas" : "Mostrar só não lidas"}
            </Button>
          </>
        }
      />
      <QueryBoundary query={list}>
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState
              title={onlyUnread ? "Nenhuma notificação não lida" : "Nenhuma notificação por enquanto"}
            />
          ) : (
            <div className="space-y-3">
              {result.data.map((n) => (
                <article
                  key={n.id}
                  id={`n-${n.id}`}
                  className={cn(
                    "scroll-mt-20 rounded-xl border bg-card p-4",
                    !n.read && "border-primary/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.read && <span className="size-2 rounded-full bg-primary" />}
                    <h2 className="font-medium">{n.title}</h2>
                    <Badge variant="secondary">{NOTIFICATION_TYPE_LABEL[n.type]}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(n.publishedAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{n.body}</p>
                  {n.poll && (
                    <div className="mt-3">
                      <PollVote notificationId={n.id} poll={n.poll} />
                    </div>
                  )}
                  {!n.read && (
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Marcar como lida
                    </Button>
                  )}
                </article>
              ))}
              <Pagination meta={result.meta} onPageChange={setPage} />
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
