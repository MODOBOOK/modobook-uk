import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ShieldAlert, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  adminInsights,
  type ClinicHealth,
  type TrendDay,
} from "@/lib/admin-insights.functions";

export const Route = createFileRoute("/_authenticated/admin/insights")({
  ssr: false,
  loader: () => adminInsights(),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Admin only</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Platform insights | Modo Admin" },
      { name: "description", content: "Activity feed, clinic health overview and usage trends across Modo." },
      { property: "og:title", content: "Platform insights | Modo Admin" },
      { property: "og:description", content: "Activity feed, clinic health overview and usage trends across Modo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
});

function dayLabel(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const money = (n: number) => `£${n.toFixed(2)}`;

function InsightsPage() {
  const data = Route.useLoaderData() as {
    clinics: ClinicHealth[];
    trends: TrendDay[];
    totals: { clinics: number; bookings_30d: number; revenue_30d: number };
  };

  const flagged = data.clinics.filter((c) => c.flags.length > 0);

  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <BarChart3 className="h-5 w-5 text-amber-500" />
          Platform insights
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What's happening across every clinic. Counts only — no client personal details are shown here.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clinics</p>
            <p className="text-2xl font-semibold">{data.totals.clinics}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Bookings (30 days)</p>
            <p className="text-2xl font-semibold">{data.totals.bookings_30d}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Payments taken (30 days)</p>
            <p className="text-2xl font-semibold">{money(data.totals.revenue_30d)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage trends */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookings per day</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11 }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip labelFormatter={dayLabel} />
                <Bar dataKey="bookings" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payments per day</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} width={46} tickFormatter={(v: number) => `£${v}`} />
                <Tooltip labelFormatter={dayLabel} formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Clinic health */}
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
        Clinic health — {flagged.length} clinic{flagged.length === 1 ? "" : "s"} need a look
      </h2>
      <div className="mb-8 space-y-3">
        {data.clinics.map((c) => (
          <Card key={c.profile_id}>
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
              <div className="min-w-40">
                <p className="truncate text-sm font-medium">{c.clinic_name}</p>
                {c.slug && <p className="text-xs text-muted-foreground">modobook.uk/m/{c.slug}</p>}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-slate-800">{c.bookings_7d}</span> bookings this week ·{" "}
                <span className="font-semibold text-slate-800">{c.upcoming}</span> upcoming
              </div>
              <div className="flex flex-wrap gap-1.5 lg:ml-auto">
                {c.flags.length === 0 ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Healthy
                  </Badge>
                ) : (
                  c.flags.map((f) => (
                    <Badge key={f} variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
                      <TriangleAlert className="mr-1 h-3 w-3" />
                      {f}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
