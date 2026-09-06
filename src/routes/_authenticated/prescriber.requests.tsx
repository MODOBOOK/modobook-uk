import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getPrescriberDashboard, listMyRxRequests, type RxStatus } from "@/lib/rx-requests.functions";
import { Clock, MessageCircleQuestion, CheckCircle2, Users, Timer } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/prescriber/requests")({
  head: () => ({ meta: [{ title: "Prescription requests | MODO Hub" }] }),
  component: PrescriberRequests,
});

function fmtDuration(ms: number | null) {
  if (ms == null) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function StatusBadge({ status }: { status: RxStatus }) {
  const map: Record<RxStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
    awaiting_info: { label: "Awaiting info", cls: "bg-blue-100 text-blue-800" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
    declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
    withdrawn: { label: "Withdrawn", cls: "bg-neutral-200 text-neutral-700" },
  };
  const m = map[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function PrescriberRequests() {
  const fetchDash = useServerFn(getPrescriberDashboard);
  const fetchList = useServerFn(listMyRxRequests);
  const [tab, setTab] = useState<RxStatus | "all">("pending");

  const dashQ = useQuery({
    queryKey: ["rx-prescriber-dash"],
    queryFn: () => fetchDash(),
    refetchInterval: 30_000,
  });
  const listQ = useQuery({
    queryKey: ["rx-prescriber-list", tab],
    queryFn: () => fetchList({ data: { role: "prescriber", status: tab } }),
  });

  const d = dashQ.data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prescription requests</h1>
        <p className="text-muted-foreground">Review, decide and chat — all logged for governance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label="Outstanding" value={d?.outstanding.length ?? 0} tone="amber" />
        <StatCard icon={<MessageCircleQuestion className="h-4 w-4" />} label="Awaiting info" value={d?.awaiting.length ?? 0} tone="blue" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Recent approvals" value={d?.recent.length ?? 0} tone="emerald" />
        <StatCard icon={<Users className="h-4 w-4" />} label="Linked practitioners" value={d?.linkedCount ?? 0} tone="neutral" />
        <StatCard icon={<Timer className="h-4 w-4" />} label="Avg response (30d)" value={fmtDuration(d?.avgResponseMs ?? null)} tone="neutral" />
      </div>

      <Card>
        <CardHeader><CardTitle>All requests</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as RxStatus | "all")}>
            <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="awaiting_info">Awaiting info</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="declined">Declined</TabsTrigger>
              <TabsTrigger value="withdrawn">Withdrawn</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {listQ.isLoading ? (
                <div className="text-muted-foreground">Loading…</div>
              ) : (listQ.data ?? []).length === 0 ? (
                <div className="text-muted-foreground text-sm py-6 text-center">Nothing here yet.</div>
              ) : (
                 <ul className="divide-y">
                  {(listQ.data ?? []).map((r) => {
                    const snap = (r.patient_snapshot ?? {}) as { full_name?: string };
                    const open = r.status === "pending" || r.status === "awaiting_info";
                    return (
                      <li key={r.id} className="flex items-center gap-2 py-3 px-2">
                        <Link
                          to="/prescriber/requests/$id"
                          params={{ id: r.id }}
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.treatment_name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {snap.full_name ?? "Patient"} • from {r.partner_name} • {new Date(r.created_at).toLocaleString()}
                            </div>
                          </div>
                          <StatusBadge status={r.status as RxStatus} />
                        </Link>
                        {open && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <QuickApproveButton requestId={r.id} label="Sign" />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: "amber" | "blue" | "emerald" | "neutral" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    blue: "bg-blue-50 text-blue-900 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-900 border-emerald-200",
    neutral: "bg-muted/50 text-foreground border-border",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
