import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPatientTimeline, addManualEvent, deleteManualEvent, type TimelineEvent } from "@/lib/patient-records.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Calendar, ClipboardList, FileSignature, Pill, StickyNote, CreditCard,
  MessageSquare, Image as ImageIcon, User, Plus, Loader2, Trash2, CalendarClock,
} from "lucide-react";
import { RescheduleAppointmentDialog } from "@/components/RescheduleAppointmentDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$id/")({
  ssr: false,
  component: TimelinePage,
});

const KIND_META: Record<string, { icon: any; label: string; color: string }> = {
  appointment:    { icon: Calendar, label: "Appointment", color: "bg-blue-100 text-blue-700" },
  consultation:   { icon: ClipboardList, label: "Consultation", color: "bg-indigo-100 text-indigo-700" },
  note:           { icon: StickyNote, label: "Note", color: "bg-amber-100 text-amber-700" },
  consent:        { icon: FileSignature, label: "Consent", color: "bg-emerald-100 text-emerald-700" },
  medical_form:   { icon: ClipboardList, label: "Medical form", color: "bg-emerald-100 text-emerald-700" },
  prescription:   { icon: Pill, label: "Prescription", color: "bg-purple-100 text-purple-700" },
  payment:        { icon: CreditCard, label: "Payment", color: "bg-teal-100 text-teal-700" },
  communication:  { icon: MessageSquare, label: "Comm.", color: "bg-sky-100 text-sky-700" },
  manual:         { icon: Activity, label: "Event", color: "bg-slate-100 text-slate-700" },
  file:           { icon: ImageIcon, label: "File", color: "bg-rose-100 text-rose-700" },
  review:         { icon: User, label: "Review", color: "bg-yellow-100 text-yellow-700" },
};

function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TimelinePage() {
  const { id } = Route.useParams();
  const get = useServerFn(getPatientTimeline);
  const add = useServerFn(addManualEvent);
  const del = useServerFn(deleteManualEvent);
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [reschedFor, setReschedFor] = useState<null | { id: string; date: string; start: string; end: string }>(null);

  async function reload() {
    setEvents(null);
    try {
      const r = await get({ data: { clientId: id } });
      setEvents(r);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load timeline");
      setEvents([]);
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  const shown = (events ?? []).filter(e => filter === "all" || e.kind === filter);

  async function submitEvent() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await add({ data: { clientId: id, title: title.trim(), body: body.trim() || undefined } });
      setTitle(""); setBody(""); setShowAdd(false);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add event");
    } finally { setBusy(false); }
  }

  async function removeManual(evtId: string) {
    if (!confirm("Remove this event?")) return;
    await del({ data: { id: evtId } });
    reload();
  }

  return (
    <div className="space-y-4">
      {/* Filter chips + add */}
      <div className="flex flex-wrap items-center gap-2">
        {["all", "appointment", "consultation", "note", "consent", "medical_form", "prescription", "communication", "manual"].map(k => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={
              "rounded-full border px-3 py-1 text-xs transition " +
              (filter === k ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")
            }
          >
            {k === "all" ? "All" : KIND_META[k]?.label ?? k}
          </button>
        ))}
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowAdd(v => !v)}>
            <Plus className="mr-1 h-4 w-4" />Add event
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="space-y-2 p-3">
            <Input placeholder="Title (e.g. Phone review)" value={title} onChange={e => setTitle(e.target.value)} />
            <Textarea placeholder="Details (optional)" rows={3} value={body} onChange={e => setBody(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={submitEvent} disabled={busy || !title.trim()}>
                {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spine */}
      {events === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No events on this timeline yet.</CardContent></Card>
      ) : (
        <ol className="relative ml-3 space-y-4 border-l pl-6">
          {shown.map(evt => {
            const meta = KIND_META[evt.kind] ?? { icon: Activity, label: evt.kind, color: "bg-slate-100 text-slate-700" };
            const Icon = meta.icon;
            return (
              <li key={evt.id} className="relative">
                <span className={`absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full ${meta.color} ring-2 ring-background`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          <span className="text-xs text-muted-foreground">{fmt(evt.occurred_at)}</span>
                          {evt.meta?.shared && <Badge variant="secondary" className="text-[10px]">Shared with patient</Badge>}
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">{evt.title}</div>
                        {evt.description && (
                          <div className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{evt.description}</div>
                        )}
                      </div>
                      {evt.kind === "manual" && (
                        <Button size="sm" variant="ghost" onClick={() => removeManual(evt.id.replace(/^manual:/, ""))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
