import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { listMyAppointments, updateAppointmentNotes } from "@/lib/availability.functions";
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
  treatments: { name: string } | null;
  locations: { name: string } | null;
};


function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function BookingsPage() {
  const list = useServerFn(listMyAppointments);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(ymd(new Date()));

  useEffect(() => {
    (async () => {
      try { setAppts((await list()) as Appt[]); } finally { setLoading(false); }
    })();
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, Appt[]>();
    for (const a of appts) {
      const arr = m.get(a.scheduled_date) ?? [];
      arr.push(a);
      m.set(a.scheduled_date, arr);
    }
    return m;
  }, [appts]);

  const monthStart = cursor;
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedAppts = byDate.get(selected) ?? [];
  const todayStr = ymd(new Date());

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">Calendar of patient appointments.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}</CardTitle>
            <CardDescription>{loading ? "Loading…" : `${appts.length} total booking${appts.length === 1 ? "" : "s"}`}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => { const t = new Date(); setCursor(startOfMonth(t)); setSelected(ymd(t)); }}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="text-center py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <div key={i} className="aspect-square" />;
              const key = ymd(c);
              const count = byDate.get(key)?.length ?? 0;
              const isSel = key === selected;
              const isToday = key === todayStr;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={`aspect-square rounded border p-1 text-left text-xs hover:bg-muted transition ${isSel ? "ring-2 ring-primary" : ""} ${isToday ? "border-primary" : ""}`}
                >
                  <div className="font-medium">{c.getDate()}</div>
                  {count > 0 && <div className="mt-1"><Badge variant="secondary" className="text-[10px] px-1 py-0">{count}</Badge></div>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{new Date(selected + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</CardTitle>
          <CardDescription>{selectedAppts.length} booking{selectedAppts.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedAppts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No bookings on this day.</div>
          ) : selectedAppts.map((a) => (
            <ApptRow key={a.id} a={a} onSaved={(notes) => setAppts((prev) => prev.map((x) => x.id === a.id ? { ...x, practitioner_notes: notes } : x))} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ApptRow({ a, onSaved }: { a: Appt; onSaved: (notes: string) => void }) {
  const update = useServerFn(updateAppointmentNotes);
  const [notes, setNotes] = useState(a.practitioner_notes ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="rounded border p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{a.start_time.slice(0,5)} – {a.end_time.slice(0,5)} · {a.patient_name}</div>
        <div className="flex gap-2">
          <Badge variant="outline">{a.status}</Badge>
          <Badge variant={a.payment_status === "paid" ? "default" : "secondary"}>{a.payment_status}</Badge>
        </div>
      </div>
      <div className="text-muted-foreground">
        {a.treatments?.name ?? "Treatment"}
        {a.locations?.name && ` · ${a.locations.name}`}
        {a.total_amount != null && ` · £${Number(a.total_amount).toFixed(2)}`}
      </div>
      {(a.patient_email || a.patient_phone) && (
        <div className="text-xs text-muted-foreground">{[a.patient_email, a.patient_phone].filter(Boolean).join(" · ")}</div>
      )}
      {a.notes && <div className="text-xs"><span className="font-semibold">Patient notes:</span> {a.notes}</div>}
      <div className="pt-2 border-t">
        <div className="text-xs font-semibold mb-1">Notes for patient (visible in their account)</div>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Aftercare advice, follow-up, etc." />
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={saving} onClick={async () => {
            setSaving(true);
            try { await update({ data: { id: a.id, practitionerNotes: notes } }); onSaved(notes); toast.success("Notes saved"); }
            catch (e) { toast.error((e as Error).message); }
            finally { setSaving(false); }
          }}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
        </div>
      </div>
    </div>
  );
}

