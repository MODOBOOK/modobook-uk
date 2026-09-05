import { createFileRoute, Link } from "@tanstack/react-router";

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ExternalLink,
  Copy,
  CalendarPlus,
  FileText,
  ChevronRight,
  Sparkles,
  Info,
  Stethoscope,
  Wallet,
} from "lucide-react";

import { listMyAppointments } from "@/lib/availability.functions";
import { getStripePayouts } from "@/lib/stripe.functions";
import { buildBookingUrl } from "@/lib/booking-url";
import { resolveDisplayNames } from "@/lib/display-name";
import { SetupChecklistCard } from "@/components/SetupChecklistCard";
import { upcomingEnabled } from "@/lib/feature-flags";
import { WhatsNewBanner } from "@/components/WhatsNewBanner";

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
  const { profile } = Route.useRouteContext() as { profile: { id: string; slug: string; clinic_name?: string | null; full_name?: string | null; display_name_mode?: string | null; avatar_url?: string | null; stripe_connect_account_id?: string | null } };
  const { primary: displayPrimary, secondary: displaySecondary } = resolveDisplayNames(profile);

  const fetchAppointments = useServerFn(listMyAppointments);
  const fetchPayouts = useServerFn(getStripePayouts);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Awaited<ReturnType<typeof getStripePayouts>> | null>(null);

  const bookingUrl = buildBookingUrl(profile.slug);

  useEffect(() => {
    (async () => {
      try {
        const d = (await fetchAppointments()) as Appt[];
        setAppts(d);
      } finally {
        setLoading(false);
      }
    })();
    if (profile.stripe_connect_account_id) {
      fetchPayouts().then(setPayouts).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const { todays, upcoming, todayBookings, todayCancellations, weekCount, monthBookings, salesToday, salesWeek, salesMonth, thisMonthName, nextMonthName, nextMonthBookings, nextMonthSales } = useMemo(() => {
    const todays = appts.filter((a) => a.scheduled_date === today);
    const upcoming = appts
      .filter((a) => a.scheduled_date >= today && a.status !== "cancelled")
      .slice(0, 5);
    const todayBookings = todays.filter((a) => a.status !== "cancelled").length;
    const todayCancellations = todays.filter((a) => a.status === "cancelled").length;
    const now = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekIso = weekEnd.toISOString().slice(0, 10);
    const weekCount = appts.filter(
      (a) => a.scheduled_date >= today && a.scheduled_date <= weekIso && a.status !== "cancelled",
    ).length;
    // Past windows for sales (counts confirmed/completed bookings — excludes cancelled)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    const weekStartIso = startOfWeek.toISOString().slice(0, 10);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    // Next calendar month bounds + names
    const nextStartOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    const nextEndOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);
    const thisMonthName = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString(undefined, { month: "long" });
    const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, { month: "long" });
    const amt = (a: Appt) => Number((a as Appt & { total_amount?: number | null }).total_amount ?? 0);
    const inRange = (a: Appt, from: string, to: string) =>
      a.status !== "cancelled" && a.scheduled_date >= from && a.scheduled_date <= to;
    const salesToday = appts.filter((a) => inRange(a, today, today)).reduce((s, a) => s + amt(a), 0);
    const salesWeek = appts.filter((a) => inRange(a, weekStartIso, today)).reduce((s, a) => s + amt(a), 0);
    const salesMonth = appts.filter((a) => inRange(a, startOfMonth, endOfMonth)).reduce((s, a) => s + amt(a), 0);
    const monthBookings = appts.filter((a) => inRange(a, startOfMonth, endOfMonth)).length;
    const nextMonthBookings = appts.filter((a) => inRange(a, nextStartOfMonth, nextEndOfMonth)).length;
    const nextMonthSales = appts.filter((a) => inRange(a, nextStartOfMonth, nextEndOfMonth)).reduce((s, a) => s + amt(a), 0);
    return { todays, upcoming, todayBookings, todayCancellations, weekCount, monthBookings, salesToday, salesWeek, salesMonth, thisMonthName, nextMonthName, nextMonthBookings, nextMonthSales };
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
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-8">
      {/* Hero */}
      <Card className="overflow-hidden border-border/60 shadow-luxe">
        <CardContent className="relative p-5 sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/15 via-background to-background" />
          <div className="relative flex items-center gap-4 sm:gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-border sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-border sm:h-20 sm:w-20">
                <span className="font-serif text-2xl sm:text-3xl">{(displayPrimary ?? "M").charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">{greeting()}</p>
              <h1
                className="mt-1 font-serif leading-tight break-words [overflow-wrap:anywhere] line-clamp-2"
                style={{ fontSize: "clamp(1.25rem, 5.5vw, 2.25rem)" }}
              >
                {displayPrimary}
              </h1>
              {displaySecondary && (
                <p className="mt-1 truncate text-xs italic text-muted-foreground sm:text-sm">{displaySecondary}</p>
              )}
            </div>
          </div>
          {/* Today snapshot — built into the hero */}
          <div className="relative mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
            <div className="rounded-2xl border border-border/50 bg-background/60 px-3 py-3 text-center backdrop-blur-sm">
              <div className="font-serif text-xl leading-none sm:text-2xl">{todayBookings}</div>
              <div className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground sm:text-[10px]">Today</div>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/60 px-3 py-3 text-center backdrop-blur-sm">
              <div className="font-serif text-xl leading-none sm:text-2xl">{weekCount}</div>
              <div className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground sm:text-[10px]">Next 7 days</div>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/60 px-3 py-3 text-center backdrop-blur-sm">
              <div className="font-serif text-xl leading-none sm:text-2xl">£{salesToday.toFixed(0)}</div>
              <div className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground sm:text-[10px]">Sales today</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <WhatsNewBanner slug={profile.slug} />

      <SetupChecklistCard />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction to="/dashboard/new-appointment" icon={CalendarPlus} label="New booking" />
        <QuickAction to="/dashboard/availability" icon={CalendarDays} label="Availability" />
        <QuickAction to="/dashboard/services" icon={Sparkles} label="Services" />
        <QuickAction to="/dashboard/pre-treatment" icon={Info} label="Pre-treatment" />
      </div>

      {/* Payments (compact) */}
      <Link to="/dashboard/payments" className="block">
        <Card className="border-border/60 transition hover:border-accent hover:shadow-luxe">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Wallet className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Payments</p>
              {payouts?.ok ? (
                <p className="mt-1 font-serif text-lg">
                  £{((payouts.pending?.gbp ?? 0) / 100).toFixed(2)} pending
                  <span className="ml-2 text-sm text-muted-foreground">
                    · £{((payouts.available?.gbp ?? 0) / 100).toFixed(2)} available
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile.stripe_connect_account_id ? "View balance and payouts" : "Connect Stripe to accept payments"}
                </p>
              )}
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>



      {/* Analytics */}
      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Analytics</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl">At a glance</h2>
          </div>
          <Link
            to="/dashboard/analytics"
            className="text-xs font-medium uppercase tracking-[0.2em] text-foreground underline-offset-4 hover:underline"
          >
            View more
          </Link>
        </div>
        <Link to="/dashboard/analytics" className="block">
          <Card className="overflow-hidden border-border/60 transition hover:border-accent hover:shadow-luxe">
            <CardContent className="p-0">
              {/* This month */}
              <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4">
                <Stat label={`Bookings in ${thisMonthName}`} value={String(monthBookings)} />
                <Stat label={`Sales in ${thisMonthName}`} value={`£${salesMonth.toFixed(0)}`} />
                <Stat label="Sales today" value={`£${salesToday.toFixed(0)}`} />
                <Stat label="Sales (7d)" value={`£${salesWeek.toFixed(0)}`} />
              </div>
              {/* Next month */}
              <div className="border-t border-border/60 bg-muted/20">
                <p className="px-4 pt-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Next month · {nextMonthName}
                </p>
                <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-3">
                  <Stat label={`Bookings in ${nextMonthName}`} value={String(nextMonthBookings)} />
                  <Stat label={`Sales in ${nextMonthName}`} value={`£${nextMonthSales.toFixed(0)}`} />
                  <Stat label="Avg. booking" value={nextMonthBookings ? `£${(nextMonthSales / nextMonthBookings).toFixed(0)}` : "—"} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>


      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction to="/dashboard/new-appointment" icon={CalendarPlus} label="New booking" />
        <QuickAction to="/dashboard/availability" icon={CalendarDays} label="Availability" />
        <QuickAction to="/dashboard/services" icon={Sparkles} label="Services" />
        <QuickAction to="/dashboard/pre-treatment" icon={Info} label="Pre-treatment" />
      </div>



      {/* Prescriber Hub — central, always visible */}
      <Link to="/hub" className="block">
        <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/10 via-background to-background transition hover:border-primary hover:shadow-luxe">
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Stethoscope className="size-7" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-primary">Prescriber Hub</p>
              <h3 className="font-serif text-lg sm:text-xl">Connect with a prescriber</h3>
              <p className="text-sm text-muted-foreground">
                Flag services that need prescriber sign-off, manage referrals, and share patient records securely with the medics you work with.
              </p>
            </div>
            <ChevronRight className="hidden size-5 text-muted-foreground sm:block" />
          </CardContent>
        </Card>
      </Link>



      {/* Booking link */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Your booking link</p>
            <p className="mt-2 truncate font-serif text-lg">{bookingUrl}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-full sm:flex-none"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" /> Copy
            </Button>
            <Button size="sm" className="flex-1 rounded-full sm:flex-none" asChild>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Open
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming appointments */}
      <section className="space-y-4">
        <div className="flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Schedule</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl">Upcoming appointments</h2>
          </div>
          {upcomingEnabled(profile.slug) ? (
            <Link to="/dashboard/upcoming" className="text-xs font-medium uppercase tracking-[0.2em] text-foreground underline-offset-4 hover:underline">View all</Link>
          ) : (
            <Link
              to="/dashboard/coming-soon"
              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-foreground transition hover:bg-primary/10"
            >
              View all
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary">Soon</span>
            </Link>
          )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-5 text-center">
      <div className="font-serif text-3xl leading-none">{value}</div>
      <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-5 text-center transition hover:border-accent hover:shadow-luxe active:scale-[0.98]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition group-hover:bg-accent group-hover:text-accent-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium tracking-wide">{label}</span>
      <ChevronRight className="hidden" />
    </Link>
  );
}

