import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  CalendarDays,
  PoundSterling,
  Users,
  TrendingUp,
  XCircle,
  Clock,
} from "lucide-react";
import { getDashboardAnalytics } from "@/lib/analytics.functions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  ssr: false,
  component: AnalyticsPage,
});

type Appt = Awaited<ReturnType<typeof getDashboardAnalytics>>["appointments"][number];

type Range = "7d" | "30d" | "upcoming" | "month" | "year" | "all";

const CHART_COLORS = [
  "#c98a4b",
  "#5b8a72",
  "#8a6fb0",
  "#4a90b8",
  "#d4646a",
  "#b0913f",
  "#6c7a89",
  "#9c6f4b",
];

function formatCurrency(n: number) {
  return `£${n.toFixed(2)}`;
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function AnalyticsPage() {
  const fetchAnalytics = useServerFn(getDashboardAnalytics);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, [fetchAnalytics]);

  const { filtered, totals, chartData, treatmentBreakdown, statusBreakdown } = useMemo(() => {
    if (!data) {
      return {
        filtered: [],
        totals: {
          bookings: 0,
          revenue: 0,
          uniquePatients: 0,
          cancellations: 0,
          noShows: 0,
          avgBookingValue: 0,
        },
        chartData: [],
        treatmentBreakdown: [],
        statusBreakdown: [],
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    const to = new Date(today);

    switch (range) {
      case "7d":
        from.setDate(today.getDate() - 6);
        break;
      case "30d":
        from.setDate(today.getDate() - 29);
        break;
      case "upcoming":
        to.setDate(today.getDate() + 90);
        break;
      case "month":
        from.setDate(1);
        // include the whole month, not just up to today
        to.setMonth(today.getMonth() + 1, 0);
        break;
      case "year":
        from.setMonth(0, 1);
        to.setMonth(11, 31);
        break;
      case "all":
      default:
        from.setFullYear(2000);
        to.setFullYear(today.getFullYear() + 2);
    }

    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fromIso = iso(from);
    const toIso = iso(to);

    const filtered = data.appointments.filter((a) => a.scheduled_date >= fromIso && a.scheduled_date <= toIso);

    const amt = (a: Appt) => Number((a as Appt & { total_amount?: number | null }).total_amount ?? 0);
    const confirmed = filtered.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
    const cancellations = filtered.filter((a) => a.status === "cancelled").length;
    const noShows = filtered.filter((a) => a.status === "no_show").length;
    const revenue = confirmed.reduce((s, a) => s + amt(a), 0);
    const uniquePatients = new Set(filtered.map((a) => a.patient_email).filter(Boolean)).size;
    const avgBookingValue = confirmed.length ? revenue / confirmed.length : 0;

    const totals = {
      bookings: confirmed.length,
      revenue,
      uniquePatients,
      cancellations,
      noShows,
      avgBookingValue,
    };

    // Build buckets — daily for short spans, monthly for long ones.
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000);
    const monthly = spanDays > 120;
    const bucketKey = (dateIso: string) => (monthly ? dateIso.slice(0, 7) : dateIso);

    const buckets = new Map<string, { date: string; bookings: number; revenue: number }>();
    if (monthly) {
      // only span months that actually contain data, bounded by the range
      const keys = new Set(
        filtered.map((a) => a.scheduled_date.slice(0, 7)),
      );
      Array.from(keys)
        .sort()
        .forEach((k) => buckets.set(k, { date: `${k}-01`, bookings: 0, revenue: 0 }));
    } else {
      for (let i = 0; i <= Math.max(0, spanDays); i++) {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        buckets.set(iso(d), { date: iso(d), bookings: 0, revenue: 0 });
      }
    }
    for (const a of filtered) {
      if (a.status === "cancelled" || a.status === "no_show") continue;
      const b = buckets.get(bucketKey(a.scheduled_date));
      if (b) {
        b.bookings += 1;
        b.revenue += amt(a);
      }
    }
    const chartData = Array.from(buckets.values()).map((b) => ({
      ...b,
      label: monthly
        ? new Date(b.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : formatDateLabel(b.date),
    }));

    // Treatment breakdown
    const treatmentMap = new Map<string, { name: string; bookings: number; revenue: number; color?: string }>();
    for (const a of confirmed) {
      const treatment = (a as any).treatments;
      const name = treatment?.name ?? "Unknown";
      const existing = treatmentMap.get(name) ?? { name, bookings: 0, revenue: 0, color: treatment?.color };
      existing.bookings += 1;
      existing.revenue += amt(a);
      treatmentMap.set(name, existing);
    }
    const treatmentBreakdown = Array.from(treatmentMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((t, i) => ({ ...t, color: t.color || CHART_COLORS[i % CHART_COLORS.length] }));

    // Status breakdown
    const statusMap = new Map<string, number>();
    for (const a of filtered) {
      const label = a.status === "cancelled" ? "Cancelled" : a.status === "no_show" ? "No-show" : "Completed / Booked";
      statusMap.set(label, (statusMap.get(label) ?? 0) + 1);
    }
    const statusColors: Record<string, string> = {
      "Completed / Booked": "#5b8a72",
      Cancelled: "#d4646a",
      "No-show": "#c98a4b",
    };
    const statusBreakdown = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value, color: statusColors[name] ?? "#6c7a89" }));

    return { filtered, totals, chartData, treatmentBreakdown, statusBreakdown };
  }, [data, range]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="shrink-0 rounded-full">
            <Link to="/dashboard">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Insights</p>
            <h1 className="font-serif text-2xl sm:text-3xl">Analytics</h1>
          </div>
        </div>
        <Tabs value={range} className="-mx-1 w-full overflow-x-auto sm:mx-0 sm:w-auto" onValueChange={(v) => setRange(v as Range)}>
          <TabsList className="w-max rounded-full bg-muted/60">
            <TabsTrigger value="7d" className="rounded-full text-xs">7 days</TabsTrigger>
            <TabsTrigger value="30d" className="rounded-full text-xs">30 days</TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-full text-xs">Upcoming</TabsTrigger>
            <TabsTrigger value="month" className="rounded-full text-xs">This month</TabsTrigger>
            <TabsTrigger value="year" className="rounded-full text-xs">This year</TabsTrigger>
            <TabsTrigger value="all" className="rounded-full text-xs">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading || !data ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading analytics…</CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard icon={CalendarDays} label="Bookings" value={String(totals.bookings)} />
            <MetricCard icon={PoundSterling} label="Revenue" value={formatCurrency(totals.revenue)} />
            <MetricCard icon={Users} label="Unique patients" value={String(totals.uniquePatients)} />
            <MetricCard icon={TrendingUp} label="Avg. booking" value={formatCurrency(totals.avgBookingValue)} />
            <MetricCard icon={XCircle} label="Cancelled" value={String(totals.cancellations)} tone="destructive" />
            <MetricCard icon={Clock} label="No-shows" value={String(totals.noShows)} tone="muted" />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg">Revenue trend</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c98a4b" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#c98a4b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3ded5" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#8a8378" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#8a8378"
                        tickFormatter={(v) => `£${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                        }}
                        formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#c98a4b"
                        fill="url(#revenueGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg">Bookings trend</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3ded5" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#8a8378" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#8a8378" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                        }}
                      />
                      <Bar dataKey="bookings" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdowns */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/60 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg">Top treatments</CardTitle>
              </CardHeader>
              <CardContent>
                {treatmentBreakdown.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No treatment data for this period.</p>
                ) : (
                  <div className="space-y-3">
                    {treatmentBreakdown.map((t) => (
                      <div key={t.name} className="flex items-start gap-3">
                        <div
                          className="mt-1.5 size-3 shrink-0 rounded-full"
                          style={{ background: t.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium leading-snug">{t.name}</p>
                          <div className="mt-1 flex items-center gap-2 sm:hidden">
                            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{t.bookings}</Badge>
                            <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatCurrency(t.revenue)}</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                          {t.bookings}
                        </Badge>
                        <p className="hidden shrink-0 whitespace-nowrap text-right text-sm font-medium tabular-nums sm:block">{formatCurrency(t.revenue)}</p>
                      </div>
                    ))}

                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg">Status breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {statusBreakdown.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No data for this period.</p>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {statusBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "0.75rem",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-3">
                  {statusBreakdown.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="size-2 rounded-full" style={{ background: s.color }} />
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "default" | "destructive" | "muted";
}) {
  const toneClass =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "muted"
        ? "bg-muted text-muted-foreground"
        : "bg-primary/10 text-primary";

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className={`grid size-9 place-items-center rounded-full ${toneClass}`}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-serif text-xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
