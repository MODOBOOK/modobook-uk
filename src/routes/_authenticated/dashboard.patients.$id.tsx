import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getClient, upsertClient, deleteClient, permanentlyDeleteClient,
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
  CalendarPlus, CreditCard, FileSignature, Send, ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { toast } from "sonner";
import { ConcernsCard } from "@/components/patient/ConcernsCard";
import { CommsTimeline } from "@/components/patient/CommsTimeline";
import { EmailComposerDialog } from "@/components/patient/EmailComposerDialog";
import { SendFormDialog } from "@/components/patient/SendFormDialog";
import { ClientFormsList } from "@/components/patient/ClientFormsList";
import { ConsultationDocCard } from "@/components/patient/ConsultationDocCard";

import { logCommunication } from "@/lib/patient-hub.functions";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { chargeCardOnFile, removeCardOnFile } from "@/lib/card-on-file.functions";


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
  const removeForever = useServerFn(permanentlyDeleteClient);
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
  const [payLinkOpen, setPayLinkOpen] = useState(false);
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
    if (!confirm("Move this patient to the archive? You can restore them later from the Archived tab.")) return;
    try {
      await remove({ data: { id } });
      toast.success("Patient moved to archive");
      navigate({ to: "/dashboard/patients" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    }
  }

  if (!client) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const visibleAppts = showCancelled ? appts : appts.filter(a => a.status !== "cancelled");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/patients" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />All patients
        </Link>
      </div>

      {/* Quick actions bar — horizontally scrollable on mobile */}
      <div className="sticky top-0 z-10 rounded-xl border bg-card/95 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Button size="sm" variant="default" className="shrink-0" asChild>
            <Link to="/dashboard/new-appointment"><CalendarPlus className="mr-1.5 h-4 w-4" />Book</Link>
          </Button>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEmailOpen(true)} disabled={!client.email}>
            <Mail className="mr-1.5 h-4 w-4" />Email
          </Button>
          {client.phone && (
            <Button size="sm" variant="outline" className="shrink-0" asChild onClick={async () => {
              await logComm({ data: { clientId: id, channel: "sms", body: "(opened SMS app)" } }); setCommsRefresh(x => x + 1);
            }}>
              <a href={`sms:${client.phone}`}><MessageSquare className="mr-1.5 h-4 w-4" />SMS</a>
            </Button>
          )}
          {client.phone && (
            <Button size="sm" variant="outline" className="shrink-0" asChild>
              <a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">
                <MessageSquare className="mr-1.5 h-4 w-4" />WhatsApp
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setPayLinkOpen(true)}>
            <CreditCard className="mr-1.5 h-4 w-4" />Payment link
          </Button>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setSendFormOpen(true)}>
            <FileText className="mr-1.5 h-4 w-4" />Send form
          </Button>
          <Button size="sm" variant="outline" className="shrink-0" onClick={async () => {
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
      </div>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-4 text-center sm:flex-row sm:items-center sm:p-6 sm:text-left">
          <div className="shrink-0"><AvatarUpload client={client} onUpload={uploadAvatar} /></div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="break-words text-xl font-bold sm:text-2xl">{client.full_name}</h1>
              {client.has_allergies && (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Allergy</Badge>
              )}
              {client.archived && <Badge variant="secondary">Inactive</Badge>}
            </div>
            {client.phone && <div className="break-all text-sm font-semibold">{client.phone}</div>}
            {client.email && <div className="break-all text-sm text-muted-foreground">{client.email}</div>}
            {client.has_allergies && client.allergies && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-left text-xs text-red-700">
                <strong>Allergies:</strong> {client.allergies}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">


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
        <div className="mt-2 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/60 p-2 text-xs text-blue-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Address, postcode, DOB, phone and allergies are pulled over automatically when this patient completes a medical form.</span>
        </div>
      </Section>

      {/* Emergency contact */}
      <Section title="Emergency contact details" onEdit={() => setEditing("emergency")}>
        <Row label="GP name" value={client.gp_name} />
        <Row label="GP address" value={client.gp_address} />
        <Row label="Emergency contact name" value={client.emergency_contact_name} />
        <Row label="Emergency contact phone" value={client.emergency_contact_phone} />
        <div className="mt-2 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/60 p-2 text-xs text-blue-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>GP details and next-of-kin / emergency contact are pulled over automatically when this patient completes a medical form.</span>
        </div>
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
        title={`Appointments (${visibleAppts.length})`}
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
          <AppointmentRow key={a.id} appt={a} />
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
      {/* Card on file (for no-show / late cancel charges) */}
      <CardOnFileSection client={client} onReload={reload} />

      {/* Treatment plans */}
      <TreatmentPlansPanel clientId={id} profileId={profileId} />

      {/* Notes */}
      <NotesSection clientId={id} />

      {/* Photos */}
      <FilesSection clientId={id} profileId={profileId} kind="photo" title="Photos" />

      {/* Private prescription uploads (PDF or image) */}
      <FilesSection clientId={id} profileId={profileId} kind="pdf" title="Private prescription uploads" />

      {/* Prescriptions (structured records) */}
      <PrescriptionsSection clientId={id} client={client} profileId={profileId} />
        </div>

        {/* Right column: activity timeline + concerns */}
        <aside className="min-w-0 space-y-4">
          <ConcernsCard clientId={id} />
          <CommsTimeline clientId={id} refreshKey={commsRefresh} />
        </aside>
      </div>

      {/* Footer actions — pinned to the very bottom on all screens */}
      <div className="flex flex-wrap gap-2 pt-6">
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
      <PaymentLinkDialog
        open={payLinkOpen}
        onOpenChange={setPayLinkOpen}
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
      <div className="break-words font-medium">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function AppointmentRow({ appt }: { appt: any }) {
  const [open, setOpen] = useState(false);
  const dt = new Date(appt.scheduled_date + "T" + appt.start_time);
  const dateLabel = dt.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const treatment = appt.treatments?.name ?? "Treatment";
  const priceCents = appt.total_amount_cents ?? appt.price_cents ?? appt.treatments?.price_cents;
  const price = typeof priceCents === "number" ? `£${(priceCents / 100).toFixed(2)}` : null;
  const paid = appt.payment_status === "paid" || appt.status === "paid";
  const location = appt.locations?.name || appt.location_name;
  const practitioner = appt.practitioners?.full_name || appt.practitioner_name;
  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-muted/40"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{dateLabel}</div>
          <div className="truncate text-xs uppercase tracking-wider text-primary">{treatment}</div>
        </div>
        <Badge variant={appt.status === "cancelled" ? "destructive" : "outline"} className="shrink-0">{appt.status}</Badge>
      </button>
      {open && (
        <div className="space-y-1.5 border-t bg-muted/30 px-4 py-3 text-xs">
          {price && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">{price} {paid ? <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[9px]">Paid</Badge> : null}</span>
            </div>
          )}
          {location && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Location</span>
              <span className="break-words text-right font-medium">{location}</span>
            </div>
          )}
          {practitioner && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Practitioner</span>
              <span className="break-words text-right font-medium">{practitioner}</span>
            </div>
          )}
          {appt.duration_minutes && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{appt.duration_minutes} min</span>
            </div>
          )}
          {appt.notes && (
            <div>
              <div className="text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap break-words">{appt.notes}</div>
            </div>
          )}
        </div>
      )}
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

