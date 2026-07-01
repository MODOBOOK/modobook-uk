import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getClient, upsertClient, deleteClient,
  listClientNotes, upsertClientNote, deleteClientNote, toggleClientNoteVisibility,
  listClientFiles, addClientFile, deleteClientFile,
  listClientPrescriptions, upsertClientPrescription, deleteClientPrescription,
} from "@/lib/clients.functions";
import { listMyAppointments } from "@/lib/availability.functions";
import { listConsultationsForPatient, createConsultation } from "@/lib/consultations.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Mail, Phone as PhoneIcon, MessageSquare, Edit2, Plus, Trash2, Camera,
  Upload, FileText, AlertTriangle, Download, Loader2, ClipboardList, X, Check,
  CalendarPlus, CreditCard, FileSignature, Send,
} from "lucide-react";
import { toast } from "sonner";
import { ConcernsCard } from "@/components/patient/ConcernsCard";
import { CommsTimeline } from "@/components/patient/CommsTimeline";
import { EmailComposerDialog } from "@/components/patient/EmailComposerDialog";
import { SendFormDialog } from "@/components/patient/SendFormDialog";
import { ClientFormsList } from "@/components/patient/ClientFormsList";
import { ConsultationDocCard } from "@/components/patient/ConsultationDocCard";
import { TreatmentTimeline } from "@/components/patient/TreatmentTimeline";
import { logCommunication } from "@/lib/patient-hub.functions";


export const Route = createFileRoute("/_authenticated/dashboard/patients/$id")({
  ssr: false,
  component: PatientProfilePage,
});

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("") || "?";
}

