import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import {
  listMyAppointments,
  updateAppointmentNotes,
  cancelAppointment,
  updateAppointmentAftercareAndAllergy,
} from "@/lib/availability.functions";
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
  notes: string | null;
  practitioner_notes: string | null;
  aftercare_html: string | null;
  has_allergies: boolean | null;
  allergies_text: string | null;
  treatments: { name: string; color?: string | null } | null;
  locations: { name: string } | null;
};

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 7;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAYS_VISIBLE = 3;

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

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function BookingsPage() {
  const list = useServerFn(listMyAppointments);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(new Date());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setAppts((await list()) as Appt[]);
      } finally {
        setLoading(false);
      }
    })();
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  // scroll to a reasonable hour on mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const targetHour = Math.max(START_HOUR, Math.min(END_HOUR, now.getHours() - 1));
      scrollRef.current.scrollTop = (targetHour - START_HOUR) * HOUR_HEIGHT;
    }
  }, [loading]);

  const days = useMemo(
    () => Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(anchor, i)),
    [anchor],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, Appt[]>();
    for (const a of appts) {
      if (a.status === "cancelled") continue;
      (m.get(a.scheduled_date) ?? m.set(a.scheduled_date, []).get(a.scheduled_date)!).push(a);
    }
    return m;
  }, [appts]);

  const todayStr = ymd(now);
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor(addDays(anchor, -DAYS_VISIBLE))}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 font-semibold text-lg">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {anchor.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor(addDays(anchor, DAYS_VISIBLE))}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
        </div>
        <div className="relative">
          <Button
            size="icon"
            onClick={() => setActionsOpen((v) => !v)}
            aria-label="Calendar actions"
          >
            <Plus className="h-5 w-5" />
          </Button>
          {actionsOpen && (
            <>
              <button
                className="fixed inset-0 z-30"
                onClick={() => setActionsOpen(false)}
                aria-label="Close menu"
              />
              <div className="absolute right-0 top-12 z-40 flex w-56 flex-col gap-2">
                <Link to="/dashboard/new-appointment" onClick={() => setActionsOpen(false)}>
                  <Button className="w-full justify-start gap-2 rounded-full bg-orange-200 text-orange-950 hover:bg-orange-300">
                    <CalendarDays className="h-4 w-4" />
                    New Appointment
                  </Button>
                </Link>
                <Link to="/dashboard/clinic" onClick={() => setActionsOpen(false)}>
                  <Button className="w-full justify-start gap-2 rounded-full bg-slate-900 text-white hover:bg-slate-800">
                    <Link2 className="h-4 w-4" />
                    Generate Link
                  </Button>
                </Link>
                <Link to="/dashboard/availability" onClick={() => setActionsOpen(false)}>
                  <Button className="w-full justify-start gap-2 rounded-full bg-rose-300 text-rose-950 hover:bg-rose-400">
                    <Ban className="h-4 w-4" />
                    Block a Time
                  </Button>
                </Link>
                <Link to="/dashboard/availability" onClick={() => setActionsOpen(false)}>
                  <Button className="w-full justify-start gap-2 rounded-full bg-emerald-300 text-emerald-950 hover:bg-emerald-400">
                    <CircleCheck className="h-4 w-4" />
                    Unblock a Time
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {loading ? "Loading…" : `${appts.length} total booking${appts.length === 1 ? "" : "s"}`}
      </p>

      {/* Day headers */}
      <Card className="overflow-hidden">
        <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${DAYS_VISIBLE}, 1fr)` }}>
          <div />
          {days.map((d) => {
            const isToday = ymd(d) === todayStr;
            return (
              <div
                key={ymd(d)}
                className={`flex flex-col items-center py-2 ${isToday ? "text-primary" : ""}`}
              >
                <span className="text-[11px] uppercase">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold ${
                    isToday ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="relative max-h-[70vh] overflow-y-auto">
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `56px repeat(${DAYS_VISIBLE}, 1fr)`,
              height: totalHeight,
            }}
          >
            {/* Hour gutter */}
            <div className="relative border-r">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 pr-1 text-right text-[11px] text-muted-foreground"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 6 }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d) => {
              const key = ymd(d);
              const isToday = key === todayStr;
              const dayAppts = byDate.get(key) ?? [];
              return (
                <div key={key} className="relative border-r last:border-r-0">
                  {/* hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-dashed border-muted"
                      style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}
                  {/* Now indicator */}
                  {isToday && (() => {
                    const hr = now.getHours() + now.getMinutes() / 60;
                    if (hr < START_HOUR || hr > END_HOUR + 1) return null;
                    const top = (hr - START_HOUR) * HOUR_HEIGHT;
                    return (
                      <>
                        <div
                          className="absolute left-0 right-0 z-10 h-px bg-red-500"
                          style={{ top }}
                        />
                        <div
                          className="absolute z-10 -translate-y-1/2 rounded-full border border-red-500 bg-background px-1 text-[10px] font-semibold text-red-500"
                          style={{ top, left: 2 }}
                        >
                          {String(now.getHours()).padStart(2, "0")}:
                          {String(now.getMinutes()).padStart(2, "0")}
                        </div>
                      </>
                    );
                  })()}
                  {/* Events */}
                  {dayAppts.map((a) => {
                    const start = parseTime(a.start_time);
                    const end = parseTime(a.end_time);
                    const top = (start - START_HOUR) * HOUR_HEIGHT;
                    const height = Math.max(22, (end - start) * HOUR_HEIGHT - 2);
                    const color = a.treatments?.color || "#3b82f6";
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAppt(a)}
                        className="absolute left-1 right-1 z-[5] overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-[11px] shadow-sm transition hover:shadow"
                        style={{
                          top,
                          height,
                          borderLeftColor: color,
                          backgroundColor: hexToRgba(color, 0.18),
                          color: "var(--foreground)",
                        }}
                      >
                        <div className="truncate font-semibold">{a.patient_name}</div>
                        <div className="truncate opacity-80">
                          {a.start_time.slice(0, 5)} · {a.treatments?.name ?? "Treatment"}
                        </div>
                        {a.has_allergies && (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-red-600">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Allergies
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

      <Dialog open={!!selectedAppt} onOpenChange={(o) => !o && setSelectedAppt(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment</DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <ApptDetails
              a={selectedAppt}
              onPatch={(patch) => {
                setAppts((prev) =>
                  prev.map((x) => (x.id === selectedAppt.id ? { ...x, ...patch } : x)),
                );
                setSelectedAppt((s) => (s ? { ...s, ...patch } : s));
              }}
              onClose={() => setSelectedAppt(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApptDetails({
  a,
  onPatch,
  onClose,
}: {
  a: Appt;
  onPatch: (patch: Partial<Appt>) => void;
  onClose: () => void;
}) {
  const update = useServerFn(updateAppointmentNotes);
  const cancel = useServerFn(cancelAppointment);
  const updateAfter = useServerFn(updateAppointmentAftercareAndAllergy);
  const [notes, setNotes] = useState(a.practitioner_notes ?? "");
  const [aftercare, setAftercare] = useState(a.aftercare_html ?? "");
  const [hasAllergies, setHasAllergies] = useState(!!a.has_allergies);
  const [allergiesText, setAllergiesText] = useState(a.allergies_text ?? "");
  const [saving, setSaving] = useState(false);
  const cancelled = a.status === "cancelled";
  const color = a.treatments?.color || "#3b82f6";

  async function saveNotes() {
    setSaving(true);
    try {
      await update({ data: { id: a.id, practitionerNotes: notes } });
      onPatch({ practitioner_notes: notes });
      toast.success("Notes saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAfter() {
    setSaving(true);
    try {
      await updateAfter({
        data: {
          id: a.id,
          aftercare_html: aftercare,
          has_allergies: hasAllergies,
          allergies_text: allergiesText || null,
        },
      });
      onPatch({
        aftercare_html: aftercare,
        has_allergies: hasAllergies,
        allergies_text: allergiesText || null,
      });
      toast.success("Aftercare saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function doCancel() {
    if (!confirm("Cancel this appointment? The patient will see it as cancelled.")) return;
    setSaving(true);
    try {
      await cancel({ data: { id: a.id } });
      onPatch({ status: "cancelled" });
      toast.success("Appointment cancelled");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div
        className="rounded-md border-l-4 p-2"
        style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.12) }}
      >
        <div className="font-semibold">{a.patient_name}</div>
        <div className="text-xs text-muted-foreground">
          {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)} ·{" "}
          {a.treatments?.name ?? "Treatment"}
          {a.locations?.name && ` · ${a.locations.name}`}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={cancelled ? "destructive" : "outline"}>{a.status}</Badge>
        <Badge variant={a.payment_status === "paid" ? "default" : "secondary"}>
          {a.payment_status}
        </Badge>
        {a.total_amount != null && (
          <Badge variant="outline">£{Number(a.total_amount).toFixed(2)}</Badge>
        )}
      </div>

      {(a.patient_email || a.patient_phone) && (
        <div className="text-xs text-muted-foreground">
          {[a.patient_email, a.patient_phone].filter(Boolean).join(" · ")}
        </div>
      )}

      {a.has_allergies && a.allergies_text && (
        <div className="rounded border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-600 font-semibold">
          ⚠ Allergies: {a.allergies_text}
        </div>
      )}

      {a.notes && (
        <div className="text-xs">
          <span className="font-semibold">Patient notes:</span> {a.notes}
        </div>
      )}

      <div className="pt-2 border-t space-y-2">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={hasAllergies}
            onCheckedChange={(v) => setHasAllergies(!!v)}
          />
          <span className="font-semibold">Patient has allergies</span>
        </label>
        {hasAllergies && (
          <Input
            value={allergiesText}
            onChange={(e) => setAllergiesText(e.target.value)}
            placeholder="List allergies"
            className="text-xs"
          />
        )}
      </div>

      <div className="pt-2 border-t">
        <div className="text-xs font-semibold mb-1">Internal notes</div>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" disabled={saving} onClick={saveNotes}>
            <Save className="h-3.5 w-3.5 mr-1" />
            Save notes
          </Button>
        </div>
      </div>

      <div className="pt-2 border-t">
        <div className="text-xs font-semibold mb-1">Aftercare</div>
        <Textarea
          rows={3}
          value={aftercare}
          onChange={(e) => setAftercare(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={saving} onClick={saveAfter}>
            <Save className="h-3.5 w-3.5 mr-1" />
            Save aftercare
          </Button>
        </div>
      </div>

      <DialogFooter>
        {!cancelled && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={saving}
            onClick={doCancel}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel appointment
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
