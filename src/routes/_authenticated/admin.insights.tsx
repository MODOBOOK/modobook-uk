import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  CalendarPlus,
  CreditCard,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Repeat,
} from "lucide-react";
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
  type ActivityEvent,
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

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function dayLabel(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const money = (n: number) => `£${n.toFixed(2)}`;

const EVENT_ICON: Record<ActivityEvent["kind"], { icon: typeof CalendarPlus; cls: string }> = {
  booking: { icon: CalendarPlus, cls: "bg-blue-100 text-blue-700" },
  payment: { icon: CreditCard, cls: "bg-emerald-100 text-emerald-700" },
  signup: { icon: UserPlus, cls: "bg-amber-100 text-amber-700" },
  membership: { icon: Repeat, cls: "bg-violet-100 text-violet-700" },
};

function InsightsPage() {
  const data = Route.useLoaderData() as {
    activity: ActivityEvent[];
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

      {/* Activity feed */}
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Sparkles className="h-4 w-4" /> Latest activity
      </h2>
      <Card>
        <CardContent className="divide-y p-0">
          {data.activity.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No activity in the last two weeks.</p>
          )}
          {data.activity.map((e, i) => {
            const meta = EVENT_ICON[e.kind];
            const Icon = meta.icon;
            return (
              <div key={`${e.kind}-${e.at}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.cls}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate">
                    {e.text}
                    <span className="text-muted-foreground"> · {e.clinic}</span>
                  </p>
                </div>
                {e.amount != null && e.amount > 0 && (
                  <span className="ml-auto shrink-0 font-medium">{money(e.amount)}</span>
                )}
                <span className={`shrink-0 text-xs text-muted-foreground ${e.amount != null && e.amount > 0 ? "" : "ml-auto"}`}>
                  {when(e.at)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