function age(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function formatDob(dob?: string | null) {
  if (!dob) return "";
  // Stored as YYYY-MM-DD → display DD/MM/YYYY
  const m = String(dob).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return String(dob);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function PatientProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getClient);
  const upsert = useServerFn(upsertClient);
  const remove = useServerFn(deleteClient);
  const listAppt = useServerFn(listMyAppointments);
  const listConsults = useServerFn(listConsultationsForPatient);
  const createConsult = useServerFn(createConsultation);
  const profileFn = useServerFn(getMyProfile);

  const [client, setClient] = useState<any>(null);
  const [clinicName, setClinicName] = useState("");
  const [appts, setAppts] = useState<any[]>([]);
  const [consults, setConsults] = useState<any[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [editing, setEditing] = useState<null | "personal" | "emergency">(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sendFormOpen, setSendFormOpen] = useState(false);
  const [commsRefresh, setCommsRefresh] = useState(0);
  const logComm = useServerFn(logCommunication);


  async function reload() {
    const c: any = await get({ data: { id } });
    setClient(c);
    const [a, p] = await Promise.all([listAppt(), profileFn()]);
    setAppts((a as any[]).filter(x =>
      (c.email && x.patient_email?.toLowerCase() === c.email.toLowerCase()) ||
      (!c.email && x.patient_name?.toLowerCase() === c.full_name.toLowerCase())
    ));
    if (p && typeof p === "object" && "id" in p) {
      setProfileId((p as any).id);
      setClinicName((p as any).clinic_name || (p as any).full_name || "");
    }
    const cs: any = await listConsults({ data: { email: c.email || undefined, name: c.email ? undefined : c.full_name } });
    setConsults(cs ?? []);
  }


  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  async function uploadAvatar(file: File) {
    if (!profileId) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${profileId}/clients/${id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("clinic-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data } = await supabase.storage.from("clinic-assets").createSignedUrl(path, TEN_YEARS);
    if (!data) return;
    await upsert({ data: { id, full_name: client.full_name, avatar_url: data.signedUrl } });
    toast.success("Photo updated");
    reload();
  }

  async function archive() {
    if (!confirm(client.archived ? "Reactivate this patient?" : "Deactivate this patient?")) return;
    await upsert({ data: { id, full_name: client.full_name, archived: !client.archived } });
    reload();
  }
  async function exportPatient() {
    const blob = new Blob([JSON.stringify({ client, appts, consults }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${client.full_name.replace(/\s+/g, "_")}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  async function fullDelete() {
    if (!confirm("Permanently delete this patient and all their records?")) return;
    await remove({ data: { id } });
    navigate({ to: "/dashboard/patients" });
  }

  if (!client) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const visibleAppts = showCancelled ? appts : appts.filter(a => a.status !== "cancelled");

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/patients" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />All patients
        </Link>
      </div>

      {/* Quick actions bar */}
      <div className="sticky top-0 z-10 -mx-2 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
        <Button size="sm" variant="default" asChild>
          <Link to="/dashboard/new-appointment"><CalendarPlus className="mr-1.5 h-4 w-4" />Book</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)} disabled={!client.email}>
          <Mail className="mr-1.5 h-4 w-4" />Email
        </Button>
        {client.phone && (
          <Button size="sm" variant="outline" asChild onClick={async () => {
            await logComm({ data: { clientId: id, channel: "sms", body: "(opened SMS app)" } }); setCommsRefresh(x => x + 1);
          }}>
            <a href={`sms:${client.phone}`}><MessageSquare className="mr-1.5 h-4 w-4" />SMS</a>
          </Button>
        )}
        {client.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">
              <MessageSquare className="mr-1.5 h-4 w-4" />WhatsApp
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link to="/dashboard/payments"><CreditCard className="mr-1.5 h-4 w-4" />Payment link</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSendFormOpen(true)}>
          <FileText className="mr-1.5 h-4 w-4" />Send form
        </Button>
        <Button size="sm" variant="outline" onClick={async () => {
          try {
            const r: any = await createConsult({ data: { patient_name: client.full_name, patient_email: client.email || undefined, patient_phone: client.phone || undefined, patient_id: client.id } });
            if (!r?.id) throw new Error("No consultation id returned");
            window.location.href = `/dashboard/consultations/${r.id}`;
          } catch (e: any) {
            console.error("start consultation failed", e);
            toast.error(e?.message || "Could not start consultation");
          }
        }}>
          <ClipboardList className="mr-1.5 h-4 w-4" />Start consultation
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:items-center sm:text-left">
          <AvatarUpload client={client} onUpload={uploadAvatar} />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{client.full_name}</h1>
              {client.has_allergies && (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Allergy</Badge>
              )}
              {client.archived && <Badge variant="secondary">Inactive</Badge>}
            </div>
            {client.phone && <div className="text-sm font-semibold">{client.phone}</div>}
            {client.email && <div className="text-sm text-muted-foreground">{client.email}</div>}
            {client.has_allergies && client.allergies && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                <strong>Allergies:</strong> {client.allergies}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 min-w-0">


      {/* Personal details */}
      <Section title="Personal details" onEdit={() => setEditing("personal")}>
        <Row label="DOB (Age)" value={client.dob ? `${formatDob(client.dob)}${age(client.dob) != null ? ` (${age(client.dob)})` : ""}` : ""} />
        <Row label="Gender" value={client.gender} />
        <Row label="County" value={client.county} />
        <Row label="Address line 1" value={client.address_line1 || client.address} />
        <Row label="Address line 2" value={client.address_line2} />
        <Row label="Postcode" value={client.postcode} />
        <Row label="Preferred contact" value={client.preferred_contact} />
        <Row label="Marketing opt-in" value={client.marketing_opt_in ? "✓ Yes" : "No"} />
        <Row label="How did you hear about us?" value={client.how_heard} />
      </Section>

      {/* Emergency contact */}
      <Section title="Emergency contact details" onEdit={() => setEditing("emergency")}>
        <Row label="GP name" value={client.gp_name} />
        <Row label="GP address" value={client.gp_address} />
        <Row label="Emergency contact name" value={client.emergency_contact_name} />
        <Row label="Emergency contact phone" value={client.emergency_contact_phone} />
      </Section>

      {/* Medical forms (sent / completed) */}
      <Section title="Medical forms">
        <ClientFormsList
          client={{ id: client.id, full_name: client.full_name, email: client.email, phone: client.phone }}
          clinicName={clinicName}
          refreshKey={commsRefresh}
        />
      </Section>

      <SectionDark
        title="Appointments"
        actions={
          <>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setShowCancelled(s => !s)}>
              {showCancelled ? "Hide cancelled" : "Show cancelled"}
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/dashboard/new-appointment"><Plus className="mr-1 h-3.5 w-3.5" />New</Link>
            </Button>
          </>
        }
      >
        {visibleAppts.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No appointments.</div>
        ) : visibleAppts.map(a => (
          <div key={a.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
            <div className="min-w-0">
              <div className="font-medium">{new Date(a.scheduled_date + "T" + a.start_time).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              <div className="text-xs uppercase tracking-wider text-primary">{a.treatments?.name ?? "Treatment"}</div>
            </div>
            <Badge variant={a.status === "cancelled" ? "destructive" : "outline"}>{a.status}</Badge>
          </div>
        ))}
      </SectionDark>

      {/* Consultations */}
      <Section title="Consultations" actionsRight={
        <Button size="sm" variant="outline" onClick={async () => {
          const r: any = await createConsult({ data: { patient_name: client.full_name, patient_email: client.email || undefined, patient_phone: client.phone || undefined, patient_id: client.id } });
          navigate({ to: "/dashboard/consultations/$id", params: { id: r.id } });
        }}><Plus className="mr-1 h-3.5 w-3.5" />New</Button>
      }>
        {consults.length === 0 ? (
          <div className="px-1 py-2 text-xs text-muted-foreground">No consultations on file.</div>
        ) : (
          <div className="space-y-2">
            {consults.map(c => (
              <ConsultationDocCard
                key={c.id}
                id={c.id}
                createdAt={c.created_at}
                status={c.status}
                currentStep={c.current_step}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Treatment timeline */}
      <Section title="Treatment timeline">
        <TreatmentTimeline appointments={appts} />
      </Section>


      {/* Notes */}
      <NotesSection clientId={id} />

      {/* Photos */}
      <FilesSection clientId={id} profileId={profileId} kind="photo" title="Photos" />

      {/* Private prescription uploads (PDF or image) */}
      <FilesSection clientId={id} profileId={profileId} kind="pdf" title="Private prescription uploads" />

      {/* Prescriptions (structured records) */}
      <PrescriptionsSection clientId={id} />

      {/* Footer actions */}
      <div className="flex flex-wrap gap-2 pt-4">
        <Button variant="outline" className="flex-1" onClick={archive}>
          {client.archived ? "Reactivate patient" : "Deactivate patient"}
        </Button>
        <Button variant="outline" className="flex-1" onClick={exportPatient}>
          <Download className="mr-1.5 h-3.5 w-3.5" />Export
        </Button>
        <Button variant="ghost" className="text-destructive" onClick={fullDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
        </Button>
      </div>
        </div>

        {/* Right column: activity timeline + concerns */}
        <aside className="space-y-4">
          <ConcernsCard clientId={id} />
          <CommsTimeline clientId={id} refreshKey={commsRefresh} />
        </aside>
      </div>

      {editing && (
        <EditDialog
          client={client}
          which={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      <EmailComposerDialog
        open={emailOpen}
        onOpenChange={(v) => setEmailOpen(v)}
        client={client}
        clinicName={clinicName}
        onSent={() => setCommsRefresh(x => x + 1)}
      />
      <SendFormDialog
        open={sendFormOpen}
        onOpenChange={(v) => setSendFormOpen(v)}
        client={client}
        clinicName={clinicName}
        onSent={() => setCommsRefresh(x => x + 1)}
      />
    </div>
  );
}


/* ---------- subcomponents ---------- */

function Section({ title, children, onEdit, actionsRight }: { title: string; children: React.ReactNode; onEdit?: () => void; actionsRight?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card">
      <div className="flex items-center justify-between bg-muted px-4 py-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h2>
        {onEdit && <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={onEdit}><Edit2 className="mr-1 h-3 w-3" />Edit</Button>}
        {actionsRight}
      </div>
      <div className="space-y-1 p-4">{children}</div>
    </div>
  );
}

function SectionDark({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
        <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
        <div className="flex gap-2">{actions}</div>
      </div>
      <div className="bg-card">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b py-2 last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function AvatarUpload({ client, onUpload }: { client: any; onUpload: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button onClick={() => ref.current?.click()} className="group relative">
      <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-full bg-muted text-2xl font-bold text-muted-foreground">
        {client.avatar_url ? <img src={client.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(client.full_name)}
      </div>
      <div className="absolute inset-x-0 bottom-0 rounded-b-full bg-black/60 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
        + PHOTO
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
    </button>
  );
}

function NotesSection({ clientId }: { clientId: string }) {
  const list = useServerFn(listClientNotes);
  const up = useServerFn(upsertClientNote);
  const del = useServerFn(deleteClientNote);
  const toggleVis = useServerFn(toggleClientNoteVisibility);
  const [rows, setRows] = useState<any[]>([]);
  async function reload() { setRows((await list({ data: { client_id: clientId } })) as any[]); }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);

  async function addNote() {
    const body = prompt("New note");
    if (!body?.trim()) return;
    const share = confirm("Share this note with the patient in their portal?\n\nOK = visible to patient\nCancel = private (practitioner only)");
    await up({ data: { client_id: clientId, body: body.trim(), visible_to_patient: share } });
    reload();
  }

  return (
    <SectionDark
      title="Notes"
      actions={<Button size="sm" variant="secondary" onClick={addNote}><Plus className="mr-1 h-3.5 w-3.5" />New</Button>}
    >
      {rows.length === 0 ? <div className="px-4 py-6 text-center text-xs text-muted-foreground">No notes yet.</div> :
        rows.map(n => (
          <div key={n.id} className="flex items-start justify-between gap-2 border-b p-3 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="whitespace-pre-wrap text-sm">{n.body}</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                {n.visible_to_patient && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">Shared with patient</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <label className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground">
                <Checkbox
                  checked={!!n.visible_to_patient}
                  onCheckedChange={async (v) => { await toggleVis({ data: { id: n.id, visible: !!v } }); reload(); }}
                />
                Share
              </label>
              <Button size="icon" variant="ghost" onClick={() => del({ data: { id: n.id } }).then(reload)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
    </SectionDark>
  );
}


function FilesSection({ clientId, profileId, kind, title }: { clientId: string; profileId: string; kind: "photo" | "pdf"; title: string }) {
  const list = useServerFn(listClientFiles);
  const add = useServerFn(addClientFile);
  const del = useServerFn(deleteClientFile);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function reload() {
    const all = (await list({ data: { client_id: clientId } })) as any[];
    setRows(all.filter(r => r.kind === kind));
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);

  async function onFile(file: File) {
    if (!profileId) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "photo" ? "jpg" : "pdf");
      const path = `${profileId}/clients/${clientId}/${kind}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("clinic-assets").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = await supabase.storage.from("clinic-assets").createSignedUrl(path, TEN_YEARS);
      if (!data) throw new Error("Sign failed");
      await add({ data: { client_id: clientId, kind, url: data.signedUrl, filename: file.name } });
      reload();
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <Section title={title} actionsRight={
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : kind === "photo" ? <Camera className="mr-1 h-3.5 w-3.5" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
        Add
      </Button>
    }>
      <input ref={inputRef} type="file" accept={kind === "photo" ? "image/*" : "application/pdf,image/*"} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {rows.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">No {title.toLowerCase()} yet</div>
      ) : kind === "photo" ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {rows.map(f => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <img src={f.url} alt="" className="h-full w-full object-cover" />
              <button onClick={() => del({ data: { id: f.id } }).then(reload)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        rows.map(f => {
          const isImg = /\.(png|jpe?g|webp|gif|heic)$/i.test(f.filename || f.url || "");
          return (
            <div key={f.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <a href={f.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-primary hover:underline">
                {isImg ? <img src={f.url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : <FileText className="h-4 w-4 shrink-0" />}
                <span className="truncate">{f.filename || "Document"}</span>
              </a>
              <Button size="icon" variant="ghost" onClick={() => del({ data: { id: f.id } }).then(reload)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          );
        })
      )}
    </Section>
  );
}

function PrescriptionsSection({ clientId }: { clientId: string }) {
  const list = useServerFn(listClientPrescriptions);
  const up = useServerFn(upsertClientPrescription);
  const del = useServerFn(deleteClientPrescription);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ product: "", dose: "", directions: "", prescribed_on: "", notes: "" });
  async function reload() { setRows((await list({ data: { client_id: clientId } })) as any[]); }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);
  return (
    <Section title="Prescriptions" actionsRight={<Button size="sm" variant="outline" onClick={() => { setForm({ product: "", dose: "", directions: "", prescribed_on: "", notes: "" }); setOpen(true); }}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>}>
      {rows.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">No prescriptions yet.</div>
      ) : rows.map(r => {
        const isHubRx = typeof r.notes === "string" && r.notes.startsWith("Prescriber:");
        return (
        <div key={r.id} className="flex items-start justify-between gap-2 border-b py-2 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">{r.product}{r.dose ? ` — ${r.dose}` : ""}</div>
              {isHubRx && <Badge variant="secondary" className="text-[10px]">Rx from Prescriber Hub</Badge>}
            </div>
            {r.directions && <div className="text-xs">{r.directions}</div>}
            {r.prescribed_on && <div className="text-[10px] text-muted-foreground">{r.prescribed_on}</div>}
            {r.notes && <div className="text-xs text-muted-foreground whitespace-pre-line">{r.notes}</div>}
          </div>
          <Button size="icon" variant="ghost" onClick={() => del({ data: { id: r.id } }).then(reload)}><X className="h-3.5 w-3.5" /></Button>
        </div>
        );
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New prescription</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <Input placeholder="Product *" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} />
            <Input placeholder="Dose" value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} />
            <Input placeholder="Directions" value={form.directions} onChange={e => setForm({ ...form, directions: e.target.value })} />
            <Input type="date" value={form.prescribed_on} onChange={e => setForm({ ...form, prescribed_on: e.target.value })} />
            <Textarea rows={2} placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!form.product.trim()) { toast.error("Product required"); return; }
              await up({ data: { client_id: clientId, ...form } });
              setOpen(false); reload();
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function EditDialog({ client, which, onClose, onSaved }: { client: any; which: "personal" | "emergency"; onClose: () => void; onSaved: () => void }) {
  const up = useServerFn(upsertClient);
  const [f, setF] = useState<any>(client);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await up({ data: { id: client.id, full_name: client.full_name, ...f } });
      onSaved();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{which === "personal" ? "Edit personal details" : "Edit emergency contact"}</DialogTitle></DialogHeader>
        {which === "personal" ? (
          <div className="grid gap-3">
            <F label="Full name"><Input value={f.full_name ?? ""} onChange={e => setF({ ...f, full_name: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-2">
              <F label="Email"><Input type="email" value={f.email ?? ""} onChange={e => setF({ ...f, email: e.target.value })} /></F>
              <F label="Phone"><Input value={f.phone ?? ""} onChange={e => setF({ ...f, phone: e.target.value })} /></F>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <F label="DOB"><Input type="date" value={f.dob ?? ""} onChange={e => setF({ ...f, dob: e.target.value })} /></F>
              <F label="Gender">
                <Select value={f.gender ?? ""} onValueChange={v => setF({ ...f, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {["Female","Male","Non-binary","Other","Prefer not to say"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
            </div>
            <F label="Address line 1"><Input value={f.address_line1 ?? ""} onChange={e => setF({ ...f, address_line1: e.target.value })} /></F>
            <F label="Address line 2"><Input value={f.address_line2 ?? ""} onChange={e => setF({ ...f, address_line2: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-2">
              <F label="County"><Input value={f.county ?? ""} onChange={e => setF({ ...f, county: e.target.value })} /></F>
              <F label="Postcode"><Input value={f.postcode ?? ""} onChange={e => setF({ ...f, postcode: e.target.value })} /></F>
            </div>
            <F label="Preferred contact">
              <Select value={f.preferred_contact ?? ""} onValueChange={v => setF({ ...f, preferred_contact: v })}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {["Any","Email","Phone","SMS"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!f.marketing_opt_in} onCheckedChange={v => setF({ ...f, marketing_opt_in: !!v })} />
              Marketing preferences (opt-in)
            </label>
            <F label="How did you hear about us?"><Input value={f.how_heard ?? ""} onChange={e => setF({ ...f, how_heard: e.target.value })} /></F>
            <div className="rounded-md border border-red-200 bg-red-50/50 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <Checkbox checked={!!f.has_allergies} onCheckedChange={v => setF({ ...f, has_allergies: !!v })} />
                <AlertTriangle className="h-4 w-4" /> Has allergies
              </label>
              {f.has_allergies && <Textarea rows={2} placeholder="List allergies" value={f.allergies ?? ""} onChange={e => setF({ ...f, allergies: e.target.value })} />}
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <F label="GP name"><Input value={f.gp_name ?? ""} onChange={e => setF({ ...f, gp_name: e.target.value })} /></F>
            <F label="GP address"><Textarea rows={2} value={f.gp_address ?? ""} onChange={e => setF({ ...f, gp_address: e.target.value })} /></F>
            <F label="Emergency contact name"><Input value={f.emergency_contact_name ?? ""} onChange={e => setF({ ...f, emergency_contact_name: e.target.value })} /></F>
            <F label="Emergency contact phone"><Input value={f.emergency_contact_phone ?? ""} onChange={e => setF({ ...f, emergency_contact_phone: e.target.value })} /></F>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
