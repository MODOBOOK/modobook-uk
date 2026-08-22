import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLinkFee } from "@/lib/use-link-fee";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  AlertTriangle,
  X,
  Plus,
  Link2,
  Ban,
  CircleCheck,
  CalendarDays,
  Copy,
  Trash2,
  Mail,
  Percent,
  Undo2,
  CalendarClock,
} from "lucide-react";
import { RescheduleAppointmentDialog } from "@/components/RescheduleAppointmentDialog";
import {
  listMyAppointments,
  updateAppointmentNotes,
  cancelAppointment,
  updateAppointmentAftercareAndAllergy,
  listBlockedTimes,
  addBlockedTime,
  deleteBlockedTime,
  addAvailabilityOverride,
  listAvailabilityRules,
  listAvailabilityOverrides,
  listBlockedDates,
  getRotaSettings,
} from "@/lib/availability.functions";
import { ruleAppliesOnDate } from "@/lib/rota";
import {
  createPaymentLink,
  emailPaymentLink,
  completeAppointmentCheckout,
} from "@/lib/payment-links.functions";
import { refundAppointment } from "@/lib/stripe.functions";
import { listMyLocations } from "@/lib/locations.functions";
import {
  getOrCreateClientForAppointment,
  markAppointmentNoShow,
  setClientBlocked,
} from "@/lib/patient-actions.functions";
import { getCardOnFileForAppointment, chargeCardOnFile } from "@/lib/card-on-file.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/bookings")({
  ssr: false,
  component: BookingsPage,
});

type Appt = {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_amount: number | null;
  amount_paid_cents: number | null;
  amount_refunded_cents: number | null;
  checkout_discount_cents?: number | null;
  stripe_payment_intent_id: string | null;


  notes: string | null;
  practitioner_notes: string | null;
  aftercare_html: string | null;
  has_allergies: boolean | null;
  allergies_text: string | null;
  treatments: { name: string; color?: string | null } | null;
  locations: { name: string } | null;
  location_id?: string | null;
};

type BlockedTime = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  location_id: string | null;
};

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

type ViewMode = "day" | "3day" | "week" | "month";
type AvailRule = { day_of_week: number; start_time: string; end_time: string; location_id?: string | null; cycle_length?: number; weeks_mask?: number };
type Override = { date: string; start_time: string; end_time: string; location_id: string | null };
type BlockedDate = { date: string; location_id: string | null };

function startOfWeek(d: Date) {
  const c = new Date(d);
  const day = c.getDay();
  const diff = (day + 6) % 7; // Monday start
  c.setDate(c.getDate() - diff);
  c.setHours(0, 0, 0, 0);
  return c;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function parseTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}
/**
 * Google-Calendar style overlap layout: events that share time sit side by side
 * instead of stacking on top of each other.
 */
