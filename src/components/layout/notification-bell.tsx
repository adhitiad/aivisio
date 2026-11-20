"use client";

import { useEffect } from "react";
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useDbClient, useLiveQuery } from "@tanstack/react-db";
import { useStore } from "@tanstack/react-store";
import { useT } from "@/lib/i18n";
import { notificationCollection } from "@/lib/collections";
import { setUnreadNotifications, setNotificationsOpen, uiStore } from "@/lib/ui-store";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

export function NotificationBell() {
  const t = useT("notifications");
  const unread = useStore(uiStore, (s) => s.unreadNotifications);
  const open = useStore(uiStore, (s) => s.notificationsOpen);
  const notifications = useDbClient().collection(notificationCollection);
  const { data: rows } = useLiveQuery({
    query: (q) => q.from({ n: notifications }),
  });

  const items = [...(rows ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  useEffect(() => {
    setUnreadNotifications(items.filter((n) => !n.read).length);
  }, [items]);

  async function markAllRead() {
    for (const item of items) {
      if (!item.read) {
        notifications.update(item.id, (draft) => {
          draft.read = true;
        });
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setNotificationsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("title")}
          title={t("title")}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("title")}</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("markAllRead")}
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const Icon =
                  TYPE_ICON[n.type as keyof typeof TYPE_ICON] ?? Info;
                const inner = (
                  <li
                    className={cn(
                      "flex gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
                      !n.read && "bg-muted/40"
                    )}
                  >
                    <Icon
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </li>
                );
                return n.link ? (
                  <a key={n.id} href={n.link}>
                    {inner}
                  </a>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
