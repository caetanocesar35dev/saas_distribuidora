"use client";

import { useState } from "react";
import { EmptyState, PageHeader, QueryBoundary } from "@/components/app/common";
import { Pagination } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMarkNotificationRead, useNotifications } from "@/lib/api/hooks/notifications";
import { formatDateTime, NOTIFICATION_TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsView() {
  const [page, setPage] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const list = useNotifications({ page, unread: onlyUnread });
  const markRead = useMarkNotificationRead();

  return (
    <div>
      <PageHeader
        title="Notificações"
        description="Avisos e novidades do sistema."
        help="gestao-notificacoes"
        actions={
          <Button
            variant={onlyUnread ? "default" : "outline"}
            onClick={() => {
              setOnlyUnread((v) => !v);
              setPage(1);
            }}
          >
            {onlyUnread ? "Mostrando só não lidas" : "Mostrar só não lidas"}
          </Button>
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
                  className={cn("rounded-xl border bg-card p-4", !n.read && "border-primary/40")}
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