function layoutOverlaps<T extends { start_time: string; end_time: string }>(
  items: T[],
): { item: T; leftPct: number; widthPct: number; index: number; columns: number }[] {
  const evts = items
    .map((item) => {
      const s = parseTime(item.start_time);
      let e = parseTime(item.end_time);
      if (!(e > s)) e = s + 0.25;
      return { item, s, e: Math.max(e, s + 0.25) };
    })
    .sort((a, b) => a.s - b.s || a.e - b.e);

  const out: { item: T; leftPct: number; widthPct: number; index: number; columns: number }[] = [];
  let group: typeof evts = [];
  let groupEnd = -Infinity;

  const flush = () => {
    if (!group.length) return;
    const colEnds: number[] = [];
    const placed = group.map((g) => {
      let col = colEnds.findIndex((end) => end <= g.s + 1e-9);
      if (col === -1) { col = colEnds.length; colEnds.push(g.e); } else { colEnds[col] = g.e; }
      return { ...g, col };
    });
    const columns = colEnds.length;
    for (const p of placed) {
      out.push({
        item: p.item,
        leftPct: (p.col / columns) * 100,
        widthPct: 100 / columns,
        index: p.col,
        columns,
      });
    }
    group = [];
    groupEnd = -Infinity;
  };

  for (const e of evts) {
    if (group.length && e.s >= groupEnd - 1e-9) flush();
    group.push(e);
    groupEnd = Math.max(groupEnd, e.e);
  }
  flush();
  return out;
}
function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function BookingsPage() {
  const list = useServerFn(listMyAppointments);
  const listBlocks = useServerFn(listBlockedTimes);
  const listRules = useServerFn(listAvailabilityRules);
  const listOverrides = useServerFn(listAvailabilityOverrides);
  const listBlockedDatesFn = useServerFn(listBlockedDates);
  const getRota = useServerFn(getRotaSettings);
  const listLocations = useServerFn(listMyLocations);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [blocks, setBlocks] = useState<BlockedTime[]>([]);
  const [rules, setRules] = useState<AvailRule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [rotaAnchor, setRotaAnchor] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "3day" : "week"
  );
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null);
  const [showPayLink, setShowPayLink] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [showUnblock, setShowUnblock] = useState(false);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const [a, b, r, o, bd, l, rota] = await Promise.all([list(), listBlocks(), listRules(), listOverrides(), listBlockedDatesFn(), listLocations(), getRota()]);
    setAppts(a as Appt[]);
    setBlocks(b as BlockedTime[]);
    setRules((r as AvailRule[]) ?? []);
    setOverrides((o as Override[]) ?? []);
    setBlockedDates((bd as BlockedDate[]) ?? []);
    setLocations(((l as any[]) ?? []).map((x) => ({ id: x.id, name: x.name })));
    setRotaAnchor((rota as { rota_anchor_date?: string | null } | null)?.rota_anchor_date ?? null);
  }



  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!loading && scrollRef.current && view !== "month") {
      const targetHour = Math.max(START_HOUR, Math.min(END_HOUR, now.getHours() - 1));
      scrollRef.current.scrollTop = (targetHour - START_HOUR) * HOUR_HEIGHT;
    }
  }, [loading, view]);

  const daysVisible = view === "day" ? 1 : view === "3day" ? 3 : view === "week" ? 7 : 0;

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "3day") return Array.from({ length: 3 }, (_, i) => addDays(anchor, i));
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [];
  }, [anchor, view]);

  const filteredAppts = useMemo(
    () => (locationFilter === "all" ? appts : appts.filter((a) => (a.location_id ?? null) === locationFilter)),
    [appts, locationFilter]
  );
  const filteredBlocks = useMemo(
    () => (locationFilter === "all" ? blocks : blocks.filter((b) => (b.location_id ?? null) === locationFilter || b.location_id == null)),
    [blocks, locationFilter]
  );

  const apptsByDate = useMemo(() => {
    const m = new Map<string, Appt[]>();
    for (const a of filteredAppts) {
      if (a.status === "cancelled") continue;
      (m.get(a.scheduled_date) ?? m.set(a.scheduled_date, []).get(a.scheduled_date)!).push(a);
    }
    return m;
  }, [filteredAppts]);

  const blocksByDate = useMemo(() => {
    const m = new Map<string, BlockedTime[]>();
    for (const b of filteredBlocks) {
      (m.get(b.date) ?? m.set(b.date, []).get(b.date)!).push(b);
    }
    return m;
  }, [filteredBlocks]);

  const rulesByDow = useMemo(() => {
    const m = new Map<number, AvailRule[]>();
    for (const r of rules) {
      (m.get(r.day_of_week) ?? m.set(r.day_of_week, []).get(r.day_of_week)!).push(r);
    }
    return m;
  }, [rules]);

  /** Returns greyed-out segments [topPx, heightPx] for hours with no availability. */
  function unavailableSegments(d: Date): { top: number; height: number }[] {
    const dow = d.getDay();
    const iso = ymd(d);
    // Whole-day blocks (respect location filter: block applies if unscoped or matches)
    const isBlockedDay = blockedDates.some(
      (bd) =>
        bd.date === iso &&
        (locationFilter === "all" || bd.location_id == null || bd.location_id === locationFilter)
    );
    if (isBlockedDay) {
      return [{ top: 0, height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT }];
    }
    const dayRules = (rulesByDow.get(dow) ?? []).filter(
      (r) =>
        (locationFilter === "all" || r.location_id == null || r.location_id === locationFilter) &&
        ruleAppliesOnDate(r as unknown as { cycle_length?: number; weeks_mask?: number; effective_from?: string | null; effective_to?: string | null }, iso, rotaAnchor),
    );
    const dayOverrides = overrides.filter(
      (o) =>
        o.date === iso &&
        (locationFilter === "all" || o.location_id == null || o.location_id === locationFilter),
    );
    const windows: [number, number][] = [
      ...dayRules.map((r) => [parseTime(r.start_time), parseTime(r.end_time)] as [number, number]),
      ...dayOverrides.map((o) => [parseTime(o.start_time), parseTime(o.end_time)] as [number, number]),
    ].sort((a, b) => a[0] - b[0]);
    if (windows.length === 0) {
      return [{ top: 0, height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT }];
    }
    // merge overlapping
    const merged: [number, number][] = [];
    for (const w of windows) {
      const last = merged[merged.length - 1];
      if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
      else merged.push([w[0], w[1]]);
    }
    // Subtract blocked_times windows (whole-day blocks handled above)
    const dayBlockWindows = (blocksByDate.get(iso) ?? [])
      .filter((b) => locationFilter === "all" || b.location_id == null || b.location_id === locationFilter)
      .map((b) => [parseTime(b.start_time), parseTime(b.end_time)] as [number, number]);
    let available: [number, number][] = merged;
    for (const [bs, be] of dayBlockWindows) {
      const next: [number, number][] = [];
      for (const [s, e] of available) {
        if (be <= s || bs >= e) { next.push([s, e]); continue; }
        if (bs > s) next.push([s, bs]);
        if (be < e) next.push([be, e]);
      }
      available = next;
    }
    const segs: { top: number; height: number }[] = [];
    let cursor = START_HOUR;
    for (const [s, e] of available) {
      const segStart = Math.max(cursor, START_HOUR);
      const segEnd = Math.min(s, END_HOUR + 1);
      if (segEnd > segStart) {
        segs.push({
          top: (segStart - START_HOUR) * HOUR_HEIGHT,
          height: (segEnd - segStart) * HOUR_HEIGHT,
        });
      }
      cursor = Math.max(cursor, e);
    }
    if (cursor < END_HOUR + 1) {
      segs.push({
        top: (cursor - START_HOUR) * HOUR_HEIGHT,
        height: (END_HOUR + 1 - cursor) * HOUR_HEIGHT,
      });
    }
    return segs;
  }


  function navPrev() {
    if (view === "day") setAnchor(addDays(anchor, -1));
    else if (view === "3day") setAnchor(addDays(anchor, -3));
    else if (view === "week") setAnchor(addDays(anchor, -7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  }
  function navNext() {
    if (view === "day") setAnchor(addDays(anchor, 1));
    else if (view === "3day") setAnchor(addDays(anchor, 3));
    else if (view === "week") setAnchor(addDays(anchor, 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
  }

  const todayStr = ymd(now);
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;
  const headerLabel =
    view === "day"
      ? anchor.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : view === "3day"
      ? (() => {
          const e = addDays(anchor, 2);
          const sameMonth = anchor.getMonth() === e.getMonth();
          return sameMonth
            ? `${anchor.getDate()}–${e.getDate()} ${e.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
            : `${anchor.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${e.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
        })()
      : view === "week"
      ? (() => {
          const s = startOfWeek(anchor);
          const e = addDays(s, 6);
          return `${s.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${e.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
        })()
      : anchor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full min-w-0 items-center gap-1 sm:w-auto sm:gap-2">
          <Button variant="outline" size="icon" className="shrink-0" onClick={navPrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-1 font-semibold text-[15px] sm:min-w-[180px] sm:flex-none sm:text-lg">
            <CalendarDays className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
            <span className="truncate">{headerLabel}</span>
          </div>
          <Button variant="outline" size="icon" className="shrink-0" onClick={navNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => setAnchor(new Date())}>Today</Button>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">

          <div className="inline-flex rounded-full bg-muted p-0.5 text-xs">
            {([
              { v: "day" as ViewMode, label: "1" },
              { v: "3day" as ViewMode, label: "3" },
              { v: "week" as ViewMode, label: "Week" },
              { v: "month" as ViewMode, label: "Month" },
            ]).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 transition ${
                  view === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Button size="icon" onClick={() => setActionsOpen((v) => !v)} aria-label="Calendar actions">
              <Plus className="h-5 w-5" />
            </Button>
            {actionsOpen && (
              <>
                <button className="fixed inset-0 z-30" onClick={() => setActionsOpen(false)} aria-label="Close menu" />
                <div className="absolute right-0 top-12 z-40 flex w-60 flex-col gap-2">
                  <Link to="/dashboard/new-appointment" onClick={() => setActionsOpen(false)}>
                    <Button className="w-full justify-start gap-2 rounded-full bg-orange-200 text-orange-950 hover:bg-orange-300">
                      <CalendarDays className="h-4 w-4" /> New Appointment
                    </Button>
                  </Link>
                  <Button
                    onClick={() => { setActionsOpen(false); setShowPayLink(true); }}
                    className="w-full justify-start gap-2 rounded-full bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <Link2 className="h-4 w-4" /> Payment Link
                  </Button>
                  <Button
                    onClick={() => { setActionsOpen(false); setShowBlock(true); }}
                    className="w-full justify-start gap-2 rounded-full bg-rose-300 text-rose-950 hover:bg-rose-400"
                  >
                    <Ban className="h-4 w-4" /> Block a Time
                  </Button>
                  <Button
                    onClick={() => { setActionsOpen(false); setShowUnblock(true); }}
                    className="w-full justify-start gap-2 rounded-full bg-emerald-300 text-emerald-950 hover:bg-emerald-400"
                  >
                    <CircleCheck className="h-4 w-4" /> Open up appointments
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {locations.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setLocationFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              locationFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            All locations
          </button>
          {locations.map((l) => (
            <button
              key={l.id}
              onClick={() => setLocationFilter(l.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                locationFilter === l.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {loading
          ? "Loading…"
          : `${filteredAppts.filter((a) => a.status !== "cancelled").length} bookings · ${filteredBlocks.length} blocked${
              locationFilter !== "all" ? ` · ${locations.find((l) => l.id === locationFilter)?.name ?? ""}` : ""
            }`}
      </p>

      {view === "month" ? (
        <MonthView
          anchor={anchor}
          apptsByDate={apptsByDate}
          blocksByDate={blocksByDate}
          rulesByDow={rulesByDow}
          blockedDates={blockedDates}
          overrides={overrides}
          rotaAnchor={rotaAnchor}
          locationFilter={locationFilter}
          todayStr={todayStr}
          onPickDay={(d) => { setAnchor(d); setView("day"); }}
        />

      ) : (
        <Card className="overflow-hidden" style={{ ["--gutter" as any]: "44px" }}>
          <div
            className="sticky top-0 z-20 grid border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            style={{ gridTemplateColumns: `var(--gutter) repeat(${daysVisible}, 1fr)` }}
          >
            <div />
            {days.map((d) => {
              const isToday = ymd(d) === todayStr;
              return (
                <div key={ymd(d)} className={`flex flex-col items-center py-2 ${isToday ? "text-primary" : ""}`}>
                  <span className="text-[10px] uppercase tracking-wide">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          <div ref={scrollRef} className="relative max-h-[75vh] overflow-y-auto">
            <div className="grid relative" style={{ gridTemplateColumns: `var(--gutter) repeat(${daysVisible}, 1fr)`, height: totalHeight }}>
              <div className="relative border-r">
                {HOURS.map((h) => (
                  <div key={h} className="absolute left-0 right-0 pr-1 text-right text-[10px] text-muted-foreground"
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 6 }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {days.map((d) => {
                const key = ymd(d);
                const isToday = key === todayStr;
                const dayAppts = apptsByDate.get(key) ?? [];
                const dayBlocks = blocksByDate.get(key) ?? [];
                const unavail = unavailableSegments(d);
                return (
                  <div key={key} className="relative border-r last:border-r-0">
                    {/* Grey-out: outside availability */}
                    {unavail.map((s, i) => (
                      <div
                        key={`u-${i}`}
                        className="absolute left-0 right-0 bg-muted/60 pointer-events-none"
                        style={{ top: s.top, height: s.height, backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, rgba(0,0,0,0.04) 6px 12px)" }}
                        title="No availability"
                      />
                    ))}
                    {HOURS.map((h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-dashed border-muted"
                        style={{ top: (h - START_HOUR) * HOUR_HEIGHT }} />
                    ))}
                    {isToday && (() => {
                      const hr = now.getHours() + now.getMinutes() / 60;
                      if (hr < START_HOUR || hr > END_HOUR + 1) return null;
                      const top = (hr - START_HOUR) * HOUR_HEIGHT;
                      return (
                        <>
                          <div className="absolute left-0 right-0 z-10 h-px bg-red-500" style={{ top }} />
                          <div className="absolute z-10 -translate-y-1/2 rounded-full border border-red-500 bg-background px-1 text-[10px] font-semibold text-red-500"
                            style={{ top, left: 2 }}>
                            {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
                          </div>
                        </>
                      );
                    })()}

                    {/* Blocked times (black) */}
                    {dayBlocks.map((b) => {
                      const start = parseTime(b.start_time);
                      const end = parseTime(b.end_time);
                      const top = (start - START_HOUR) * HOUR_HEIGHT;
                      const height = Math.max(22, (end - start) * HOUR_HEIGHT - 2);
                      return (
                        <button
                          key={b.id}
                          onClick={async () => {
                            if (!confirm(`Unblock ${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}?`)) return;
                            try {
                              await deleteBlockedTime({ data: { id: b.id } });
                              setBlocks((p) => p.filter((x) => x.id !== b.id));
                              toast.success("Unblocked — time now open");
                            } catch (e) { toast.error((e as Error).message); }
                          }}
                          className="absolute left-1 right-1 z-[4] overflow-hidden rounded-md bg-slate-900 px-2 py-1 text-left text-[11px] text-white shadow-sm"
                          style={{ top, height }}
                          title="Tap to open this slot"
                        >
                          <div className="truncate font-semibold flex items-center gap-1"><Ban className="h-3 w-3" /> Blocked</div>
                          <div className="truncate opacity-80">{b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}{b.reason ? ` · ${b.reason}` : ""}</div>
                        </button>
                      );
                    })}

                    {/* Appointments — overlapping ones sit side by side */}
                    {layoutOverlaps(dayAppts).map(({ item: a, leftPct, widthPct, index, columns }) => {
                      const start = parseTime(a.start_time);
                      const end = parseTime(a.end_time);
                      const top = (start - START_HOUR) * HOUR_HEIGHT;
                      const height = Math.max(22, (end - start) * HOUR_HEIGHT - 2);
                      const color = a.treatments?.color || "#3b82f6";
                      const compact = columns > 1;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAppt(a)}
                          className={`absolute overflow-hidden rounded-md border border-background border-l-4 text-left text-[11px] shadow-sm transition hover:z-20 hover:shadow-md ${compact ? "px-1 py-0.5" : "px-2 py-1"}`}
                          style={{
                            top,
                            height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            zIndex: 5 + index,
                            borderLeftColor: color,
                            backgroundColor: hexToRgba(color, 0.18),
                            color: "var(--foreground)",
                          }}
                          title={`${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)} · ${a.patient_name} · ${a.treatments?.name ?? "Treatment"}`}
                        >
                          <div className="truncate font-semibold">{a.patient_name}</div>
                          <div className="truncate opacity-80">
                            {a.start_time.slice(0, 5)}{compact ? "" : ` · ${a.treatments?.name ?? "Treatment"}`}
                          </div>
                          {a.has_allergies && !compact && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-red-600">
                              <AlertTriangle className="h-2.5 w-2.5" /> Allergies
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Appointment Checkout sheet */}
      <Dialog open={!!selectedAppt} onOpenChange={(o) => !o && setSelectedAppt(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment checkout</DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <CheckoutSheet
              a={selectedAppt}
              onPatch={(patch) => {
                setAppts((prev) => prev.map((x) => (x.id === selectedAppt.id ? { ...x, ...patch } : x)));
                setSelectedAppt((s) => (s ? { ...s, ...patch } : s));
              }}
              onClose={() => setSelectedAppt(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <PaymentLinkDialog open={showPayLink} onOpenChange={setShowPayLink} />
      <BlockTimeDialog
        open={showBlock}
        onOpenChange={setShowBlock}
        onAdded={(b) => setBlocks((p) => [...p, b])}
      />
      <UnblockDialog
        open={showUnblock}
        onOpenChange={setShowUnblock}
        blocks={blocks}
        onRemoved={(id) => setBlocks((p) => p.filter((b) => b.id !== id))}
        onOpened={refresh}
      />
    </div>
  );
}

/* -------------------------------- Month view ------------------------------- */

function MonthView({
  anchor,
  apptsByDate,
  blocksByDate,
  rulesByDow,
  blockedDates,
  overrides,
  rotaAnchor,
  locationFilter,
  todayStr,
  onPickDay,
}: {
  anchor: Date;
  apptsByDate: Map<string, Appt[]>;
  blocksByDate: Map<string, BlockedTime[]>;
  rulesByDow: Map<number, AvailRule[]>;
  blockedDates: BlockedDate[];
  overrides: Override[];
  rotaAnchor: string | null;
  locationFilter: string;
  todayStr: string;
  onPickDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] uppercase">
        {weekdayLabels.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-muted-foreground">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === monthStart.getMonth();
          const dayAppts = apptsByDate.get(key) ?? [];
          const dayBlocks = blocksByDate.get(key) ?? [];
          const matchLoc = (locId: string | null | undefined) =>
            locationFilter === "all" || locId == null || locId === locationFilter;
          const activeRules = (rulesByDow.get(d.getDay()) ?? []).filter(
            (r) => matchLoc(r.location_id) && ruleAppliesOnDate(r as unknown as { cycle_length?: number; weeks_mask?: number; effective_from?: string | null; effective_to?: string | null }, key, rotaAnchor),
          );
          const hasOverride = overrides.some((o) => o.date === key && matchLoc(o.location_id));
          const hasAvail = activeRules.length > 0 || hasOverride;
          const isPast = key < todayStr;
          const isBlockedDay = blockedDates.some((bd) => bd.date === key && matchLoc(bd.location_id));
          const fullyBlocked = isBlockedDay || dayBlocks.some(
            (b: any) => matchLoc(b.location_id) && (!b.start_time || (b.start_time <= "00:00" && b.end_time >= "23:59")),
          );
          const unavailable = !hasAvail || fullyBlocked || isPast;

          const isToday = key === todayStr;
          let title = "";
          if (isPast) title = "Past date";
          else if (fullyBlocked) title = "Blocked";
          else if (!hasAvail) title = "No availability";
          return (
            <button
              key={key}
              onClick={() => onPickDay(d)}
              disabled={isPast}
              className={`relative min-h-[88px] border-b border-r p-1.5 text-left transition hover:bg-accent/40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                !inMonth ? "bg-muted/20 text-muted-foreground" : ""
              } ${unavailable && inMonth ? "bg-muted/50 text-muted-foreground" : ""} ${
                isPast ? "opacity-60" : ""
              }`}
              style={
                unavailable && inMonth
                  ? {
                      backgroundImage:
                        "repeating-linear-gradient(135deg, rgba(0,0,0,0.04) 0 6px, transparent 6px 12px)",
                    }
                  : undefined
              }
              title={title}
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}>{d.getDate()}</span>
                {dayAppts.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {dayAppts.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => {
                  const color = a.treatments?.color || "#3b82f6";
                  return (
                    <div
                      key={a.id}
                      className="truncate rounded px-1 py-0.5 text-[10px]"
                      style={{ backgroundColor: hexToRgba(color, 0.18), borderLeft: `2px solid ${color}` }}
                    >
                      {a.start_time.slice(0, 5)} {a.patient_name}
                    </div>
                  );
                })}
                {dayAppts.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{dayAppts.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------ Sub dialogs ------------------------------ */

function PaymentLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useServerFn(createPaymentLink);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [includeFees, setIncludeFees] = useState(true);
  const [feeCents, setFeeCents] = useState(0);
  const previewFee = useLinkFee(Math.round(parseFloat(amount || "0") * 100), includeFees);

  async function submit() {
    setBusy(true);
    try {
      const cents = Math.round(parseFloat(amount || "0") * 100);
      if (cents < 100) throw new Error("Minimum £1.00");
      const row = await create({
        data: {
          amountCents: cents,
          description: desc || "Payment",
          kind: "adhoc",
          recipientEmail: email || null,
          includeFees,
        },
      });
      const u = (row as { stripe_url: string | null }).stripe_url;
      setUrl(u);
      setFeeCents(Number((row as { surcharge_cents?: number }).surcharge_cents ?? 0));
      if (u && navigator.clipboard) await navigator.clipboard.writeText(u);
      toast.success("Stripe payment link created — copied to clipboard");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  function close() {
    setAmount(""); setDesc(""); setEmail(""); setUrl(null); setIncludeFees(true); setFeeCents(0);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Stripe payment link</DialogTitle></DialogHeader>
        {!url ? (
          <div className="space-y-3">
            <div>
              <Label>Amount (£)</Label>
              <Input type="number" inputMode="decimal" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this charge for?" />
            </div>
            <div>
              <Label>Send to (optional email)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="patient@example.com" />
            </div>
            <label className="flex items-start gap-2 rounded-md border p-2.5">
              <Checkbox checked={includeFees} onCheckedChange={(v) => setIncludeFees(v === true)} className="mt-0.5" />
              <span className="text-xs">
                <span className="block font-medium">Add platform &amp; processing fees</span>
                <span className="text-muted-foreground">
                  {includeFees && previewFee > 0
                    ? `Adds £${(previewFee / 100).toFixed(2)} — patient pays £${(parseFloat(amount || "0") + previewFee / 100).toFixed(2)}.`
                    : "Adds your card processing surcharge on top. Untick to absorb it yourself."}
                </span>
              </span>
            </label>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create link"}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Payment link is ready. Already copied to your clipboard.</p>
            {feeCents > 0 && (
              <p className="text-xs text-muted-foreground">Includes £{(feeCents / 100).toFixed(2)} platform &amp; processing fees.</p>
            )}
            <Input readOnly value={url} className="text-xs" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              {email && (
                <a className="flex-1" href={`mailto:${email}?subject=${encodeURIComponent("Payment link")}&body=${encodeURIComponent(url)}`}>
                  <Button variant="outline" className="w-full"><Mail className="h-4 w-4 mr-1" /> Email</Button>
                </a>
              )}
              <Button asChild className="flex-1"><a href={url} target="_blank" rel="noreferrer">Open</a></Button>
            </div>
            <DialogFooter><Button onClick={close}>Done</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BlockTimeDialog({
  open, onOpenChange, onAdded,
}: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: (b: BlockedTime) => void }) {
  const add = useServerFn(addBlockedTime);
  const [date, setDate] = useState(ymd(new Date()));
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const s = allDay ? "00:00" : startTime;
      const e = allDay ? "23:59" : endTime;
      const days: string[] = [];
      const d0 = new Date(date + "T00:00:00");
      const d1 = endDate ? new Date(endDate + "T00:00:00") : d0;
      for (let cur = new Date(d0); cur <= d1; cur.setDate(cur.getDate() + 1)) {
        days.push(ymd(cur));
      }
      for (const day of days) {
        const row = await add({
          data: { date: day, start_time: s + ":00", end_time: e + ":00", reason: reason || null },
        });
        onAdded(row as BlockedTime);
      }
      toast.success(`Blocked ${days.length} ${days.length === 1 ? "slot" : "days"}`);
      onOpenChange(false);
      setReason("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Block out time</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} />
            <span>Block full day(s)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>End date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lunch, training, etc." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Block time"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UnblockDialog({
  open, onOpenChange, blocks, onRemoved, onOpened,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  blocks: BlockedTime[]; onRemoved: (id: string) => void;
  onOpened?: () => void | Promise<void>;
}) {
  const del = useServerFn(deleteBlockedTime);
  const addOverride = useServerFn(addAvailabilityOverride);
  const todayIso = ymd(new Date());

  const [tab, setTab] = useState<"new" | "blocked">("new");
  const [dates, setDates] = useState<string[]>([todayIso]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [interval, setInterval] = useState(30);
  const [busy, setBusy] = useState(false);

  const upcoming = blocks
    .filter((b) => b.date >= todayIso)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));

  function addDate() { setDates((d) => [...d, todayIso]); }
  function setDate(i: number, v: string) { setDates((d) => d.map((x, idx) => (idx === i ? v : x))); }
  function removeDate(i: number) { setDates((d) => d.filter((_, idx) => idx !== i)); }

  async function openSlots() {
    if (!dates.length) return toast.error("Add at least one date");
    if (!start || !end || start >= end) return toast.error("Pick a valid start/end time");
    setBusy(true);
    try {
      for (const date of dates) {
        await addOverride({ data: { date, start_time: start, end_time: end, slot_interval: interval } });
      }
      toast.success(`Opened ${dates.length} day${dates.length === 1 ? "" : "s"} · ${start}–${end}`);
      await onOpened?.();
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try {
      await del({ data: { id } });
      onRemoved(id);
      toast.success("Time opened back up");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Open up appointments</DialogTitle></DialogHeader>

        <div className="mb-3 flex rounded-full bg-muted p-1 text-sm">
          <button type="button" onClick={() => setTab("new")} className={`flex-1 rounded-full px-3 py-1.5 ${tab === "new" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>Add slots</button>
          <button type="button" onClick={() => setTab("blocked")} className={`flex-1 rounded-full px-3 py-1.5 ${tab === "blocked" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>Unblock ({upcoming.length})</button>
        </div>

        {tab === "new" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Quickly open extra availability for the booking page on specific dates and times.</p>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dates</Label>
              {dates.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input type="date" value={d} min={todayIso} onChange={(e) => setDate(i, e.target.value)} />
                  {dates.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeDate(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addDate} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add another date
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">End</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Slot interval (minutes)</Label>
              <select
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={openSlots} disabled={busy} className="gap-1">
                <CircleCheck className="h-4 w-4" /> {busy ? "Opening…" : "Open slots"}
              </Button>
            </DialogFooter>
          </div>
        ) : upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No upcoming blocked times.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-2 text-sm">
                <div>
                  <div className="font-semibold">{b.date}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}{b.reason ? ` · ${b.reason}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => remove(b.id)}>
                  <CircleCheck className="h-4 w-4 mr-1" /> Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Checkout sheet ------------------------------ */

function CheckoutSheet({
  a, onPatch, onClose,
}: { a: Appt; onPatch: (p: Partial<Appt>) => void; onClose: () => void }) {
  const update = useServerFn(updateAppointmentNotes);
  const cancel = useServerFn(cancelAppointment);
  const updateAfter = useServerFn(updateAppointmentAftercareAndAllergy);
  const checkout = useServerFn(completeAppointmentCheckout);
  const createLink = useServerFn(createPaymentLink);
  const emailLink = useServerFn(emailPaymentLink);
  const getOrCreateClient = useServerFn(getOrCreateClientForAppointment);
  const markNoShow = useServerFn(markAppointmentNoShow);
  const blockClient = useServerFn(setClientBlocked);
  const refund = useServerFn(refundAppointment);
  const loadCard = useServerFn(getCardOnFileForAppointment);
  const chargeCard = useServerFn(chargeCardOnFile);
  const navigate = useNavigate();

  const [card, setCard] = useState<{ clientId: string; hasCard: boolean; brand: string | null; last4: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCard({ data: { appointmentId: a.id } })
      .then((r) => { if (!cancelled) setCard(r as never); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [a.id, loadCard]);

  const [notes, setNotes] = useState(a.practitioner_notes ?? "");
  const [aftercare, setAftercare] = useState(a.aftercare_html ?? "");
  const [hasAllergies, setHasAllergies] = useState(!!a.has_allergies);
  const [allergiesText, setAllergiesText] = useState(a.allergies_text ?? "");
  const [discount, setDiscount] = useState("");
  const [discountKind, setDiscountKind] = useState<"percent" | "amount">("percent");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [addFeesToLink, setAddFeesToLink] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const cancelled = a.status === "cancelled";
  const isNoShow = a.status === "no_show";
  const color = a.treatments?.color || "#3b82f6";

  const subtotal = Number(a.total_amount ?? 0);
  const discountValue = (() => {
    const n = parseFloat(discount || "0");
    if (!n) return 0;
    return discountKind === "percent" ? (subtotal * n) / 100 : n;
  })();
  const total = Math.max(0, subtotal - discountValue);
  const outstandingCents = Math.max(0, Math.round(total * 100) - Number(a.amount_paid_cents ?? 0));
  const appointmentFee = useLinkFee(outstandingCents, addFeesToLink);

  async function saveNotes() {
    setBusy(true);
    try {
      await update({ data: { id: a.id, practitionerNotes: notes } });
      onPatch({ practitioner_notes: notes });
      toast.success("Notes saved");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function saveAfter() {
    setBusy(true);
    try {
      await updateAfter({
        data: { id: a.id, aftercare_html: aftercare, has_allergies: hasAllergies, allergies_text: allergiesText || null },
      });
      onPatch({ aftercare_html: aftercare, has_allergies: hasAllergies, allergies_text: allergiesText || null });
      toast.success("Aftercare saved");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function doCancel() {
    if (!confirm("Cancel this appointment?")) return;
    setBusy(true);
    try { await cancel({ data: { id: a.id } }); onPatch({ status: "cancelled" }); toast.success("Cancelled"); onClose(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function markPaidWith(method: "card_present" | "cash" | "bank_transfer") {
    setBusy(true);
    try {
      const discountCents = Math.round(discountValue * 100);
      await checkout({
        data: {
          appointmentId: a.id,
          method,
          discountCents,
          notes: checkoutNotes || null,
          markPaid: true,
        },
      });
      // Mirror the server's settlement locally so the outstanding badge clears
      // without needing a refetch.
      const totalCents = Math.round(Number(a.total_amount ?? 0) * 100);
      const already = Number(a.amount_paid_cents ?? 0);
      const settled = already + Math.max(0, totalCents - already - discountCents);
      onPatch({
        payment_status: "paid",
        amount_paid_cents: settled,
        checkout_discount_cents: discountCents || null,
      });
      toast.success("Marked as paid");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function sendStripeLink() {
    setBusy(true);
    try {
      const row = await createLink({
        data: {
          amountCents: outstandingCents,
          description: `${a.treatments?.name ?? "Treatment"} · ${a.patient_name}`,
          kind: "checkout",
          appointmentId: a.id,
          recipientEmail: a.patient_email,
          recipientName: a.patient_name,
          recipientPhone: a.patient_phone,
          includeFees: addFeesToLink,
        },
      });
      const url = (row as { stripe_url: string | null }).stripe_url;
      const subtotalCents = Number((row as { subtotal_cents?: number }).subtotal_cents ?? Math.round(total * 100));
      const surchargeCents = Number((row as { surcharge_cents?: number }).surcharge_cents ?? 0);
      const totalCents = Number((row as { total_cents?: number }).total_cents ?? subtotalCents + surchargeCents);
      const feeLine = surchargeCents > 0
        ? `\nSubtotal: £${(subtotalCents / 100).toFixed(2)}\nPlatform fee: £${(surchargeCents / 100).toFixed(2)}\nTotal: £${(totalCents / 100).toFixed(2)}`
        : `\nAmount: £${(totalCents / 100).toFixed(2)}`;
      await checkout({
        data: {
          appointmentId: a.id,
          method: "stripe_link",
          discountCents: Math.round(discountValue * 100),
          notes: checkoutNotes || null,
          markPaid: false,
        },
      });
      if (url && navigator.clipboard) await navigator.clipboard.writeText(url);

      // Prefer SMS when we have a phone number — open the device's native
      // SMS composer prefilled with the link and price breakdown. Fall back
      // to email if there's no phone. Clipboard is set either way.
      if (url && a.patient_phone) {
        const body = encodeURIComponent(
          `Hi ${a.patient_name}, here's your secure payment link:${feeLine}\n\n${url}`,
        );
        const phone = a.patient_phone.replace(/\s+/g, "");
        // iOS uses `&` after the number; Android accepts `?`. `?body=` works on both modern platforms.
        window.location.href = `sms:${phone}?body=${body}`;
        toast.success("Opening SMS with payment link");
      } else if (url && a.patient_email) {
        const res = await emailLink({
          data: {
            url,
            recipientEmail: a.patient_email,
            recipientName: a.patient_name,
            amountCents: totalCents,
            description: a.treatments?.name ?? "your appointment",
            kind: "balance",
          },
        });
        if ((res as { ok?: boolean }).ok) toast.success(`Payment link emailed to ${a.patient_email}`);
        else toast.error(`Email failed: ${(res as { error?: string }).error ?? "unknown error"} — link copied to clipboard`);
      } else {

        toast.success("Payment link copied to clipboard");
      }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }


  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border-l-4 p-2" style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.12) }}>
        <div className="font-semibold">{a.patient_name}</div>
        <div className="text-xs text-muted-foreground">
          {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)} · {a.treatments?.name ?? "Treatment"}
          {a.locations?.name && ` · ${a.locations.name}`}
        </div>
      </div>

      {(() => {
        const totalDue = Number(a.total_amount ?? 0);
        const paid = Number(a.amount_paid_cents ?? 0) / 100;
        const discounted = Number(a.checkout_discount_cents ?? 0) / 100;
        // A settled booking never shows outstanding, and any checkout discount
        // reduces what's still due.
        const outstanding = a.payment_status === "paid"
          ? 0
          : Math.max(0, totalDue - paid - discounted);
        return (
          <div className="flex flex-wrap gap-2">
            <Badge variant={cancelled ? "destructive" : "outline"}>{a.status}</Badge>
            <Badge variant={a.payment_status === "paid" ? "default" : "secondary"}>{a.payment_status}</Badge>
            {a.total_amount != null && <Badge variant="outline">Total £{totalDue.toFixed(2)}</Badge>}
            {paid > 0 && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Paid £{paid.toFixed(2)}</Badge>}
            {outstanding > 0 && a.total_amount != null && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">Outstanding £{outstanding.toFixed(2)}</Badge>
            )}
          </div>
        );
      })()}


      {(a.patient_email || a.patient_phone) && (
        <div className="text-xs text-muted-foreground">
          {[a.patient_email, a.patient_phone].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await getOrCreateClient({ data: { appointmentId: a.id } });
              navigate({ to: "/dashboard/patients/$id", params: { id: r.clientId } });
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}
        >
          Open profile
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || cancelled || isNoShow}
          onClick={async () => {
            if (!confirm("Mark this appointment as a no-show? The client's no-show count will increase.")) return;
            setBusy(true);
            try {
              const r = await markNoShow({ data: { appointmentId: a.id } });
              onPatch({ status: "no_show" });
              toast.success(`Marked as no-show${r.noShowCount ? ` (total: ${r.noShowCount})` : ""}`);
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1" /> No-show
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={busy}
          onClick={async () => {
            const reason = prompt("Block this client from future online bookings.\n\nOptional reason:");
            if (reason === null) return;
            setBusy(true);
            try {
              const r = await getOrCreateClient({ data: { appointmentId: a.id } });
              await blockClient({ data: { clientId: r.clientId, blocked: true, reason: reason || null } });
              toast.success("Client blocked from online bookings");
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}
        >
          <Ban className="h-3.5 w-3.5 mr-1" /> Block
        </Button>
      </div>

      {a.has_allergies && a.allergies_text && (
        <div className="rounded border border-red-500/40 bg-red-500/5 p-2 text-xs font-semibold text-red-600">
          ⚠ Allergies: {a.allergies_text}
        </div>
      )}

      {/* Checkout */}
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Percent className="h-4 w-4" /> Checkout</div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <Label className="text-xs">Discount</Label>
            <Input type="number" inputMode="decimal" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs invisible">.</Label>
            <div className="flex gap-1">
              <Button size="sm" variant={discountKind === "percent" ? "default" : "outline"} onClick={() => setDiscountKind("percent")}>%</Button>
              <Button size="sm" variant={discountKind === "amount" ? "default" : "outline"} onClick={() => setDiscountKind("amount")}>£</Button>
            </div>
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes (internal)</Label>
          <Textarea rows={2} value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} placeholder="Notes for your records" />
        </div>
        <div className="border-t pt-2 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>£{subtotal.toFixed(2)}</span></div>
          {discountValue > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-£{discountValue.toFixed(2)}</span></div>}
          {(() => {
            const paidRaw = Number(a.amount_paid_cents ?? 0) / 100;
            // Never show more paid than the invoice total — a full payment should
            // read as "paid in full", not a negative/credit balance.
            const paidShown = a.payment_status === "paid" ? Math.min(paidRaw || total, total) : Math.min(paidRaw, total);
            const outstanding = a.payment_status === "paid" ? 0 : Math.max(0, total - paidShown);
            return (
              <>
                {paidShown > 0 && (
                  <div className="flex justify-between text-emerald-700"><span>Already paid</span><span>-£{paidShown.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold">
                  <span>Outstanding</span>
                  <span>£{outstanding.toFixed(2)}</span>
                </div>
              </>
            );
          })()}
        </div>

        <label className="flex items-start gap-2 rounded-md border p-2.5">
          <Checkbox checked={addFeesToLink} onCheckedChange={(v) => setAddFeesToLink(v === true)} className="mt-0.5" />
          <span className="text-xs">
            <span className="block font-medium">Add platform &amp; processing fees to the Stripe link</span>
            <span className="text-muted-foreground">
            {addFeesToLink && appointmentFee > 0
              ? `Adds £${(appointmentFee / 100).toFixed(2)} — patient pays £${((outstandingCents + appointmentFee) / 100).toFixed(2)}.`
              : "Shown as a separate line to the patient on the Stripe page."}
          </span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Button disabled={busy} className="bg-slate-900 text-white hover:bg-slate-800" onClick={sendStripeLink}>
            <Link2 className="h-4 w-4 mr-1" /> Stripe link
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => markPaidWith("card_present")}>Card machine</Button>
          <Button disabled={busy} variant="outline" onClick={() => markPaidWith("cash")}>Cash</Button>
          <Button disabled={busy} variant="outline" onClick={() => markPaidWith("bank_transfer")}>Bank transfer</Button>
        </div>

        {card?.hasCard && card.clientId && (
          <div className="border-t pt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="w-full border-emerald-600/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              onClick={async () => {
                const outstanding = Math.max(0, total - Number(a.amount_paid_cents ?? 0) / 100);
                const suggested = outstanding > 0 ? outstanding.toFixed(2) : "";
                const input = prompt(
                  `Charge saved card ${card.brand ?? ""} ending ${card.last4 ?? "••••"}\n\nAmount (£):`,
                  suggested,
                );
                if (input === null) return;
                const amt = Number(input);
                if (!isFinite(amt) || amt < 1) { toast.error("Enter an amount of £1.00 or more"); return; }
                const reason = prompt("Reason for this charge (shown on the receipt):", checkoutNotes || "No-show / late cancel fee");
                if (!reason?.trim()) { toast.error("Reason required"); return; }
                if (!confirm(`Charge £${amt.toFixed(2)} to card ending ${card.last4}?\n\nReason: ${reason}`)) return;
                setBusy(true);
                try {
                  await chargeCard({ data: { clientId: card.clientId, amountCents: Math.round(amt * 100), description: reason.trim() } });
                  toast.success(`Charged £${amt.toFixed(2)} to card on file`);
                } catch (e) {
                  const msg = (e as Error).message || "Charge failed";
                  const needsAuth = /authenticat/i.test(msg);
                  toast.error(msg);
                  if (needsAuth && confirm("The bank needs the patient to authorise this payment.\n\nSend them a fresh payment link for this amount instead?")) {
                    try {
                      const row = await createLink({
                        data: {
                          amountCents: Math.round(amt * 100),
                          description: `${reason.trim()} · ${a.patient_name}`.slice(0, 200),
                          kind: "checkout",
                          appointmentId: a.id,
                          recipientEmail: a.patient_email,
                          recipientName: a.patient_name,
                          recipientPhone: a.patient_phone,
                        },
                      });
                      const url = (row as { stripe_url: string | null }).stripe_url;
                      if (url && navigator.clipboard) await navigator.clipboard.writeText(url);
                      if (url && a.patient_phone) {
                        const body = encodeURIComponent(
                          `Hi ${a.patient_name}, please tap this secure link to complete your £${amt.toFixed(2)} payment (${reason.trim()}):\n\n${url}`,
                        );
                        const phone = a.patient_phone.replace(/\s+/g, "");
                        window.location.href = `sms:${phone}?body=${body}`;
                        toast.success("Opening SMS with re-auth payment link");
                      } else if (url && a.patient_email) {
                        const subject = encodeURIComponent("Please authorise your payment");
                        const body = encodeURIComponent(
                          `Hi ${a.patient_name},\n\nPlease tap this secure link to complete your £${amt.toFixed(2)} payment (${reason.trim()}):\n\n${url}\n\nThanks!`,
                        );
                        window.open(`mailto:${a.patient_email}?subject=${subject}&body=${body}`);
                        toast.success("Payment link copied — email opened");
                      } else {
                        toast.success("Payment link copied to clipboard");
                      }
                    } catch (err) { toast.error((err as Error).message); }
                  }
                } finally { setBusy(false); }
              }}
            >
              <Percent className="h-3.5 w-3.5 mr-1" /> Charge card on file · {card.brand ?? "Card"} •••• {card.last4 ?? "••••"}
            </Button>
          </div>
        )}

        {a.stripe_payment_intent_id && Number(a.amount_paid_cents ?? 0) > Number(a.amount_refunded_cents ?? 0) && (
          <div className="border-t pt-2 space-y-1.5">
            {Number(a.amount_refunded_cents ?? 0) > 0 && (
              <div className="text-xs text-muted-foreground">
                Already refunded: £{(Number(a.amount_refunded_cents ?? 0) / 100).toFixed(2)}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="w-full text-destructive"
              onClick={async () => {
                const maxRefund = (Number(a.amount_paid_cents ?? 0) - Number(a.amount_refunded_cents ?? 0)) / 100;
                const input = prompt(
                  `Refund via Stripe.\n\nMax refundable: £${maxRefund.toFixed(2)}\n\nLeave blank to refund the full amount, or enter a smaller amount (£):`,
                  "",
                );
                if (input === null) return;
                const amt = input.trim() === "" ? undefined : Number(input);
                if (amt !== undefined && (!isFinite(amt) || amt <= 0)) {
                  toast.error("Enter a valid amount");
                  return;
                }
                setBusy(true);
                try {
                  const r = await refund({ data: { appointmentId: a.id, amount: amt } });
                  if (!r.ok) { toast.error(r.message); return; }
                  const newRefunded = Number(a.amount_refunded_cents ?? 0) + r.refundedCents;
                  onPatch({
                    amount_refunded_cents: newRefunded,
                    payment_status: r.fullyRefunded ? "refunded" : a.payment_status,
                  });
                  toast.success(`Refunded £${(r.refundedCents / 100).toFixed(2)}`);
                } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
              }}
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Refund via Stripe
            </Button>
          </div>
        )}
      </div>



      <div className="pt-2 border-t space-y-2">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={hasAllergies} onCheckedChange={(v) => setHasAllergies(!!v)} />
          <span className="font-semibold">Patient has allergies</span>
        </label>
        {hasAllergies && (
          <Input value={allergiesText} onChange={(e) => setAllergiesText(e.target.value)} placeholder="List allergies" className="text-xs" />
        )}
      </div>


      <DialogFooter className="flex-wrap gap-2">
        {!cancelled && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowReschedule(true)}>
            <CalendarClock className="h-3.5 w-3.5 mr-1" /> Reschedule
          </Button>
        )}
        {!cancelled && (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={doCancel}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancel appointment
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}><X className="h-3.5 w-3.5 mr-1" /> Close</Button>
      </DialogFooter>

      <RescheduleAppointmentDialog
        open={showReschedule}
        onOpenChange={setShowReschedule}
        appointmentId={a.id}
        initialDate={a.scheduled_date}
        initialStart={a.start_time}
        initialEnd={a.end_time}
        onRescheduled={({ date, start, end }) => {
          onPatch({ scheduled_date: date, start_time: start, end_time: end });
        }}
      />
    </div>
  );
}

