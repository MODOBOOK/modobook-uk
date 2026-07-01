import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import {
  listMyReferrals,
  updateReferralStatus,
  getReferralFull,
  getMyPrescriberDefaults,
} from "@/lib/prescriber.functions";
import {
  savePrescription,
  signPrescription,
  listPrescriptionsForReferral,
  saveCarePlan,
  sendCarePlan,
  getCarePlanForReferral,
} from "@/lib/prescriptions.functions";
import { listMySnippets, listMyRxTemplates, sendWalkInToPractitioner } from "@/lib/prescriber-directions.functions";
import { WalkInDialog } from "@/components/prescriber/WalkInDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Referrals</h2>
          <p className="text-sm text-muted-foreground">
            Patients booked by connected practitioners appear here for your sign-off.
          </p>
        </div>
        <WalkInDialog trigger={<Button size="sm" variant="outline">+ New walk-in</Button>} onCreated={() => refs.refetch()} />
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
              Referred by{" "}
              <span className="font-medium text-foreground">
                {r.practitioner_name ? `${r.practitioner_name} · ` : ""}{r.clinic_name}
              </span>
              {r.location_name ? ` · ${r.location_name}` : ""}
              {r.appointment ? ` · ${r.appointment.scheduled_date} at ${r.appointment.start_time.slice(0,5)}` : ""}
              {r.routing === "in_person_consult" && <span className="ml-2">· In-person consult</span>}
              {r.routing === "clinic_visit" && <span className="ml-2">· Clinic visit</span>}
              {r.is_walk_in && <span className="ml-2">· Walk-in</span>}
            </p>
            {r.is_walk_in && r.walk_in_note && (
              <p className="mt-2 rounded border bg-muted/40 p-2 text-xs whitespace-pre-wrap">{r.walk_in_note}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={r.status} />
            {r.is_walk_in && r.awaiting_practitioner_close && <Badge variant="outline" className="text-[10px]">With practitioner</Badge>}
          </div>
        </div>
        {r.status === "accepted" && r.is_walk_in && !r.awaiting_practitioner_close && (
          <SendWalkInButton id={r.id} />
        )}
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
        <Tabs defaultValue="prescribe" className="pt-1">
          <TabsList>
            <TabsTrigger value="prescribe"><Pill className="mr-1 h-3.5 w-3.5" /> Prescription</TabsTrigger>
            <TabsTrigger value="careplan"><ClipboardList className="mr-1 h-3.5 w-3.5" /> Care plan</TabsTrigger>
            <TabsTrigger value="complete">Complete</TabsTrigger>
          </TabsList>
          <TabsContent value="prescribe" className="pt-3">
            <PrescriptionEditor referralId={id} patient={ref} client={client} />
          </TabsContent>
          <TabsContent value="careplan" className="pt-3">
            <CarePlanEditor referralId={id} />
          </TabsContent>
          <TabsContent value="complete" className="space-y-2 pt-3">
            <p className="text-xs text-muted-foreground">
              Once prescription is signed and care plan sent, mark the referral complete.
              Both documents are returned to the practitioner automatically.
            </p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional final note for practitioner…" />
            <div className="flex justify-end">
              <Button size="sm" onClick={onComplete}><CheckCircle2 className="mr-1 h-4 w-4" /> Mark complete</Button>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/* ---------------------- Prescription editor ---------------------- */
type RxRow = {
  id: string;
  drug_name: string;
  drug_form: string | null;
  drug_strength: string | null;
  dose: string;
  quantity: string;
  directions: string;
  repeats_allowed: number;
  valid_until: string | null;
  notes: string | null;
  status: string;
  signed_at: string | null;
  signature_name: string | null;
  patient_name: string;
  patient_dob: string | null;
  patient_address: string | null;
  prescriber_name: string;
  prescriber_reg_body: string | null;
  prescriber_reg_number: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
};

function PrescriptionEditor({ referralId, patient, client }: { referralId: string; patient: Record<string, unknown>; client: Record<string, unknown> | null }) {
  const list = useServerFn(listPrescriptionsForReferral);
  const save = useServerFn(savePrescription);
  const sign = useServerFn(signPrescription);
  const fetchDefaults = useServerFn(getMyPrescriberDefaults);
  const q = useQuery({ queryKey: ["rx", referralId], queryFn: () => list({ data: { referral_id: referralId } }) });
  const defaults = useQuery({ queryKey: ["my-prescriber-defaults"], queryFn: () => fetchDefaults(), staleTime: 5 * 60 * 1000 });
  const rows = (q.data ?? []) as RxRow[];
  const latest = rows[0];

  const [form, setForm] = useState({
    id: undefined as string | undefined,
    patient_name: "",
    patient_dob: "",
    patient_address: "",
    prescriber_name: "",
    prescriber_reg_body: "",
    prescriber_reg_number: "",
    clinic_name: "",
    clinic_address: "",
    drug_name: "",
    drug_form: "",
    drug_strength: "",
    dose: "",
    quantity: "",
    directions: "",
    repeats_allowed: 0,
    valid_until: "",
    notes: "",
  });
  const [sigName, setSigName] = useState("");

  useEffect(() => {
    if (latest) {
      setForm({
        id: latest.id,
        patient_name: latest.patient_name,
        patient_dob: latest.patient_dob ?? "",
        patient_address: latest.patient_address ?? "",
        prescriber_name: latest.prescriber_name,
        prescriber_reg_body: latest.prescriber_reg_body ?? "",
        prescriber_reg_number: latest.prescriber_reg_number ?? "",
        clinic_name: latest.clinic_name ?? "",
        clinic_address: latest.clinic_address ?? "",
        drug_name: latest.drug_name,
        drug_form: latest.drug_form ?? "",
        drug_strength: latest.drug_strength ?? "",
        dose: latest.dose,
        quantity: latest.quantity,
        directions: latest.directions,
        repeats_allowed: latest.repeats_allowed,
        valid_until: latest.valid_until ?? "",
        notes: latest.notes ?? "",
      });
      setSigName(latest.signature_name ?? "");
    } else {
      const d = (defaults.data ?? {}) as {
        prescriber_name?: string;
        prescriber_reg_body?: string;
        prescriber_reg_number?: string;
        clinic_name?: string;
        clinic_address?: string;
      };
      setForm((f) => ({
        ...f,
        patient_name: (patient.patient_name as string) || (client?.full_name as string) || "",
        patient_dob: (patient.patient_dob as string) || (client?.date_of_birth as string) || "",
        patient_address: (patient.patient_address as string) || (client?.address as string) || "",
        prescriber_name: f.prescriber_name || d.prescriber_name || "",
        prescriber_reg_body: f.prescriber_reg_body || d.prescriber_reg_body || "",
        prescriber_reg_number: f.prescriber_reg_number || d.prescriber_reg_number || "",
        clinic_name: f.clinic_name || d.clinic_name || "",
        clinic_address: f.clinic_address || d.clinic_address || "",
      }));
    }
  }, [latest, patient, client, defaults.data]);

  const signed = latest?.status === "signed";

  async function onSave() {
    try {
      const payload = {
        ...form,
        referral_id: referralId,
        patient_dob: form.patient_dob || null,
        valid_until: form.valid_until || null,
      };

      const res = await save({ data: payload });
      setForm((f) => ({ ...f, id: res.id }));
      toast.success("Prescription saved");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function onSign() {
    if (!form.id) { await onSave(); }
    const id = form.id;
    if (!id || !sigName.trim()) { toast.error("Type your full name to sign"); return; }
    try {
      await sign({ data: { id, signature_name: sigName.trim(), signature_data: `${sigName.trim()} · ${new Date().toISOString()}` } });
      toast.success("Prescription signed & sent to practitioner");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-3 text-xs">
      {!signed && (
        <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/40 p-2">
          <TemplatePicker onPick={(t) => setForm((f) => ({
            ...f,
            drug_name: t.drug_name ?? f.drug_name,
            drug_form: t.drug_form ?? f.drug_form,
            drug_strength: t.drug_strength ?? f.drug_strength,
            dose: t.dose ?? f.dose,
            quantity: t.quantity ?? f.quantity,
            directions: t.directions ?? f.directions,
            repeats_allowed: t.repeats_allowed ?? f.repeats_allowed,
            valid_until: t.validity_days ? new Date(Date.now() + t.validity_days * 86400000).toISOString().slice(0, 10) : f.valid_until,
            notes: t.notes ?? f.notes,
          }))} />
          <SnippetPicker onPick={(text) => setForm((f) => ({ ...f, directions: f.directions ? `${f.directions}\n${text}` : text }))} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Patient name" v={form.patient_name} on={(v) => setForm({ ...form, patient_name: v })} disabled={signed} />
        <Field label="Date of birth" type="date" v={form.patient_dob} on={(v) => setForm({ ...form, patient_dob: v })} disabled={signed} />
        <Field label="Patient address" v={form.patient_address} on={(v) => setForm({ ...form, patient_address: v })} disabled={signed} className="sm:col-span-2" />
        <Field label="Prescriber full name" v={form.prescriber_name} on={(v) => setForm({ ...form, prescriber_name: v })} disabled={signed} />
        <Field label="Regulatory body (e.g. GMC, NMC, GPhC)" v={form.prescriber_reg_body} on={(v) => setForm({ ...form, prescriber_reg_body: v })} disabled={signed} />
        <Field label="Registration number" v={form.prescriber_reg_number} on={(v) => setForm({ ...form, prescriber_reg_number: v })} disabled={signed} />
        <Field label="Clinic / letterhead" v={form.clinic_name} on={(v) => setForm({ ...form, clinic_name: v })} disabled={signed} />
        <Field label="Clinic address" v={form.clinic_address} on={(v) => setForm({ ...form, clinic_address: v })} disabled={signed} className="sm:col-span-2" />
      </div>
      <div className="rounded border bg-background p-2">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">POM — Prescription (UK guidelines)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Drug name" v={form.drug_name} on={(v) => setForm({ ...form, drug_name: v })} disabled={signed} />
          <Field label="Form (e.g. solution)" v={form.drug_form} on={(v) => setForm({ ...form, drug_form: v })} disabled={signed} />
          <Field label="Strength" v={form.drug_strength} on={(v) => setForm({ ...form, drug_strength: v })} disabled={signed} />
          <Field label="Dose" v={form.dose} on={(v) => setForm({ ...form, dose: v })} disabled={signed} />
          <Field label="Quantity" v={form.quantity} on={(v) => setForm({ ...form, quantity: v })} disabled={signed} />
          <Field label="Repeats allowed" type="number" v={String(form.repeats_allowed)} on={(v) => setForm({ ...form, repeats_allowed: Math.max(0, Number(v) || 0) })} disabled={signed} />
          <Field label="Valid until" type="date" v={form.valid_until} on={(v) => setForm({ ...form, valid_until: v })} disabled={signed} />
        </div>
        <div className="mt-2">
          <Label className="text-[11px]">Directions for use</Label>
          <Textarea rows={2} value={form.directions} onChange={(e) => setForm({ ...form, directions: e.target.value })} disabled={signed} />
        </div>
        <div className="mt-2">
          <Label className="text-[11px]">Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={signed} />
        </div>
      </div>

      {signed ? (
        <div className="space-y-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-emerald-900">
          <p>
            ✓ Signed by <strong>{latest?.signature_name}</strong> on{" "}
            {new Date(latest!.signed_at!).toLocaleString()}. Sent to practitioner & filed to patient record.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { downloadPrescriptionPdf } = await import("@/lib/prescription-pdf");
              downloadPrescriptionPdf(
                { ...form, signature_name: latest?.signature_name, signed_at: latest?.signed_at },
                `Rx-${form.patient_name.replace(/\s+/g, "_")}.pdf`,
              );
            }}
          >
            Download PDF
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-[11px]">Type your full name to sign</Label>
              <Input value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder="Dr Jane Smith" />
            </div>
            <Button size="sm" variant="outline" onClick={onSave}>Save draft</Button>
            <Button size="sm" onClick={onSign}><PenLine className="mr-1 h-4 w-4" /> Sign & send</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------- Care plan editor ---------------------- */
function CarePlanEditor({ referralId }: { referralId: string }) {
  const get = useServerFn(getCarePlanForReferral);
  const save = useServerFn(saveCarePlan);
  const send = useServerFn(sendCarePlan);
  const q = useQuery({ queryKey: ["careplan", referralId], queryFn: () => get({ data: { referral_id: referralId } }) });
  const row = q.data as { id: string; assessment: string | null; notes: string | null; plan: string | null; follow_up: string | null; status: string; sent_at: string | null } | null;
  const [form, setForm] = useState({ id: undefined as string | undefined, assessment: "", notes: "", plan: "", follow_up: "" });
  useEffect(() => {
    if (row) setForm({ id: row.id, assessment: row.assessment ?? "", notes: row.notes ?? "", plan: row.plan ?? "", follow_up: row.follow_up ?? "" });
  }, [row]);

  async function onSave() {
    try {
      const res = await save({ data: { ...form, referral_id: referralId } });
      setForm((f) => ({ ...f, id: res.id }));
      toast.success("Care plan saved");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function onSend() {
    if (!form.id) { await onSave(); }
    const id = form.id;
    if (!id) return;
    try {
      await send({ data: { id } });
      toast.success("Care plan sent to practitioner");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  const sent = row?.status === "sent";

  return (
    <div className="space-y-2 text-xs">
      <div>
        <Label className="text-[11px]">Assessment</Label>
        <Textarea rows={3} value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} placeholder="Clinical assessment…" />
      </div>
      <div>
        <Label className="text-[11px]">Plan</Label>
        <Textarea rows={3} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="Treatment plan, products, doses…" />
      </div>
      <div>
        <Label className="text-[11px]">Notes for practitioner</Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything the practitioner should know before treating…" />
      </div>
      <div>
        <Label className="text-[11px]">Follow-up</Label>
        <Textarea rows={2} value={form.follow_up} onChange={(e) => setForm({ ...form, follow_up: e.target.value })} placeholder="Review timing, monitoring…" />
      </div>
      {sent ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-emerald-900">
          ✓ Sent to practitioner on {new Date(row!.sent_at!).toLocaleString()}.
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onSave}>Save</Button>
          <Button size="sm" onClick={onSend}><Send className="mr-1 h-4 w-4" /> Send to practitioner</Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, v, on, type = "text", disabled, className }: { label: string; v: string; on: (v: string) => void; type?: string; disabled?: boolean; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-[11px]">{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} disabled={disabled} />
    </div>
  );
}


type RxTemplate = Awaited<ReturnType<typeof listMyRxTemplates>>[number];
type Snippet = Awaited<ReturnType<typeof listMySnippets>>[number];

function SendWalkInButton({ id }: { id: string }) {
  const send = useServerFn(sendWalkInToPractitioner);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="flex justify-end">
      <Button
        size="sm"
        variant="outline"
        disabled={busy || sent}
        onClick={async () => {
          try {
            setBusy(true);
            await send({ data: { id } });
            toast.success("Sent to practitioner to close");
            setSent(true);
          } catch (e) { toast.error((e as Error).message); }
          finally { setBusy(false); }
        }}
      ><Send className="mr-1 h-4 w-4" /> {sent ? "Sent to practitioner" : "Send to practitioner to close"}</Button>
    </div>
  );
}

function TemplatePicker({ onPick }: { onPick: (t: RxTemplate) => void }) {
  const fetchFn = useServerFn(listMyRxTemplates);
  const q = useQuery({ queryKey: ["rx-templates"], queryFn: () => fetchFn() });
  const list = (q.data ?? []) as RxTemplate[];
  return (
    <div className="flex items-center gap-2">
      <Label className="text-[11px] text-muted-foreground">Load template</Label>
      <Select onValueChange={(id) => { const t = list.find((x) => x.id === id); if (t) onPick(t); }}>
        <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder={list.length ? "Choose a template…" : "No templates yet"} /></SelectTrigger>
        <SelectContent>
          {list.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SnippetPicker({ onPick }: { onPick: (text: string) => void }) {
  const fetchFn = useServerFn(listMySnippets);
  const q = useQuery({ queryKey: ["rx-snippets"], queryFn: () => fetchFn() });
  const list = (q.data ?? []) as Snippet[];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 text-xs"><ClipboardList className="mr-1 h-3 w-3" /> Insert direction</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {list.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">No snippets. Create some in Directions library.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full rounded p-2 text-left text-xs hover:bg-muted"
                onClick={() => onPick(s.body)}
              >
                <p className="font-medium">{s.label}</p>
                <p className="line-clamp-2 text-muted-foreground">{s.body}</p>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