function CardOnFileSection({ client, onReload }: { client: any; onReload: () => void }) {
  const charge = useServerFn(chargeCardOnFile);
  const remove = useServerFn(removeCardOnFile);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("No-show fee");
  const [busy, setBusy] = useState(false);

  const brand = client?.card_brand as string | null | undefined;
  const last4 = client?.card_last4 as string | null | undefined;
  const expM = client?.card_exp_month as number | null | undefined;
  const expY = client?.card_exp_year as number | null | undefined;
  const hasCard = !!(client?.stripe_customer_id && client?.stripe_payment_method_id && last4);

  async function doCharge() {
    const amt = Math.round(Number(amount) * 100);
    if (!amt || amt < 100) {
      toast.error("Enter an amount of £1.00 or more.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Add a reason for the charge.");
      return;
    }
    if (!confirm(`Charge £${(amt / 100).toFixed(2)} to card ending ${last4}?\n\nReason: ${reason}`)) return;
    setBusy(true);
    try {
      await charge({ data: { clientId: client.id, amountCents: amt, description: reason.trim() } });
      toast.success("Card charged.");
      setAmount("");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Charge failed");
    } finally {
      setBusy(false);
    }
  }

  async function doRemove() {
    if (!confirm("Remove this patient's saved card? They'll need to re-consent at their next booking to store a new one.")) return;
    setBusy(true);
    try {
      await remove({ data: { clientId: client.id } });
      toast.success("Card on file removed.");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-medium">Card on file</div>
        </div>
        {!hasCard ? (
          <div className="text-xs text-muted-foreground">
            No card saved. A card is stored automatically when the patient pays online at booking
            (only if you have the “Save card on file” setting on).
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium uppercase">{brand}</span>
              <span className="text-muted-foreground">•••• {last4}</span>
              {expM && expY ? (
                <span className="text-xs text-muted-foreground">
                  exp {String(expM).padStart(2, "0")}/{String(expY).slice(-2)}
                </span>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
              <div>
                <Label className="text-xs">Amount (£)</Label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={busy}
                />
              </div>
              <div>
                <Label className="text-xs">Reason</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="No-show / late-cancel fee"
                  disabled={busy}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" onClick={doCharge} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-1 h-3.5 w-3.5" />}
                  Charge
                </Button>
                <Button size="sm" variant="outline" onClick={doRemove} disabled={busy}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />Remove
                </Button>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Off-session charge — some banks may still require 3-D Secure. If declined for that reason,
              send a fresh payment link instead.
            </div>
          </>
        )}
      </CardContent>
    </Card>
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

function PrescriptionsSection({ clientId, client, profileId }: { clientId: string; client: any; profileId: string }) {
  const list = useServerFn(listClientPrescriptions);
  const up = useServerFn(upsertClientPrescription);
  const del = useServerFn(deleteClientPrescription);
  const profileFn = useServerFn(getMyProfile);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prescriber, setPrescriber] = useState<any>(null);
  const emptyForm = {
    product: "", strength: "", form: "", quantity: "", route: "PO", dose: "",
    directions: "", prescribed_on: new Date().toISOString().slice(0, 10), notes: "",
    prescriber_name: "", prescriber_reg_number: "", prescriber_address: "",
    agree: false, signature_name: "",
  };
  const [form, setForm] = useState<any>(emptyForm);
  const sigRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasSigRef = useRef(false);

  async function reload() { setRows((await list({ data: { client_id: clientId } })) as any[]); }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);

  async function openNew() {
    let p = prescriber;
    if (!p) {
      p = await profileFn();
      setPrescriber(p);
    }
    const clinicAddress = [p?.clinic_address_line1, p?.clinic_address_line2, p?.clinic_city, p?.clinic_postcode].filter(Boolean).join(", ")
      || p?.clinic_address || "";
    setForm({
      ...emptyForm,
      prescriber_name: p?.full_name || "",
      prescriber_reg_number: p?.prescriber_reg_number || p?.gphc_number || p?.gmc_number || p?.nmc_number || "",
      prescriber_address: clinicAddress,
      signature_name: p?.full_name || "",
    });
    setTimeout(() => clearSignature(), 50);
    setOpen(true);
  }

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = sigRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) };
  }
  function onSigDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = sigRef.current!; const ctx = c.getContext("2d")!;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getCanvasPoint(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    drawingRef.current = true; hasSigRef.current = true;
  }
  function onSigMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = sigRef.current!.getContext("2d")!;
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    const p = getCanvasPoint(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function onSigUp() { drawingRef.current = false; }
  function clearSignature() {
    const c = sigRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    hasSigRef.current = false;
  }

  async function save() {
    if (!form.product.trim()) return toast.error("Drug name required");
    if (!form.dose.trim()) return toast.error("Dose required");
    if (!form.quantity.trim()) return toast.error("Quantity required");
    if (!form.directions.trim()) return toast.error("Directions required");
    if (!form.prescriber_name.trim()) return toast.error("Prescriber name required");
    if (!form.prescriber_reg_number.trim()) return toast.error("Prescriber registration number required (GMC/GPhC/NMC)");
    if (!form.prescriber_address.trim()) return toast.error("Prescriber address required");
    if (!hasSigRef.current) return toast.error("Signature required");
    if (!form.agree) return toast.error("Please confirm the prescriber declaration");
    setSaving(true);
    try {
      const signatureDataUrl = sigRef.current!.toDataURL("image/png");
      const patientAddress = [client?.address_line1, client?.address_line2, client?.county, client?.postcode].filter(Boolean).join(", ");
      const signedAt = new Date().toISOString();

      // Build PDF
      const { buildPrescriptionPdf } = await import("@/lib/prescription-pdf");
      const pdf = buildPrescriptionPdf({
        clinic_name: prescriber?.clinic_name,
        clinic_address: prescriber?.clinic_address,
        prescriber_name: form.prescriber_name,
        prescriber_reg_number: form.prescriber_reg_number,
        prescriber_address: form.prescriber_address,
        patient_name: client?.full_name || "",
        patient_dob: client?.dob || null,
        patient_address: patientAddress,
        drug_name: form.product,
        drug_form: form.form,
        drug_strength: form.strength,
        dose: `${form.dose}${form.route ? ` (${form.route})` : ""}`,
        quantity: form.quantity,
        directions: form.directions,
        notes: form.notes,
        signature_name: form.signature_name || form.prescriber_name,
        signature_data_url: signatureDataUrl,
        signed_at: signedAt,
      });
      const pdfBlob = pdf.output("blob");
      const stamp = Date.now();
      const pdfPath = `${profileId}/clients/${clientId}/rx/${stamp}.pdf`;
      const sigPath = `${profileId}/clients/${clientId}/rx/${stamp}-sig.png`;

      const [pdfUp, sigUp] = await Promise.all([
        supabase.storage.from("clinic-assets").upload(pdfPath, pdfBlob, { upsert: false, contentType: "application/pdf" }),
        supabase.storage.from("clinic-assets").upload(sigPath, await (await fetch(signatureDataUrl)).blob(), { upsert: false, contentType: "image/png" }),
      ]);
      if (pdfUp.error) throw pdfUp.error;
      if (sigUp.error) throw sigUp.error;
      const [{ data: pdfSigned }, { data: sigSigned }] = await Promise.all([
        supabase.storage.from("clinic-assets").createSignedUrl(pdfPath, TEN_YEARS),
        supabase.storage.from("clinic-assets").createSignedUrl(sigPath, TEN_YEARS),
      ]);

      await up({ data: {
        client_id: clientId,
        product: form.product,
        strength: form.strength,
        form: form.form,
        quantity: form.quantity,
        route: form.route,
        dose: form.dose,
        directions: form.directions,
        prescribed_on: form.prescribed_on,
        notes: form.notes,
        prescriber_name: form.prescriber_name,
        prescriber_reg_number: form.prescriber_reg_number,
        prescriber_address: form.prescriber_address,
        patient_address_snapshot: patientAddress,
        patient_dob: client?.dob || undefined,
        signature_url: sigSigned?.signedUrl,
        pdf_url: pdfSigned?.signedUrl,
        signed_at: signedAt,
      }});
      toast.success("Prescription signed and saved");
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save prescription");
    } finally { setSaving(false); }
  }

  return (
    <Section title="Prescriptions" actionsRight={<Button size="sm" variant="outline" onClick={openNew}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>}>
      {rows.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">No prescriptions yet.</div>
      ) : rows.map(r => {
        const isHubRx = typeof r.notes === "string" && r.notes.startsWith("Prescriber:");
        const label = [r.product, r.strength, r.form].filter(Boolean).join(" · ");
        return (
        <div key={r.id} className="flex items-start justify-between gap-2 border-b py-2 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">{label || r.product}</div>
              {isHubRx && <Badge variant="secondary" className="text-[10px]">Rx from Prescriber Hub</Badge>}
              {r.signed_at && <Badge variant="secondary" className="text-[10px]"><FileSignature className="mr-1 h-3 w-3" />Signed</Badge>}
            </div>
            {(r.dose || r.quantity || r.route) && (
              <div className="text-xs">
                {r.dose && <>Dose: {r.dose}{r.route ? ` (${r.route})` : ""}. </>}
                {r.quantity && <>Qty: {r.quantity}.</>}
              </div>
            )}
            {r.directions && <div className="text-xs">{r.directions}</div>}
            {r.prescribed_on && <div className="text-[10px] text-muted-foreground">Prescribed {formatDob(r.prescribed_on)}</div>}
            {r.prescriber_name && <div className="text-[10px] text-muted-foreground">Prescriber: {r.prescriber_name}{r.prescriber_reg_number ? ` — ${r.prescriber_reg_number}` : ""}</div>}
            {r.notes && <div className="text-xs text-muted-foreground whitespace-pre-line">{r.notes}</div>}
          </div>
          <div className="flex items-center gap-1">
            {r.pdf_url && (
              <Button size="icon" variant="ghost" title="Download PDF" onClick={async () => {
                const url = r.pdf_url as string;
                const filename = `prescription-${r.id}.pdf`;
                try {
                  const res = await fetch(url);
                  if (!res.ok) throw new Error("fetch failed");
                  const blob = await res.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = blobUrl; a.download = filename;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                } catch {
                  window.open(url, "_blank");
                }
              }}><Download className="h-3.5 w-3.5" /></Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => del({ data: { id: r.id } }).then(reload)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        );
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>New UK private prescription</DialogTitle></DialogHeader>

          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <div className="font-semibold">Patient</div>
            <div>{client?.full_name}{client?.dob ? ` — DOB ${formatDob(client.dob)}` : ""}</div>
            <div className="text-muted-foreground">
              {[client?.address_line1, client?.address_line2, client?.county, client?.postcode].filter(Boolean).join(", ") || <span className="italic">No address on file — add one to the patient before prescribing.</span>}
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medication</div>
            <div className="grid grid-cols-2 gap-2">
              <F label="Drug (approved name) *"><Input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} /></F>
              <F label="Strength"><Input placeholder="e.g. 50 units, 20 mg/ml" value={form.strength} onChange={e => setForm({ ...form, strength: e.target.value })} /></F>
              <F label="Form"><Input placeholder="e.g. injection, cream" value={form.form} onChange={e => setForm({ ...form, form: e.target.value })} /></F>
              <F label="Route"><Input placeholder="e.g. IM, SC, PO, topical" value={form.route} onChange={e => setForm({ ...form, route: e.target.value })} /></F>
              <F label="Dose *"><Input placeholder="e.g. up to 50 units" value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} /></F>
              <F label="Quantity to supply *"><Input placeholder="e.g. 1 vial" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></F>
            </div>
            <F label="Directions for use *"><Textarea rows={2} value={form.directions} onChange={e => setForm({ ...form, directions: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-2">
              <F label="Prescribed on"><Input type="date" value={form.prescribed_on} onChange={e => setForm({ ...form, prescribed_on: e.target.value })} /></F>
            </div>
            <F label="Clinical notes"><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></F>

            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Prescriber</div>
            <div className="grid grid-cols-2 gap-2">
              <F label="Full name *"><Input value={form.prescriber_name} onChange={e => setForm({ ...form, prescriber_name: e.target.value })} /></F>
              <F label="Registration no. * (GMC/GPhC/NMC)"><Input value={form.prescriber_reg_number} onChange={e => setForm({ ...form, prescriber_reg_number: e.target.value })} /></F>
            </div>
            <F label="Prescriber address *"><Textarea rows={2} value={form.prescriber_address} onChange={e => setForm({ ...form, prescriber_address: e.target.value })} /></F>

            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Signature</div>
            <div className="rounded-md border bg-white">
              <canvas
                ref={sigRef}
                width={600}
                height={160}
                className="block w-full touch-none rounded-md"
                style={{ height: 160 }}
                onPointerDown={onSigDown}
                onPointerMove={onSigMove}
                onPointerUp={onSigUp}
                onPointerLeave={onSigUp}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground">Draw your signature in the box above.</div>
              <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>Clear</Button>
            </div>
            <F label="Signatory name (typed)"><Input value={form.signature_name} onChange={e => setForm({ ...form, signature_name: e.target.value })} /></F>

            <label className="mt-2 flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs">
              <Checkbox checked={!!form.agree} onCheckedChange={(v) => setForm({ ...form, agree: !!v })} />
              <span>
                I confirm I am an appropriately qualified UK prescriber, this prescription complies with the Human Medicines Regulations 2012,
                and I have carried out an appropriate consultation with the patient before prescribing.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign & save
            </Button>
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

/* ---------- Payment link dialog ---------- */

function PaymentLinkDialog({
  open, onOpenChange, client, clinicName, onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: any;
  clinicName: string;
  onSent: () => void;
}) {
  const create = useServerFn(createPaymentLink);
  const logComm = useServerFn(logCommunication);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription(clinicName ? `Payment for ${clinicName}` : "Payment");
      setUrl(null);
    }
  }, [open, clinicName]);

  if (!client) return null;

  async function generate() {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      toast.error("Enter an amount of £1.00 or more");
      return;
    }
    if (!description.trim()) {
      toast.error("Add a short description");
      return;
    }
    setBusy(true);
    try {
      const r: any = await create({
        data: {
          amountCents: cents,
          description: description.trim(),
          kind: "adhoc",
          recipientEmail: client.email || undefined,
          recipientName: client.full_name || undefined,
          recipientPhone: client.phone || undefined,
        },
      });
      setUrl(r?.stripe_url ?? null);
      if (r?.stripe_url) {
        try { await navigator.clipboard.writeText(r.stripe_url); } catch { /* ignore */ }
        toast.success("Payment link created and copied");
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not create payment link");
    } finally {
      setBusy(false);
    }
  }

  const emailHref = client.email && url
    ? `mailto:${client.email}?subject=${encodeURIComponent(`Payment link${clinicName ? ` — ${clinicName}` : ""}`)}&body=${encodeURIComponent(
        `Hi ${client.full_name?.split(" ")[0] || ""},\n\nHere is your payment link:\n${url}\n\nThank you,\n${clinicName || ""}`,
      )}`
    : null;
  const smsHref = client.phone && url ? `sms:${client.phone}?&body=${encodeURIComponent(`Payment link: ${url}`)}` : null;
  const waHref = client.phone && url ? `https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Payment link: ${url}`)}` : null;

  async function markLogged(channel: "email" | "sms" | "whatsapp") {
    try {
      await logComm({ data: { clientId: client.id, channel: channel === "whatsapp" ? "sms" : channel, body: `Payment link sent: ${url}` } });
      onSent();
    } catch { /* ignore */ }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a payment link</DialogTitle>
        </DialogHeader>
        {!url ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="pl-amount">Amount (£)</Label>
              <Input id="pl-amount" type="number" inputMode="decimal" min="1" step="0.01" placeholder="e.g. 50.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pl-desc">Description</Label>
              <Input id="pl-desc" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Creates a Stripe payment link on your connected account. Any card surcharges you've configured will be added automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/50 p-2 text-xs break-all">{url}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Copied"); } catch { /* */ } }}>Copy link</Button>
              {emailHref && (
                <Button size="sm" variant="outline" asChild onClick={() => markLogged("email")}>
                  <a href={emailHref}><Mail className="mr-1.5 h-4 w-4" />Email</a>
                </Button>
              )}
              {smsHref && (
                <Button size="sm" variant="outline" asChild onClick={() => markLogged("sms")}>
                  <a href={smsHref}><MessageSquare className="mr-1.5 h-4 w-4" />SMS</a>
                </Button>
              )}
              {waHref && (
                <Button size="sm" variant="outline" asChild onClick={() => markLogged("whatsapp")}>
                  <a href={waHref} target="_blank" rel="noreferrer"><MessageSquare className="mr-1.5 h-4 w-4" />WhatsApp</a>
                </Button>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {!url && (
            <Button onClick={generate} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Create link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
