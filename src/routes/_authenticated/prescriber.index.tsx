import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import {
  listMyReferrals,
  updateReferralStatus,
  getReferralFull,
} from "@/lib/prescriber.functions";
import {
  savePrescription,
  signPrescription,
  listPrescriptionsForReferral,
  saveCarePlan,
  sendCarePlan,
  getCarePlanForReferral,
} from "@/lib/prescriptions.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, FileText, User, Pill, ClipboardList, PenLine, Send } from "lucide-react";


export const Route = createFileRoute("/_authenticated/prescriber/")({
  ssr: false,
  component: PrescriberHome,
});

type Ref = Awaited<ReturnType<typeof listMyReferrals>>[number];

function PrescriberHome() {
  const fetchRefs = useServerFn(listMyReferrals);
  const decide = useServerFn(updateReferralStatus);
  const refs = useQuery({ queryKey: ["my-referrals"], queryFn: () => fetchRefs() });
  const list = (refs.data ?? []) as Ref[];
  const pending = useMemo(() => list.filter((r) => r.status === "pending"), [list]);
  const active = useMemo(() => list.filter((r) => r.status === "accepted"), [list]);
  const history = useMemo(() => list.filter((r) => r.status === "completed" || r.status === "declined"), [list]);

  async function act(id: string, action: "accept" | "decline" | "complete") {
    try {
      await decide({ data: { id, action } });
      toast.success(action === "accept" ? "Case accepted" : action === "decline" ? "Declined" : "Marked complete");
      refs.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Referrals</h2>
        <p className="text-sm text-muted-foreground">
          Patients booked by connected practitioners appear here for your sign-off.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending {pending.length > 0 && <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? <Empty>No pending referrals.</Empty> : pending.map((r) => <RefCard key={r.id} r={r} onAct={act} />)}
        </TabsContent>
        <TabsContent value="active" className="space-y-3">
          {active.length === 0 ? <Empty>No active cases.</Empty> : active.map((r) => <RefCard key={r.id} r={r} onAct={act} />)}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? <Empty>No history yet.</Empty> : history.map((r) => <RefCard key={r.id} r={r} onAct={act} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{children}</CardContent></Card>;
}

function RefCard({ r, onAct }: { r: Ref; onAct: (id: string, action: "accept" | "decline" | "complete") => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = r.status === "accepted" || r.status === "completed";
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">
              {r.patient_display}
              <span className="ml-2 text-xs font-normal text-muted-foreground">· {r.treatment_name}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Referred by <span className="font-medium text-foreground">{r.clinic_name}</span>
              {r.appointment ? ` · ${r.appointment.scheduled_date} at ${r.appointment.start_time.slice(0,5)}` : ""}
              {r.routing === "in_person_consult" && <span className="ml-2">· In-person consult</span>}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </div>
        {r.status === "pending" && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onAct(r.id, "decline")}>
              <XCircle className="mr-1 h-4 w-4" /> Decline
            </Button>
            <Button size="sm" onClick={() => onAct(r.id, "accept")}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Accept case
            </Button>
          </div>
        )}
        {canExpand && (
          <>
            <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => setExpanded((x) => !x)}>
              <span className="inline-flex items-center gap-2"><User className="h-4 w-4" /> Full record &amp; medical forms</span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {expanded && <FullRecord id={r.id} onComplete={() => onAct(r.id, "complete")} status={r.status} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Ref["status"] }) {
  const map: Record<Ref["status"], { v: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { v: "secondary", label: "Pending" },
    accepted: { v: "default", label: "Accepted" },
    declined: { v: "destructive", label: "Declined" },
    completed: { v: "outline", label: "Completed" },
  };
  const m = map[status];
  return <Badge variant={m.v}>{m.label}</Badge>;
}

function FullRecord({ id, onComplete, status }: { id: string; onComplete: () => void; status: Ref["status"] }) {
  const fetchFull = useServerFn(getReferralFull);
  const q = useQuery({ queryKey: ["referral-full", id], queryFn: () => fetchFull({ data: { id } }) });
  const [note, setNote] = useState("");
  if (q.isLoading) return <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="px-2 py-3 text-sm text-destructive">{(q.error as Error).message}</p>;
  const parsed = q.data ? JSON.parse((q.data as { json: string }).json) ?? {} : {};
  const ref = parsed.referral ?? {};
  const client = parsed.client ?? null;
  const appt = parsed.appointment ?? null;
  const forms: { id: string; template_name: string; response: unknown; submitted_at: string | null; status: string }[] = parsed.medical_forms ?? [];
  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-3 text-sm">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</p>
        <p className="mt-1 font-medium">{ref.patient_name ?? client?.full_name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {ref.patient_email ?? client?.email ?? "—"}
          {ref.patient_phone ? ` · ${ref.patient_phone}` : client?.phone ? ` · ${client.phone}` : ""}
        </p>
      </section>
      {appt && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appointment</p>
          <p className="mt-1">{appt.scheduled_date} at {String(appt.start_time).slice(0, 5)} · {appt.status}</p>
        </section>
      )}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medical forms ({forms.length})</p>
        {forms.length === 0 ? <p className="mt-1 text-muted-foreground">None submitted yet.</p> : (
          <ul className="mt-1 space-y-2">
            {forms.map((f) => (
              <li key={f.id} className="rounded border bg-background p-2">
                <p className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4" /> {f.template_name} <span className="text-xs text-muted-foreground">· {f.status}</span>
                </p>
                {f.response ? (
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(f.response, null, 2)}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {status === "accepted" && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prescribing note (internal)</p>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision, dose, instructions…" />
          <div className="flex justify-end">
            <Button size="sm" onClick={onComplete}>Mark complete</Button>
          </div>
        </section>
      )}
    </div>
  );
}
