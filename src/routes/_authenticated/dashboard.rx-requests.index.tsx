import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listMyRxRequests, type RxStatus } from "@/lib/rx-requests.functions";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/rx-requests/")({
  head: () => ({
    meta: [
      { title: "Prescription requests | MODO" },
      { name: "description", content: "Send and track prescription requests with your linked prescribers." },
      { property: "og:title", content: "Prescription requests | MODO" },
      { property: "og:description", content: "Send and track prescription requests with your linked prescribers." },
    ],
  }),
  component: MyRxRequests,
});

function StatusBadge({ status }: { status: RxStatus }) {
  const map: Record<RxStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
    awaiting_info: { label: "Awaiting info", cls: "bg-blue-100 text-blue-800" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
    declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
    withdrawn: { label: "Withdrawn", cls: "bg-neutral-200 text-neutral-700" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

const FILTERS: { value: RxStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "awaiting_info", label: "Awaiting info" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
];

function MyRxRequests() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listMyRxRequests);
  const [tab, setTab] = useState<RxStatus | "all">("all");
  const q = useQuery({
    queryKey: ["rx-mine", tab],
    queryFn: () => fetchList({ data: { role: "practitioner", status: tab } }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="min-w-0 text-sm text-muted-foreground">
          Send and track scripts with your linked prescribers.
        </p>
        <Button
          onClick={() => navigate({ to: "/dashboard/rx-requests/new" })}
          className="shrink-0 rounded-full"
        >
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setTab(f.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              tab === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          {q.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (q.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nothing here yet.</div>
          ) : (
            <ul className="divide-y">
              {(q.data ?? []).map((r) => {
                const snap = (r.patient_snapshot ?? {}) as { full_name?: string };
                return (
                  <li key={r.id}>
                    <Link
                      to="/prescriber/requests/$id"
                      params={{ id: r.id }}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.treatment_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {snap.full_name ?? "Patient"} • {r.partner_name} •{" "}
                          {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <StatusBadge status={r.status as RxStatus} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
