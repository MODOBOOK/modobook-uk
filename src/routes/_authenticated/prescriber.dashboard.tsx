import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, Clock, Inbox, Pill, Users } from "lucide-react";
import { getPrescriberAnalytics } from "@/lib/prescriber-analytics.functions";
import { WalkInDialog } from "@/components/prescriber/WalkInDialog";

export const Route = createFileRoute("/_authenticated/prescriber/dashboard")({
  ssr: false,
  component: PrescriberDashboard,
});

function PrescriberDashboard() {
  const fetchStats = useServerFn(getPrescriberAnalytics);
  const q = useQuery({ queryKey: ["prescriber-analytics"], queryFn: () => fetchStats(), refetchInterval: 60_000 });
  const s = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Your prescribing activity at a glance.</p>
        </div>
        <WalkInDialog trigger={<Button>+ New walk-in consult</Button>} />
      </div>

      {s?.walkInsAwaitingClose ? (
        <Card className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium">{s.walkInsAwaitingClose} walk-in{s.walkInsAwaitingClose > 1 ? "s" : ""} sent to practitioners to close</p>
                <p className="text-xs text-muted-foreground">Waiting for the practitioner to sign off.</p>
              </div>
            </div>
            <Link to="/prescriber"><Button size="sm" variant="outline">View</Button></Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Inbox className="h-4 w-4" />} label="Pending referrals" value={s?.pendingReferrals ?? "—"} href="/prescriber" />
        <Stat icon={<Users className="h-4 w-4" />} label="Active cases" value={s?.activeCases ?? "—"} href="/prescriber" />
        <Stat icon={<Pill className="h-4 w-4" />} label="Scripts signed this month" value={s?.scriptsSignedThisMonth ?? "—"} href="/prescriber/library" />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Completed this month" value={s?.completedThisMonth ?? "—"} />
        <Stat icon={<Activity className="h-4 w-4" />} label="Walk-ins this week" value={s?.walkInsThisWeek ?? "—"} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Avg response time" value={s?.avgResponseHours != null ? `${s.avgResponseHours}h` : "—"} />
        <Stat icon={<ClipboardList className="h-4 w-4" />} label="Directions library" value="Manage" href="/prescriber/directions" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!s?.activity?.length ? (
            <p className="text-sm text-muted-foreground">No activity yet — accept a referral or start a walk-in to see it here.</p>
          ) : s.activity.map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded border bg-muted/30 p-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</p>
              </div>
              <Badge variant="outline" className="shrink-0 capitalize">{a.kind.replace("_", " ")} · {a.detail}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string | number; href?: string }) {
  const inner = (
    <Card className="transition hover:shadow-luxe">
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
        <div className="font-serif text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}
