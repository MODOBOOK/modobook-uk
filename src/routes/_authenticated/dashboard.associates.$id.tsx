import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { pilotFeaturesEnabled } from "@/lib/feature-flags";
import { FaceMapView } from "@/components/consultation/FaceMapView";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAssociateDetail,
  saveAssociateDocument,
  deleteAssociateDocument,
  getAssociateDocumentUrl,
  uploadAssociateDocumentFile,
  saveAssociateMeeting,
  deleteAssociateMeeting,
} from "@/lib/associate-admin.functions";
import {
  updateAssociate,
  getAssociateOversight,
  getAssociatePatients,
  saveAssociateIncident,
  setIncidentResolved,
} from "@/lib/associates.functions";
import { openAssociatePatientRecord, listAssociateAccessLog } from "@/lib/associate-audit.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertTriangle,
  CalendarDays,
  Download,
  FileText,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/associates/$id")({
  ssr: false,
  beforeLoad: ({ context }) => {
    const slug = (context as { profile?: { slug?: string } })?.profile?.slug;
    if (!pilotFeaturesEnabled(slug)) throw redirect({ to: "/dashboard/coming-soon" });
  },
  head: () => ({
    meta: [
      { title: "Associate · MODO" },
      { name: "description", content: "Oversight, patients, compliance documents and supervision meetings for one associate." },
    ],
  }),
  component: AssociateDetailPage,
});

const DOC_KINDS = [
  { value: "contract", label: "Contract / agreement" },
  { value: "dbs", label: "DBS check" },
  { value: "pvg", label: "PVG check" },
  { value: "insurance", label: "Indemnity insurance" },
  { value: "registration", label: "Professional registration" },
  { value: "qualification", label: "Qualification" },
  { value: "other", label: "Other" },
];
const SEVERITIES = ["minor", "moderate", "serious", "near-miss"];
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

function AssociateDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getAssociateDetail);
  const update = useServerFn(updateAssociate);

  const { data, isLoading } = useQuery({ queryKey: ["associate-detail", id], queryFn: () => detailFn({ data: { id } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["associate-detail", id] });

  async function patch(p: Record<string, unknown>) {
    try {
      await update({ data: { id, patch: p as any } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="text-sm text-muted-foreground">Associate not found.</div>;

  const a: any = data.link;
  const name = data.associate?.clinic_name || data.associate?.full_name || a.invited_name;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl sm:text-3xl">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground break-all">
              {data.associate?.email ?? a.invited_email}
              {data.associate?.phone ? ` · ${data.associate.phone}` : ""}
              {data.associate?.slug ? ` · /m/${data.associate.slug}` : ""}
            </p>
          </div>
          <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Patients" value={data.stats.patients} icon={Users} />
        <Stat label="Upcoming appts" value={data.stats.upcoming} icon={CalendarDays} />
        <Stat label="Seen last 30 days" value={data.stats.last30} icon={ShieldCheck} />
        <Stat label="Open incidents" value={data.stats.openIncidents} icon={AlertTriangle} />
      </div>

      <Tabs defaultValue="patients">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="audit">Access log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="pt-4">
          <PatientsTab id={id} allowed={!!a.oversight_records && a.status !== "declined" && a.status !== "revoked"} />
        </TabsContent>
        <TabsContent value="appointments" className="pt-4">
          <AppointmentsTab id={id} />
        </TabsContent>
        <TabsContent value="compliance" className="pt-4">
          <ComplianceTab id={id} documents={data.documents} onChange={refresh} />
        </TabsContent>
        <TabsContent value="meetings" className="pt-4">
          <MeetingsTab id={id} meetings={data.meetings} onChange={refresh} />
        </TabsContent>
        <TabsContent value="incidents" className="pt-4">
          <IncidentsTab id={id} onChange={refresh} />
        </TabsContent>
        <TabsContent value="audit" className="pt-4">
          <AccessLogTab id={id} />
        </TabsContent>
        <TabsContent value="settings" className="space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Clinical records" desc="Notes, consents, forms" checked={a.oversight_records} onChange={(v) => patch({ oversight_records: v })} />
            <ToggleRow label="Appointments" desc="Diary visibility" checked={a.oversight_appointments} onChange={(v) => patch({ oversight_appointments: v })} />
            <ToggleRow label="Incidents" desc="Adverse events & complaints" checked={a.oversight_incidents} onChange={(v) => patch({ oversight_incidents: v })} />
            <ToggleRow label="Clinic pays their MODO seat" desc="Otherwise they subscribe themselves" checked={a.seat_sponsored} onChange={(v) => patch({ seat_sponsored: v })} />
            <ToggleRow label="Allocate a room" desc="Auto-book a room per appointment" checked={a.room_allocation_enabled} onChange={(v) => patch({ room_allocation_enabled: v })} />
            {a.room_allocation_enabled && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Room</Label>
                  <Select value={a.room_id ?? "none"} onValueChange={(v) => patch({ room_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Choose a room" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No room</SelectItem>
                      {data.rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name} ({r.quantity} unit{r.quantity === 1 ? "" : "s"})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ToggleRow label="Close their diary with no room" desc="Blocks slots when the room is full" checked={a.block_when_no_room} onChange={(v) => patch({ block_when_no_room: v })} />
                <ToggleRow label="Charge room rent" desc="Bill the hourly rate per booking" checked={a.charge_room_rent} onChange={(v) => patch({ charge_room_rent: v })} />
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-none">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

/* ---------------------------------- Patients --------------------------------- */

function PatientsTab({ id, allowed }: { id: string; allowed: boolean }) {
  const patientsFn = useServerFn(getAssociatePatients);
  const [search, setSearch] = useState("");
  const [openClient, setOpenClient] = useState<string | null>(null);
  const { data: patients } = useQuery({
    queryKey: ["associate-patients", id, search],
    queryFn: () => patientsFn({ data: { id, search: search || null } }),
    enabled: allowed,
  });

  if (!allowed)
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        No shared clinical records yet. Records appear once the associate accepts the invite and record sharing stays on.
      </CardContent></Card>
    );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {(patients ?? []).length === 0 && <p className="text-sm text-muted-foreground">No patients found.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {(patients ?? []).map((p: any) => (
          <button key={p.id} onClick={() => setOpenClient(p.id)} className="rounded-xl border p-3 text-left hover:bg-muted/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.full_name || "Unnamed patient"}</div>
                <div className="truncate text-xs text-muted-foreground">{p.email || p.phone || "No contact details"}</div>
              </div>
              {p.has_allergies && <Badge variant="destructive" className="shrink-0 text-[10px]">Allergy</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>{p.visits} visit{p.visits === 1 ? "" : "s"}</span>
              <span>Last {fmt(p.last)}</span>
              <span>Next {fmt(p.next)}</span>
            </div>
          </button>
        ))}
      </div>
      {openClient && (
        <PatientRecordDialog
          id={id}
          clientId={openClient}
          clientName={(patients ?? []).find((p: any) => p.id === openClient)?.full_name ?? null}
          onClose={() => setOpenClient(null)}
        />
      )}
    </div>
  );
}

const LAWFUL_BASES = [
  "Clinical governance / supervision",
  "Complaint or incident investigation",
  "Safeguarding concern",
  "Audit or regulatory inspection",
  "Continuity of care",
];

/**
 * Two-stage: the clinic owner must tick the consent statements and log a
 * reason before the record is fetched. Every open writes to the shared
 * audit trail the associate can also see.
 */
function PatientRecordDialog({
  id,
  clientId,
  clientName,
  onClose,
}: {
  id: string;
  clientId: string;
  clientName?: string | null;
  onClose: () => void;
}) {
  const openFn = useServerFn(openAssociatePatientRecord);
  const qc = useQueryClient();
  const [record, setRecord] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [basis, setBasis] = useState(LAWFUL_BASES[0]!);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = c1 && c2 && c3 && reason.trim().length >= 4;

  async function unlock() {
    setBusy(true);
    try {
      const r = await openFn({
        data: { id, clientId, reason, lawfulBasis: basis, consentClinical: c1, consentMinimum: c2, consentLogged: c3 },
      });
      setRecord(r);
      qc.invalidateQueries({ queryKey: ["associate-access-log", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open the record");
    } finally {
      setBusy(false);
    }
  }

  const c: any = record?.client;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:w-full sm:max-w-4xl sm:rounded-lg">
        <DialogHeader className="border-b bg-muted/30 px-4 py-3 text-left sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold">
              {initials(c?.full_name ?? clientName)}
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base sm:text-lg">{c?.full_name ?? clientName ?? "Patient record"}</DialogTitle>
              <p className="truncate text-[11px] text-muted-foreground">
                {record ? "Read-only clinical record · access logged" : "Locked — confirm a reason to open"}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">


        {!record && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" /> Confirm before opening
              </div>
              <p className="mt-1 text-muted-foreground">
                This is another clinician's patient. Opening the record is recorded and shared with the associate.
                Financial information is never shown.
              </p>
            </div>

            <div className="space-y-3">
              <ConsentTick checked={c1} onChange={setC1} label="I have a legitimate clinical or governance reason to view this record." />
              <ConsentTick checked={c2} onChange={setC2} label="I will view only the minimum information needed and keep it confidential." />
              <ConsentTick checked={c3} onChange={setC3} label="I understand this access is logged and visible to the associate." />
            </div>

            <div className="space-y-1.5">
              <Label>Lawful basis</Label>
              <Select value={basis} onValueChange={setBasis}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LAWFUL_BASES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Reason for access</Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Reviewing consent and aftercare following a patient complaint on 12 May"
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={unlock} disabled={!ready || busy}>{busy ? "Opening…" : "Open record"}</Button>
            </DialogFooter>
          </div>
        )}

        {record && (
          <div className="space-y-5 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Email" value={c.email} />
              <Field label="Phone" value={c.phone} />
              <Field label="Date of birth" value={c.dob ? fmt(c.dob) : null} />
              <Field label="Emergency contact" value={[c.emergency_contact_name, c.emergency_contact_phone].filter(Boolean).join(" · ")} />
              <Field label="GP" value={c.gp_name} />
              <Field label="Address" value={[c.address_line1, c.city, c.postcode].filter(Boolean).join(", ")} />
            </div>

            {(c.has_allergies || c.allergies) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="font-medium text-destructive">Allergies</div>
                <div className="text-xs">{c.allergies || "Flagged — see notes"}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Chip label="Appointments" value={record.appointments.length} />
              <Chip label="Consultations" value={record.consultations.length} />
              <Chip label="Notes" value={record.notes.length} />
              <Chip label="Forms" value={record.forms.length} />
              <Chip label="Consents" value={record.consents.length} />
              <Chip label="Files" value={record.files.length} />
            </div>

            <Tabs defaultValue="clinical">
              <TabsList className="flex w-full overflow-x-auto">
                <TabsTrigger value="clinical">Clinical</TabsTrigger>
                <TabsTrigger value="consultations">Consultations</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="forms">Forms &amp; consents</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="audit">Access log</TabsTrigger>
              </TabsList>


              <TabsContent value="clinical" className="space-y-5 pt-4">
                <Section title={`Concerns (${record.concerns.length})`}>
                  {record.concerns.map((x: any) => (
                    <Row key={x.id} title={x.label} meta={`${x.severity ?? ""}${x.resolved ? " · resolved" : ""}`} body={x.notes} />
                  ))}
                </Section>
                <Section title={`Medications (${record.medications.length})`}>
                  {record.medications.map((m: any) => (
                    <Row key={m.id} title={`${m.drug}${m.dose ? ` — ${m.dose}` : ""}`} meta={m.is_current ? "current" : "stopped"} body={m.notes} />
                  ))}
                </Section>
                <Section title={`Prescriptions (${record.prescriptions.length})`}>
                  {record.prescriptions.map((p: any) => (
                    <Row
                      key={p.id}
                      title={`${p.product ?? "Prescription"}${p.dose ? ` — ${p.dose}` : ""}`}
                      meta={[p.prescribed_on ? fmt(p.prescribed_on) : null, p.prescriber_name].filter(Boolean).join(" · ")}
                      body={p.directions}
                    />
                  ))}
                </Section>
              </TabsContent>

              <TabsContent value="consultations" className="space-y-3 pt-4">
                {record.consultations.length === 0 && <p className="text-xs text-muted-foreground">No consultations recorded.</p>}
                {record.consultations.map((x: any) => (
                  <ConsultationCard key={x.id} consultation={x} />
                ))}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 pt-4">
                <Section title={`Clinical notes (${record.notes.length})`}>
                  {record.notes.map((n: any) => (
                    <Row key={n.id} title={new Date(n.created_at).toLocaleString("en-GB")} meta={n.visible_to_patient ? "shared with patient" : undefined} body={n.body} />
                  ))}
                </Section>
              </TabsContent>

              <TabsContent value="forms" className="space-y-5 pt-4">
                <Section title={`Medical forms (${record.forms.length})`}>
                  {record.forms.map((f: any) => (
                    <MedicalFormRow key={f.id} form={f} />
                  ))}
                </Section>
                <Section title={`Consents (${record.consents.length})`}>
                  {record.consents.map((x: any) => (
                    <Row key={x.id} title={x.consent_templates?.name ?? "Consent"} meta={x.signed_at ? `signed ${fmt(x.signed_at)}` : x.status ?? "unsigned"} />
                  ))}
                </Section>
              </TabsContent>

              <TabsContent value="appointments" className="space-y-3 pt-4">
                <Section title={`Appointments (${record.appointments.length})`}>
                  {record.appointments.map((x: any) => (
                    <Row
                      key={x.id}
                      title={x.treatments?.name ?? x.treatment_name_snapshot ?? "Appointment"}
                      meta={`${fmt(x.scheduled_date)} ${String(x.start_time).slice(0, 5)} · ${x.status}`}
                      body={x.notes}
                    />
                  ))}
                </Section>
              </TabsContent>

              <TabsContent value="files" className="space-y-2 pt-4">
                {record.files.length === 0 && <p className="text-xs text-muted-foreground">No files.</p>}
                {record.files.map((f: any) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border p-2 text-xs hover:bg-muted/50">
                    <Paperclip className="h-3.5 w-3.5" /> {f.filename ?? f.kind}
                  </a>
                ))}
              </TabsContent>

              <TabsContent value="audit" className="space-y-2 pt-4">
                <PatientAccessLog id={id} clientId={clientId} />
              </TabsContent>
            </Tabs>

            <p className="text-[11px] text-muted-foreground">
              Read-only clinical view — no payment or invoice data. This access has been logged and is visible to the associate.
            </p>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]">
      <strong className="font-semibold">{value}</strong> {label}
    </span>
  );
}

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]!.toUpperCase()).join("") || "?";
}

function PatientAccessLog({ id, clientId }: { id: string; clientId: string }) {
  const logFn = useServerFn(listAssociateAccessLog);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["associate-access-log", id, clientId],
    queryFn: () => logFn({ data: { id, clientId } }),
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if ((rows ?? []).length === 0) return <p className="text-xs text-muted-foreground">No previous access recorded.</p>;
  return (
    <div className="space-y-2">
      {(rows ?? []).map((r: any) => (
        <div key={r.id} className="rounded-lg border p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{r.actor_name ?? "Clinic owner"}</span>
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("en-GB")}</span>
          </div>
          {r.lawful_basis && <div className="mt-1 text-muted-foreground">{r.lawful_basis}</div>}
          {r.reason && <p className="mt-1">{r.reason}</p>}
        </div>
      ))}
    </div>
  );
}


function ConsentTick({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}

function ConsultationCard({ consultation }: { consultation: any }) {
  const [open, setOpen] = useState(false);
  const blocks: { label: string; value: unknown }[] = [
    { label: "Medical history", value: consultation.medical },
    { label: "Concerns", value: consultation.concerns },
    { label: "Assessment", value: consultation.assessment },
    { label: "Treatment plan", value: consultation.treatment_plan },
    { label: "Treatment log", value: consultation.treatment_log },
    { label: "Consent", value: consultation.consent },
    { label: "Notes", value: consultation.notes },
  ];
  return (
    <div className="rounded-lg border p-3">
      <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="text-sm font-medium">Consultation · {fmt(consultation.created_at)}</div>
          <div className="text-[11px] text-muted-foreground">
            {consultation.completed_at ? `Completed ${fmt(consultation.completed_at)}` : `In progress · ${consultation.status ?? "draft"}`}
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">{open ? "Hide" : "View"}</Badge>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {blocks
            .filter((b) => b.value && (typeof b.value !== "object" || Object.keys(b.value as object).length > 0))
            .map((b) => (
              <div key={b.label} className="rounded-md bg-muted/40 p-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{b.label}</div>
                <div className="mt-1 text-[12px]">
                  <PrettyValue value={b.value} />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** Human-readable label from a snake_case key. */
function prettyLabel(key: string) {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Renders clinical JSON (assessment, treatment plan, medical answers) as
 * readable text instead of raw code. Face-map pin arrays are summarised.
 */
function PrettyValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value === "number") return <span>{value}</span>;
  if (typeof value === "string") {
    if (value.startsWith("data:image")) return <img src={value} alt="" className="max-h-20 rounded border bg-white" />;
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">None</span>;
    // Injection-point style arrays: summarise rather than dump coordinates.
    const isPins = value.every((v) => v && typeof v === "object" && ("x" in (v as any)) && ("y" in (v as any)));
    if (isPins) {
      const byCat = new Map<string, number>();
      for (const p of value as any[]) {
        const k = p.category || "Points";
        byCat.set(k, (byCat.get(k) ?? 0) + 1);
      }
      return (
        <div className="flex flex-wrap gap-1">
          {[...byCat.entries()].map(([k, n]) => (
            <Badge key={k} variant="secondary" className="text-[10px]">
              {prettyLabel(k)} · {n} point{n === 1 ? "" : "s"}
            </Badge>
          ))}
        </div>
      );
    }
    return (
      <ul className="list-disc space-y-1 pl-4">
        {value.map((v, i) => (
          <li key={i}><PrettyValue value={v} depth={depth + 1} /></li>
        ))}
      </ul>
    );
  }

  const obj = value as Record<string, unknown>;
  if (typeof obj.dataUrl === "string") {
    return <img src={obj.dataUrl} alt="Signature" className="max-h-20 rounded border bg-white" />;
  }
  // Saved face maps render as the annotated diagram, not as raw coordinates.
  if (Array.isArray(obj.pins) || Array.isArray(obj.strokes)) {
    return <FaceMapView value={obj} className="max-w-[240px]" />;
  }

  const entries = Object.entries(obj).filter(
    ([k, v]) =>
      v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0) &&
      !/(^|_)ids?$|token/i.test(k),
  );
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={depth > 0 ? "space-y-1 border-l pl-2" : "space-y-1.5"}>
      {entries.map(([k, v]) => {
        const simple = v === null || ["string", "number", "boolean"].includes(typeof v);
        return (
          <div key={k} className={simple ? "flex flex-wrap gap-x-2" : ""}>
            <span className="text-[11px] font-medium text-muted-foreground">{prettyLabel(k)}</span>
            <div className={simple ? "" : "mt-0.5"}>
              <PrettyValue value={v} depth={depth + 1} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MedicalFormRow({ form }: { form: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="text-sm font-medium">{form.medical_form_templates?.name ?? "Medical form"}</div>
          <div className="text-[11px] text-muted-foreground">
            {form.submitted_at ? `Submitted ${fmt(form.submitted_at)}` : `Status: ${form.status ?? "pending"}`}
          </div>
        </div>
        {form.response && <Badge variant="secondary" className="shrink-0 text-[10px]">{open ? "Hide" : "View"}</Badge>}
      </button>
      {open && form.response && (
        <div className="mt-2 space-y-3 rounded-md bg-muted/40 p-2 text-[12px]">
          <FormAnswers schema={form.medical_form_templates?.schema} response={form.response} />
        </div>
      )}
    </div>
  );
}

/**
 * Renders a submitted medical form using the template's own question labels,
 * falling back to a plain readable list when no schema is available.
 */
function FormAnswers({ schema, response }: { schema: any; response: Record<string, any> }) {
  const steps = (schema?.steps ?? []) as { id: string; title?: string; elements?: any[] }[];
  const skip = ["heading", "paragraph", "separator", "space", "info"];
  if (!steps.length) return <PrettyValue value={response} />;
  return (
    <>
      {steps.map((s, si) => {
        const els = (s.elements ?? []).filter((el) => !skip.includes(el.type));
        if (!els.length) return null;
        return (
          <div key={s.id ?? si} className="space-y-1">
            {s.title && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</div>
            )}
            <div className="rounded-md bg-background/60 p-2">
              {els.map((el) => (
                <div key={el.id} className="grid grid-cols-[110px_1fr] gap-2 border-b py-1 last:border-0">
                  <div className="text-[11px] text-muted-foreground">{el.label ?? el.text ?? "Question"}</div>
                  <div><AnswerValue value={response?.[el.id]} type={el.type} /></div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function AnswerValue({ value, type }: { value: any; type?: string }) {
  const isGroup = type === "checkbox_group" || type === "checkboxes";
  const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  if (empty) return <span className="text-muted-foreground">{isGroup ? "None of the above" : "—"}</span>;
  if (typeof value === "string" && value.startsWith("data:image")) {
    return <img src={value} alt="Signature" className="max-h-20 rounded border bg-white" />;
  }
  if (value && typeof value === "object" && "dataUrl" in value) {
    return <img src={(value as any).dataUrl} alt="Signature" className="max-h-20 rounded border bg-white" />;
  }
  if (Array.isArray(value) && value.every((v) => typeof v !== "object")) {
    return <span className="whitespace-pre-wrap">{value.join(", ")}</span>;
  }
  return <PrettyValue value={value} />;
}

/* --------------------------------- Access log -------------------------------- */

function AccessLogTab({ id }: { id: string }) {
  const logFn = useServerFn(listAssociateAccessLog);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["associate-access-log", id],
    queryFn: () => logFn({ data: { id } }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record access log</CardTitle>
        <CardDescription>
          Every time you open one of this associate's patient records it's recorded here — and they see the same list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (rows ?? []).length === 0 && <p className="text-sm text-muted-foreground">No records opened yet.</p>}
        {(rows ?? []).map((r: any) => (
          <div key={r.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">{r.client_name ?? "Patient record"}</div>
              <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("en-GB")}</div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {r.actor_name ?? "Clinic owner"}
              {r.lawful_basis ? ` · ${r.lawful_basis}` : ""}
            </div>
            {r.reason && <p className="mt-2 text-xs">{r.reason}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {empty ? <p className="text-xs text-muted-foreground">Nothing recorded.</p> : children}
    </div>
  );
}

function Row({ title, meta, body }: { title: string; meta?: string; body?: string | null }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{title}</div>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      {body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

/* -------------------------------- Appointments ------------------------------- */

function AppointmentsTab({ id }: { id: string }) {
  const oversight = useServerFn(getAssociateOversight);
  const { data } = useQuery({ queryKey: ["associate-oversight", id], queryFn: () => oversight({ data: { id } }) });
  const appts: any[] = (data as any)?.appointments ?? [];
  if (!appts.length) return <p className="text-sm text-muted-foreground">Nothing to show.</p>;
  return (
    <div className="space-y-2">
      {appts.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div>
            <div className="font-medium">{a.patient_name}</div>
            <div className="text-xs text-muted-foreground">
              {a.treatments?.name ?? "Appointment"} · {fmt(a.scheduled_date)} {String(a.start_time).slice(0, 5)}
            </div>
          </div>
          <Badge variant="secondary">{a.status}</Badge>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Compliance -------------------------------- */

const emptyDoc = {
  docId: null as string | null,
  kind: "contract",
  title: "",
  reference_number: "",
  outcome: "",
  issued_on: "",
  expires_on: "",
  notes: "",
};

function ComplianceTab({ id, documents, onChange }: { id: string; documents: any[]; onChange: () => void }) {
  const save = useServerFn(saveAssociateDocument);
  const del = useServerFn(deleteAssociateDocument);
  const upload = useServerFn(uploadAssociateDocumentFile);
  const signed = useServerFn(getAssociateDocumentUrl);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDoc);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      let file_path: string | null = null;
      let file_name: string | null = null;
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = "";
        buf.forEach((b) => (bin += String.fromCharCode(b)));
        const res = await upload({ data: { id, fileName: file.name, contentType: file.type, base64: btoa(bin) } });
        file_path = res.path;
        file_name = res.fileName;
      }
      await save({ data: { ...form, id, file_path, file_name } });
      toast.success("Saved");
      setOpen(false);
      setForm(emptyDoc);
      setFile(null);
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Contracts, DBS/PVG outcomes, insurance and registrations you hold on file.</p>
        <Button size="sm" className="rounded-full" onClick={() => { setForm(emptyDoc); setFile(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>

      {documents.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No documents recorded yet.</CardContent></Card>
      )}

      {documents.map((d) => {
        const expired = d.expires_on && d.expires_on < new Date().toISOString().slice(0, 10);
        return (
          <Card key={d.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">{d.title}</CardTitle>
                  <CardDescription>
                    {DOC_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind}
                    {d.reference_number ? ` · Ref ${d.reference_number}` : ""}
                    {d.outcome ? ` · ${d.outcome}` : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {expired ? <Badge variant="destructive">Expired</Badge> : d.expires_on ? <Badge variant="secondary">Expires {fmt(d.expires_on)}</Badge> : null}
                  {d.file_path && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { url } = await signed({ data: { docId: d.id } });
                          window.open(url, "_blank", "noopener");
                        } catch (e: any) {
                          toast.error(e?.message ?? "Could not open file");
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" /> File
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Delete this document?")) return;
                      await del({ data: { docId: d.id } });
                      onChange();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <div>Issued {fmt(d.issued_on)}{d.file_name ? ` · ${d.file_name}` : ""}</div>
              {d.notes && <p className="whitespace-pre-wrap text-sm text-foreground">{d.notes}</p>}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add a document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enhanced DBS certificate" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Reference number</Label>
                <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Outcome</Label>
                <Input value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="Clear" />
              </div>
              <div className="space-y-1.5">
                <Label>Issued</Label>
                <Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Expires</Label>
                <Input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Upload (optional)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------- Meetings ---------------------------------- */

function MeetingsTab({ id, meetings, onChange }: { id: string; meetings: any[]; onChange: () => void }) {
  const save = useServerFn(saveAssociateMeeting);
  const del = useServerFn(deleteAssociateMeeting);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    met_at: new Date().toISOString().slice(0, 10),
    title: "",
    attendees: "",
    notes: "",
    actions: "",
    next_meeting_on: "",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Supervision and governance meetings held with this associate.</p>
        <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Log meeting
        </Button>
      </div>

      {meetings.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No meetings recorded yet.</CardContent></Card>
      )}

      {meetings.map((m) => (
        <Card key={m.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base">{m.title}</CardTitle>
                <CardDescription>
                  {fmt(m.met_at)}{m.attendees ? ` · ${m.attendees}` : ""}
                  {m.next_meeting_on ? ` · next ${fmt(m.next_meeting_on)}` : ""}
                </CardDescription>
              </div>
              <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete this meeting?")) { await del({ data: { meetingId: m.id } }); onChange(); } }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {m.notes && <p className="whitespace-pre-wrap">{m.notes}</p>}
            {m.actions && <p className="whitespace-pre-wrap text-muted-foreground"><strong>Actions:</strong> {m.actions}</p>}
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log a meeting</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Quarterly supervision" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.met_at} onChange={(e) => setForm({ ...form, met_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Next meeting</Label>
                <Input type="date" value={form.next_meeting_on} onChange={(e) => setForm({ ...form, next_meeting_on: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Attendees</Label>
              <Input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder="Dr Smith, Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Actions agreed</Label>
              <Textarea rows={2} value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await save({ data: { ...form, id, next_meeting_on: form.next_meeting_on || null } });
                  toast.success("Meeting logged");
                  setOpen(false);
                  setForm({ met_at: new Date().toISOString().slice(0, 10), title: "", attendees: "", notes: "", actions: "", next_meeting_on: "" });
                  onChange();
                } catch (e: any) {
                  toast.error(e?.message ?? "Could not save");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------- Incidents --------------------------------- */

function IncidentsTab({ id, onChange }: { id: string; onChange: () => void }) {
  const oversight = useServerFn(getAssociateOversight);
  const saveIncident = useServerFn(saveAssociateIncident);
  const resolve = useServerFn(setIncidentResolved);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["associate-oversight", id], queryFn: () => oversight({ data: { id } }) });
  const [incident, setIncident] = useState({
    title: "",
    severity: "minor",
    description: "",
    action_taken: "",
    occurred_at: new Date().toISOString().slice(0, 10),
  });

  const incidents: any[] = (data as any)?.incidents ?? [];
  const reload = () => {
    qc.invalidateQueries({ queryKey: ["associate-oversight", id] });
    onChange();
  };

  return (
    <div className="space-y-3">
      {incidents.map((i) => (
        <div key={i.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" /> {i.title}</div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{i.severity}</Badge>
              {!i.resolved_at && (
                <Button size="sm" variant="outline" onClick={async () => { await resolve({ data: { id: i.id, resolved: true } }); reload(); }}>
                  Mark resolved
                </Button>
              )}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{fmt(i.occurred_at)}{i.resolved_at ? " · resolved" : ""}</div>
          {i.description && <p className="mt-2 whitespace-pre-wrap">{i.description}</p>}
          {i.action_taken && <p className="mt-2 text-muted-foreground"><strong>Action:</strong> {i.action_taken}</p>}
        </div>
      ))}

      <div className="space-y-2 rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Log an incident</div>
        <Input placeholder="Title" value={incident.title} onChange={(e) => setIncident({ ...incident, title: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input type="date" value={incident.occurred_at} onChange={(e) => setIncident({ ...incident, occurred_at: e.target.value })} />
          <Select value={incident.severity} onValueChange={(v) => setIncident({ ...incident, severity: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea rows={3} placeholder="What happened?" value={incident.description} onChange={(e) => setIncident({ ...incident, description: e.target.value })} />
        <Textarea rows={2} placeholder="Action taken" value={incident.action_taken} onChange={(e) => setIncident({ ...incident, action_taken: e.target.value })} />
        <Button
          size="sm"
          onClick={async () => {
            if (!incident.title.trim()) return toast.error("Add a title");
            await saveIncident({
              data: {
                link_id: id,
                occurred_at: new Date(incident.occurred_at).toISOString(),
                severity: incident.severity,
                title: incident.title,
                description: incident.description,
                action_taken: incident.action_taken,
                resolved: false,
              },
            });
            toast.success("Incident logged");
            setIncident({ title: "", severity: "minor", description: "", action_taken: "", occurred_at: new Date().toISOString().slice(0, 10) });
            reload();
          }}
        >
          Save incident
        </Button>
      </div>
    </div>
  );
}
