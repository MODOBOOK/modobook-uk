import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getStaffAnalytics } from "@/lib/staff-payments.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/staff-analytics")({
  ssr: false,
  component: StaffAnalyticsPage,
  head: () => ({
    meta: [
      { title: "Team analytics | MODO" },
      {
        name: "description",
        content: "See how each team member is performing: bookings, takings, patients and top treatments.",
      },
      { property: "og:title", content: "Team analytics | MODO" },
      {
        property: "og:description",
        content: "See how each team member is performing: bookings, takings, patients and top treatments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Preset = "this-month" | "last-month" | "this-year" | "all" | "custom";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (n: number) => `£${n.toFixed(2)}`;

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "this-month") return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (p === "last-month") return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (p === "this-year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return { from: "2000-01-01", to: iso(new Date(y + 5, 0, 1)) };
}

function StaffAnalyticsPage() {
  const fetchReport = useServerFn(getStaffAnalytics);
  const [preset, setPreset] = useState<Preset>("this-month");
  const [range, setRange] = useState(() => presetRange("this-month"));
  const [data, setData] = useState<Awaited<ReturnType<typeof getStaffAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReport({ data: range })
      .then(setData)
      .catch(() => toast.error("Could not load team analytics"))
      .finally(() => setLoading(false));
  }, [fetchReport, range]);

  const periodLabel = useMemo(() => {
    if (preset === "all") return "All time";
    const f = new Date(range.from + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const t = new Date(range.to + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    return `${f} – ${t}`;
  }, [preset, range]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Team analytics</h1>
        <p className="text-muted-foreground">
          How each team member is doing — bookings, takings, patients and their most popular treatments. For
          what is owed between you, see the{" "}
          <Link to="/dashboard/commission-report" className="underline underline-offset-2">commission report</Link>.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 py-4">
          {([
            ["this-month", "This month"],
            ["last-month", "Last month"],
            ["this-year", "This year"],
            ["all", "All time"],
            ["custom", "Set dates"],
          ] as [Preset, string][]).map(([p, label]) => (
            <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => applyPreset(p)}>
              {label}
            </Button>
          ))}
          {preset === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !data || data.staff.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No bookings for team members in this period.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Bookings</p>
              <p className="text-2xl font-semibold">{data.totals.bookings}</p>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Team takings</p>
              <p className="text-2xl font-semibold">{money(data.totals.revenue)}</p>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Cancelled</p>
              <p className="text-2xl font-semibold">{data.totals.cancelled}</p>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">No shows</p>
              <p className="text-2xl font-semibold">{data.totals.noShows}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By team member</CardTitle>
              <CardDescription>{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.staff.map((s) => (
                <div key={s.staffId} className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.busiestDay && <Badge variant="outline" className="text-xs">Busiest: {s.busiestDay}</Badge>}
                      <Badge variant="secondary" className="text-xs">{money(s.averageValue)} average</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Bookings</p>{s.bookings}</div>
                    <div><p className="text-xs text-muted-foreground">Takings</p>{money(s.revenue)}</div>
                    <div><p className="text-xs text-muted-foreground">Completed</p>{s.completed}</div>
                    <div><p className="text-xs text-muted-foreground">Cancelled / no show</p>{s.cancelled} / {s.noShows}</div>
                    <div><p className="text-xs text-muted-foreground">Patients seen</p>{s.uniquePatients}</div>
                    <div><p className="text-xs text-muted-foreground">New</p>{s.newPatients}</div>
                    <div><p className="text-xs text-muted-foreground">Returning</p>{s.returningPatients}</div>
                  </div>
                  {s.topTreatments.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Top treatments</p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.topTreatments.map((t) => (
                          <Badge key={t.label} variant="outline" className="text-xs font-normal">
                            {t.label} · {t.count} · {money(t.amount)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {data.unassignedBookings > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  {data.unassignedBookings} bookings had no team member set and are not counted above.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
