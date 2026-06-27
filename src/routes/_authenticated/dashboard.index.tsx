import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  CreditCard,
  ExternalLink,
  Copy,
  CalendarPlus,
  FileText,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { listMyAppointments } from "@/lib/availability.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  ssr: false,
  component: DashboardIndex,
});

type Appt = Awaited<ReturnType<typeof listMyAppointments>>[number];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function DashboardIndex() {
  const { profile } = Route.useRouteContext() as { profile: { id: string; slug: string; clinic_name?: string | null; full_name?: string | null; avatar_url?: string | null; stripe_connect_account_id?: string | null } };
  const fetchAppointments = useServerFn(listMyAppointments);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/m/${profile.slug}`;

  useEffect(() => {
    (async () => {
      try {
        const d = (await fetchAppointments()) as Appt[];
        setAppts(d);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const { todays, upcoming, todayBookings, todayCancellations, weekCount } = useMemo(() => {
    const todays = appts.filter((a) => a.scheduled_date === today);
    const upcoming = appts
      .filter((a) => a.scheduled_date >= today && a.status !== "cancelled")
      .slice(0, 5);
    const todayBookings = todays.filter((a) => a.status !== "cancelled").length;
    const todayCancellations = todays.filter((a) => a.status === "cancelled").length;
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekIso = weekEnd.toISOString().slice(0, 10);
    const weekCount = appts.filter(
      (a) => a.scheduled_date >= today && a.scheduled_date <= weekIso && a.status !== "cancelled",
    ).length;
    return { todays, upcoming, todayBookings, todayCancellations, weekCount };
  }, [appts, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, Appt[]>();
    for (const a of upcoming) {
      if (!map.has(a.scheduled_date)) map.set(a.scheduled_date, []);
      map.get(a.scheduled_date)!.push(a);
    }
    return Array.from(map.entries());
  }, [upcoming]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Hero */}
      <Card className="overflow-hidden border-border/60 shadow-luxe">
        <CardContent className="relative p-6 sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/15 via-background to-background" />
          <div className="relative flex items-center gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-border sm:h-24 sm:w-24"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-border sm:h-24 sm:w-24">
                <span className="font-serif text-3xl">{(profile.clinic_name ?? "M").charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">{greeting()}</p>
              <h1 className="mt-1 truncate font-serif text-3xl leading-tight sm:text-4xl">
                {profile.clinic_name || profile.full_name || "Your clinic"}
              </h1>
              {profile.full_name && profile.clinic_name && (
                <p className="mt-1 truncate text-sm italic text-muted-foreground">{profile.full_name}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card className="border-border/60">
        <CardContent className="grid grid-cols-3 divide-x divide-border/60 p-0">
          <Stat label="Today" value={String(todayBookings)} />
          <Stat label="Cancelled" value={String(todayCancellations)} />
          <Stat label="Next 7 days" value={String(weekCount)} />
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction to="/dashboard/new-appointment" icon={CalendarPlus} label="New booking" />
        <QuickAction to="/dashboard/availability" icon={CalendarDays} label="Availability" />
        <QuickAction to="/dashboard/services" icon={Sparkles} label="Services" />
        <QuickAction to="/dashboard/payments" icon={CreditCard} label={profile.stripe_connect_account_id ? "Payments" : "Connect Stripe"} />
      </div>


      {/* Booking link */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your booking link</p>
            <p className="mt-1 truncate text-sm font-medium">{bookingUrl}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" /> Copy
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" asChild>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Open
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming appointments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold sm:text-lg">Upcoming appointments</h2>
          <Link to="/dashboard/bookings" className="text-sm font-medium text-primary">View all</Link>
        </div>

        {loading ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No upcoming bookings yet.</p>
              <Button asChild size="sm">
                <Link to="/dashboard/new-appointment">Create one</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          grouped.map(([date, items]) => (
            <div key={date} className="space-y-2">
              <h3 className="px-1 text-sm font-semibold">{formatDay(date)}</h3>
              {items.map((a) => (
                <Link
                  key={a.id}
                  to="/dashboard/bookings"
                  className="block rounded-2xl border-l-4 border-l-primary bg-muted/40 p-3 transition hover:bg-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {a.patient_name}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {String(a.start_time).slice(0, 5)}–{String(a.end_time).slice(0, 5)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {(a as Appt & { treatments?: { name?: string } | null }).treatments?.name ?? "Treatment"}
                        {(a as Appt & { locations?: { name?: string } | null }).locations?.name
                          ? ` · ${(a as Appt & { locations?: { name?: string } | null }).locations?.name}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={a.status === "cancelled" ? "destructive" : "secondary"} className="capitalize">
                        {a.status}
                      </Badge>
                      {a.total_amount != null && (
                        <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                          £{Number(a.total_amount).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm transition active:scale-[0.97]"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium leading-tight">{label}</span>
      <ChevronRight className="hidden" />
    </Link>
  );
}
