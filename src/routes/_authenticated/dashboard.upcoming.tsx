import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { pilotFeaturesEnabled } from "@/lib/feature-flags";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MapPin,
  Pill,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  listUpcomingAppointments,
  generateAppointmentBrief,
  type UpcomingAppointment,
} from "@/lib/upcoming.functions";

export const Route = createFileRoute("/_authenticated/dashboard/upcoming")({
  ssr: false,
  beforeLoad: ({ context }) => {
    const slug = (context as { profile?: { slug?: string } })?.profile?.slug;
    if (!pilotFeaturesEnabled(slug)) throw redirect({ to: "/dashboard/coming-soon" });
  },
  component: UpcomingPage,
});

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const label = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  if (iso === today) return `Today · ${label}`;
  if (iso === tomorrow) return `Tomorrow · ${label}`;
  return label;
}

function money(pence: number) {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}

function UpcomingPage() {
  const fetchUpcoming = useServerFn(listUpcomingAppointments);
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<string>("all");
  const [practitioner, setPractitioner] = useState<string>("all");
  const [location, setLocation] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchUpcoming({ data: { days } })
      .then((d) => {
        if (alive) setRows(d as UpcomingAppointment[]);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load appointments"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days, fetchUpcoming]);

  const practitioners = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.practitioner_id && r.practitioner_name) m.set(r.practitioner_id, r.practitioner_name);
    return Array.from(m.entries());
  }, [rows]);

  const locations = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.location_id && r.location_name) m.set(r.location_id, r.location_name);
    return Array.from(m.entries());
  }, [rows]);

  const dayOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.scheduled_date))), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (day === "all" || r.scheduled_date === day) &&
          (practitioner === "all" || r.practitioner_id === practitioner) &&
          (location === "all" || r.location_id === location),
      ),
    [rows, day, practitioner, location],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, UpcomingAppointment[]>();
    for (const r of filtered) {
      if (!m.has(r.scheduled_date)) m.set(r.scheduled_date, []);
      m.get(r.scheduled_date)!.push(r);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const stats = useMemo(() => {
    const outstanding = filtered.filter(
      (r) => r.forms.medical_done < r.forms.medical_total || r.forms.consent_done < r.forms.consent_total,
    ).length;
    const flagged = filtered.filter((r) => r.has_allergies).length;
    const unpaid = filtered.filter((r) => (r.amount_paid_cents ?? 0) <= 0).length;
    return { total: filtered.length, outstanding, flagged, unpaid };
  }, [filtered]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="px-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Schedule</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Upcoming appointments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything booked in the next {days} days, with prep status at a glance.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Booked" value={String(stats.total)} />
        <SummaryTile label="Forms outstanding" value={String(stats.outstanding)} tone={stats.outstanding ? "warn" : undefined} />
        <SummaryTile label="Allergy flags" value={String(stats.flagged)} tone={stats.flagged ? "warn" : undefined} />
        <SummaryTile label="Nothing paid" value={String(stats.unpaid)} tone={stats.unpaid ? "warn" : undefined} />
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => {
                  setDays(r.days);
                  setDay("all");
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${days === r.days ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-9 rounded-full border border-border bg-background px-3 text-xs"
          >
            <option value="all">All days</option>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              </option>
            ))}
          </select>
          {practitioners.length > 0 && (
            <select
              value={practitioner}
              onChange={(e) => setPractitioner(e.target.value)}
              className="h-9 rounded-full border border-border bg-background px-3 text-xs"
            >
              <option value="all">All practitioners</option>
              {practitioners.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {locations.length > 0 && (
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 rounded-full border border-border bg-background px-3 text-xs"
            >
              <option value="all">All locations</option>
              {locations.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" size="sm" className="ml-auto rounded-full text-xs" asChild>
            <Link to="/dashboard/bookings">
              <CalendarDays className="mr-1.5 h-4 w-4" /> Calendar
            </Link>
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nothing booked in this window.</p>
            <Button asChild size="sm">
              <Link to="/dashboard/new-appointment">Create an appointment</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        grouped.map(([date, items]) => (
          <section key={date} className="space-y-3">
            <h2 className="px-1 text-sm font-semibold">
              {formatDay(date)} <span className="font-normal text-muted-foreground">· {items.length}</span>
            </h2>
            {items.map((a) => (
              <AppointmentCard key={a.id} appt={a} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <Card className={`border-border/60 ${tone === "warn" ? "border-destructive/40" : ""}`}>
      <CardContent className="p-4 text-center">
        <div className={`font-serif text-2xl leading-none ${tone === "warn" ? "text-destructive" : ""}`}>{value}</div>
        <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function AppointmentCard({ appt }: { appt: UpcomingAppointment }) {
  const runBrief = useServerFn(generateAppointmentBrief);
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const medsOutstanding = appt.forms.medical_total - appt.forms.medical_done;
  const consentOutstanding = appt.forms.consent_total - appt.forms.consent_done;
  const allDone =
    appt.forms.medical_total + appt.forms.consent_total > 0 && medsOutstanding === 0 && consentOutstanding === 0;
  const paid = appt.amount_paid_cents ?? 0;
  const totalPence = Math.round(Number(appt.total_amount ?? 0) * 100);

  async function generate() {
    setBusy(true);
    try {
      const r = await runBrief({ data: { appointment: appt } });
      setBrief(r.brief);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate brief");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden border-border/60">
      <div className="h-1 w-full" style={{ background: appt.treatment_color ?? "hsl(var(--primary))" }} />
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {appt.patient_name}
              <span className="ml-2 font-normal text-muted-foreground">
                {String(appt.start_time).slice(0, 5)}–{String(appt.end_time).slice(0, 5)}
              </span>
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {appt.treatment_name ?? "Treatment"}
              {appt.location_name ? ` · ${appt.location_name}` : ""}
              {appt.practitioner_name ? ` · ${appt.practitioner_name}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {appt.is_new_patient && <Badge variant="secondary">New patient</Badge>}
            <Badge variant={appt.status === "confirmed" ? "secondary" : "outline"} className="capitalize">
              {appt.status ?? "pending"}
            </Badge>
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5">
          {allDone && <Chip icon={CheckCircle2} tone="ok" label="All forms complete" />}
          {medsOutstanding > 0 && <Chip icon={ClipboardList} tone="warn" label={`${medsOutstanding} medical form${medsOutstanding > 1 ? "s" : ""} outstanding`} />}
          {consentOutstanding > 0 && <Chip icon={ClipboardList} tone="warn" label={`${consentOutstanding} consent outstanding`} />}
          {appt.forms.medical_total + appt.forms.consent_total === 0 && (
            <Chip icon={ClipboardList} tone="muted" label="No forms attached" />
          )}
          {appt.has_allergies && <Chip icon={AlertTriangle} tone="danger" label={appt.allergies ? `Allergy: ${appt.allergies}` : "Allergies flagged"} />}
          {appt.medications.length > 0 && <Chip icon={Pill} tone="muted" label={`${appt.medications.length} current medication${appt.medications.length > 1 ? "s" : ""}`} />}
          <Chip
            icon={Wallet}
            tone={paid > 0 ? "ok" : "warn"}
            label={
              totalPence > 0
                ? paid >= totalPence
                  ? `Paid in full ${money(totalPence)}`
                  : paid > 0
                    ? `${money(paid)} of ${money(totalPence)} paid`
                    : `${money(totalPence)} outstanding`
                : appt.payment_status ?? "No price set"
            }
          />
          {appt.last_visit ? (
            <Chip icon={User} tone="muted" label={`Last visit ${new Date(appt.last_visit.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`} />
          ) : null}
          {appt.location_name && <Chip icon={MapPin} tone="muted" label={appt.location_name} />}
        </div>

        {appt.concerns.length > 0 && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Concerns raised</p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {appt.concerns.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.label}</span>
                  {c.severity ? <span className="text-muted-foreground"> · {c.severity}</span> : null}
                  {c.notes ? <span className="text-muted-foreground"> — {c.notes}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {appt.notes && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Booking note:</span> {appt.notes}
          </p>
        )}

        {brief && (
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> AI brief
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{brief}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="secondary" className="rounded-full" onClick={generate} disabled={busy}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            {busy ? "Thinking…" : brief ? "Regenerate brief" : "Brief me"}
          </Button>
          {appt.client_id ? (
            <Button size="sm" variant="ghost" className="rounded-full" asChild>
              <Link to="/dashboard/patients/$id" params={{ id: appt.client_id }}>
                Patient record <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="rounded-full" asChild>
            <Link to="/dashboard/bookings">Open in calendar</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Chip({
  icon: Icon,
  label,
  tone = "muted",
}: {
  icon: React.ElementType;
  label: string;
  tone?: "ok" | "warn" | "danger" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
