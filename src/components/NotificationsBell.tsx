import { useEffect, useState, useCallback } from "react";
import { Bell, X, PartyPopper, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  listNotificationsPage,
  markAllNotificationsRead,
  clearNotification,
  clearAllNotifications,
  markNotificationRead,
  type NotificationPageRow,
} from "@/lib/notifications.functions";
import { PushToggle } from "@/components/PushToggle";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationsBell({ className }: { className?: string }) {
  const load = useServerFn(listNotificationsPage);
  const markAll = useServerFn(markAllNotificationsRead);
  const markOne = useServerFn(markNotificationRead);
  const clearOne = useServerFn(clearNotification);
  const clearAll = useServerFn(clearAllNotifications);

  const [items, setItems] = useState<NotificationPageRow[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const r = await load({ data: { limit: 15, offset: 0 } });
      setItems(r.items);
      setProfileId(r.profileId);
    } catch {}
  }, [load]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!profileId) return;
    const channelName = `notifications-${profileId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `profile_id=eq.${profileId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, refresh]);


  const unread = items.filter((n) => !n.read_at).length;

  async function onOpenChange(v: boolean) {
    setOpen(v);
    if (v && unread > 0) {
      await markAll().catch(() => {});
      refresh();
    }
  }

  async function onClearOne(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await clearOne({ data: { id } }).catch(() => {});
  }

  async function onClearAll() {
    setItems([]);
    await clearAll().catch(() => {});
  }

  async function onOpenItem(n: NotificationPageRow) {
    if (!n.read_at) await markOne({ data: { id: n.id } }).catch(() => {});
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background text-foreground hover:bg-muted transition",
            className,
          )}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground animate-pulse">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-h-[calc(100dvh-4rem)] overflow-hidden p-0 flex flex-col" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="font-serif text-base leading-tight">Notifications</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {items.length === 0 ? "All caught up" : `${items.length} in your inbox`}
            </div>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-8 gap-1 text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </Button>
          )}
        </div>

        <div className="border-b bg-muted/30 px-4 py-2">
          <PushToggle />
        </div>


        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <PartyPopper className="h-5 w-5 text-primary" />
            </div>
            <div className="font-medium">You're all caught up</div>
            <div className="text-xs text-muted-foreground">
              New bookings, forms and reviews will appear here.
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <ul className="divide-y">
              {items.map((n) => {
                const content = (
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                      {n.emoji || "🔔"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{n.title}</div>
                        <div className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</div>
                      </div>
                      {n.body && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClearOne(n.id);
                      }}
                      className="ml-1 rounded p-1 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"
                      aria-label="Clear"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
                return (
                  <li key={n.id} className={cn("cursor-pointer", !n.read_at && "bg-primary/[0.03]")}
                    onClick={() => {
                      onOpenItem(n);
                      const target = n.resolved_link || n.link;
                      if (target) navigate({ to: target as string });
                    }}
                  >
                    {content}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="border-t px-3 py-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 w-full justify-center text-xs"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/dashboard/notifications" });
            }}
          >
            View all notifications
          </Button>
        </div>

        {items.length > 0 && unread > 0 && (
          <div className="border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-center gap-1 text-xs"
              onClick={() => markAll().then(refresh)}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
