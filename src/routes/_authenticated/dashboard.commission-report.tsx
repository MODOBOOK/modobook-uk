import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getCommissionReport } from "@/lib/staff-payments.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/commission-report")({
  ssr: false,
  component: CommissionReportPage,
  head: () => ({
    meta: [
      { title: "Commission report | MODO" },
      { name: "description", content: "See what each team member has taken and the commission owed between you." },
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

function CommissionReportPage() {
  const fetchReport = useServerFn(getCommissionReport);
  const [preset, setPreset] = useState<Preset>("this-month");
  const [range, setRange] = useState(() => presetRange("this-month"));
  const [data, setData] = useState<Awaited<ReturnType<typeof getCommissionReport>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReport({ data: range })
      .then(setData)
      .catch(() => toast.error("Could not load the commission report"))
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
        <h1 className="text-2xl font-bold">Commission</h1>
        <p className="text-muted-foreground">
          What each team member has taken, their share, and what is owed between you. Set each person's
          share and where their card payments land on the{" "}
          <Link to="/dashboard/staff" className="underline underline-offset-2">team page</Link>.
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Team takings</p>
              <p className="text-2xl font-semibold">{money(data.totals.revenue)}</p>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Their share</p>
              <p className="text-2xl font-semibold">{money(data.totals.practitionerShare)}</p>
            </CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Your commission</p>
              <p className="text-2xl font-semibold">{money(data.totals.ownerShare)}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By team member</CardTitle>
              <CardDescription>{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.staff.map((s) => (
                <div key={s.staffId} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{s.commissionPercent}% to them</Badge>
                      <Badge variant="secondary" className="text-xs">
                        {s.payoutMode === "own_account" ? "Paid to their account" : "Paid to you"}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Bookings</p>{s.bookings}</div>
                    <div><p className="text-xs text-muted-foreground">Takings</p>{money(s.revenue)}</div>
                    <div><p className="text-xs text-muted-foreground">Their share</p>{money(s.practitionerShare)}</div>
                    <div><p className="text-xs text-muted-foreground">Your commission</p>{money(s.ownerShare)}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.owedToPractitioner >= 0
                      ? `You owe ${s.name} ${money(s.owedToPractitioner)}.`
                      : `${s.name} owes you ${money(Math.abs(s.owedToPractitioner))}.`}
                  </p>
                </div>
              ))}
              {data.unassignedRevenue > 0 && (
                <p className="text-xs text-muted-foreground pt-2">
                  {money(data.unassignedRevenue)} of takings had no team member set and is not counted above.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
