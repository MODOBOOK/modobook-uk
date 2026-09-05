import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, PartyPopper, Trash2, CheckCheck, Loader2, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  listNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  clearNotification,
  clearAllNotifications,
  type NotificationPageRow,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/dashboard/notifications/")({
  ssr: false,
  component: NotificationsPage,
});

const PAGE = 30;

const FILTERS: Array<{ key: string; label: string; type: string | null; unreadOnly?: boolean }> = [
  { key: "all", label: "All", type: null },
  { key: "unread", label: "Unread", type: null, unreadOnly: true },
  { key: "booking", label: "Bookings", type: "booking" },
  { key: "consent", label: "Consents", type: "consent" },
  { key: "form", label: "Medical forms", type: "form" },
  { key: "review", label: "Reviews", type: "review" },
];

function fullTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function NotificationsPage() {
  const load = useServerFn(listNotificationsPage);
  const markAll = useServerFn(markAllNotificationsRead);
  const markOne = useServerFn(markNotificationRead);
  const clearOne = useServerFn(clearNotification);
  const clearAll = useServerFn(clearAllNotifications);
  const navigate = useNavigate();

  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState<NotificationPageRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const fetchPage = useCallback(
    async (offset: number) => {
      return load({
        data: { limit: PAGE, offset, type: active.type, unreadOnly: active.unreadOnly ?? false },
      });
    },
    [load, active.type, active.unreadOnly],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPage(0)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setHasMore(r.hasMore);
        setUnread(r.unreadCount);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await fetchPage(items.length);
      setItems((prev) => [...prev, ...r.items]);
      setHasMore(r.hasMore);
    } catch {}
    setLoadingMore(false);
  }

  async function open(n: NotificationPageRow) {
    if (!n.read_at) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
      setUnread((u) => Math.max(0, u - 1));
      await markOne({ data: { id: n.id } }).catch(() => {});
    }
    const target = n.resolved_link || n.link;
    if (target) navigate({ to: target as string });
  }

  async function removeOne(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await clearOne({ data: { id } }).catch(() => {});
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl leading-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "Everything is read"} — tap any item to open the patient or page it relates to.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
              setUnread(0);
              await markAll().catch(() => {});
            }}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive"
            onClick={async () => {
              setItems([]);
              setHasMore(false);
              await clearAll().catch(() => {});
            }}
          >
            <Trash2 className="h-4 w-4" /> Clear all
          </Button>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <PartyPopper className="h-6 w-6 text-primary" />
          </div>
          <div className="font-medium">Nothing here</div>
          <div className="text-sm text-muted-foreground">
            New bookings, signed consents, medical forms and reviews will appear here.
          </div>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden p-0">
          {items.map((n) => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => open(n)}
              onKeyDown={(e) => e.key === "Enter" && open(n)}
              className={cn(
                "flex cursor-pointer items-start gap-3 px-4 py-4 transition hover:bg-muted/50 active:bg-muted",
                !n.read_at && "bg-primary/[0.04]",
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
                {n.emoji || <Bell className="h-5 w-5 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-semibold">{n.title}</span>
                  {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
                </div>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{fullTime(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 self-center">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  aria-label="Clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeOne(n.id);
                  }}
                  className="rounded p-2 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}
