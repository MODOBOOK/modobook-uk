import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { getIncomeReport } from "@/lib/analytics.functions";
import { generateIncomeReportPdf } from "@/lib/income-report-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/income-report")({
  ssr: false,
  component: IncomeReportPage,
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

function IncomeReportPage() {
  const fetchReport = useServerFn(getIncomeReport);
  const [preset, setPreset] = useState<Preset>("this-month");
  const [range, setRange] = useState(() => presetRange("this-month"));
  const [data, setData] = useState<Awaited<ReturnType<typeof getIncomeReport>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReport({ data: range })
      .then(setData)
      .catch(() => toast.error("Could not load the income report"))
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

  const download = () => {
    if (!data) return;
    const doc = generateIncomeReportPdf({
      clinicName: data.clinicName,
      brandColor: data.brandColor,
      periodLabel,
      totals: data.totals,
      byMethod: data.byMethod,
      byTreatment: data.byTreatment,
      byMonth: data.byMonth,
      rows: data.rows,
    });
    doc.save(`income-report-${range.from}-to-${range.to}.pdf`);
  };

  const t = data?.totals;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 overflow-x-hidden">
      {/* Back + title live in the top bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <Button onClick={download} disabled={!data || loading} className="gap-2">
          <Download className="size-4" /> Download PDF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Choose a period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["this-month", "This month"],
              ["last-month", "Last month"],
              ["this-year", "This year"],
              ["all", "All time"],
              ["custom", "Custom dates"],
            ] as [Preset, string][]).map(([p, label]) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={preset === p ? "default" : "outline"}
                className="rounded-full"
                onClick={() => applyPreset(p)}
              >
                {label}
              </Button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[
              ["Net income", money(t!.net)],
              ["Income", money(t!.gross)],
              ["Refunds", money(t!.refunds)],
              ["Discounts given", money(t!.discounts)],
              ["Bookings", String(t!.bookings)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                  <p className="mt-1 font-serif text-2xl">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By payment method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.byMethod.length === 0 && <p className="text-muted-foreground">No income in this period.</p>}
                {data.byMethod.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-2">
                    <span className="capitalize">{m.label.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{m.count} · {money(m.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By treatment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.byTreatment.length === 0 && <p className="text-muted-foreground">No income in this period.</p>}
                {data.byTreatment.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-2">
                    <span className="truncate">{m.label}</span>
                    <span className="shrink-0 text-muted-foreground">{m.count} · {money(m.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Treatment</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2 text-right">Refund</th>
                      <th className="px-3 py-2 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No bookings in this period.</td>
                      </tr>
                    )}
                     {data.rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-2">{r.treatment}</td>
                        <td className="px-3 py-2 capitalize">{r.method.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2 text-right">{r.refunded ? money(r.refunded) : "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(r.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
