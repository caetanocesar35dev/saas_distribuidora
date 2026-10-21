"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/lib/api/hooks/notifications";
import { formatDateTime, NOTIFICATION_TYPE_LABEL } from "@/lib/format";

/** Sino do cabeçalho: contador de não lidas e as últimas notificações do sistema. */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notificações" className="relative" />
        }
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        {open && <BellList onNavigate={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function BellList({ onNavigate }: { onNavigate: () => void }) {
  const list = useNotifications({ page: 1, unread: false, limit: 6 });
  const markRead = useMarkNotificationRead();

  return (
    <div>
      <div className="border-b px-3 py-2 text-sm font-medium">Notificações</div>
      <div className="max-h-80 overflow-y-auto">
        {list.isPending && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
        {list.isError && (
          <p className="p-4 text-sm text-destructive">Não foi possível carregar.</p>
        )}
        {list.data?.data.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
        )}
        {list.data?.data.map((n) => (
          <div key={n.id} className="border-b px-3 py-2.5 last:border-b-0">
            <div className="flex items-center gap-2">
              {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{n.title}</p>
              <Badge variant="secondary">{NOTIFICATION_TYPE_LABEL[n.type]}</Badge>
            </div>
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{n.body}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {formatDateTime(n.publishedAt)}
              </span>
              {!n.read && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(n.id)}
                >
                  Marcar como lida
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/notificacoes"
        onClick={onNavigate}
        className="block border-t px-3 py-2 text-center text-sm text-primary hover:bg-muted/50"
      >
        Ver todas
      </Link>
    </div>
  );
}
