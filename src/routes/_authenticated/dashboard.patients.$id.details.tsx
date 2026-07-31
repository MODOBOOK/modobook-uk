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
import { NoteTemplatePicker, appendTemplate } from "@/components/NoteTemplatePicker";
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
  CalendarPlus, CreditCard, FileSignature, Send, ChevronDown, ChevronRight, Info, CalendarClock, Syringe,
} from "lucide-react";
import { FaceMapAnnotator } from "@/components/consultation/FaceMapAnnotator";
import { FaceMapView } from "@/components/consultation/FaceMapView";
import { RescheduleAppointmentDialog } from "@/components/RescheduleAppointmentDialog";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-mode";
import { ConcernsCard } from "@/components/patient/ConcernsCard";
import { CommsTimeline } from "@/components/patient/CommsTimeline";
import { EmailComposerDialog } from "@/components/patient/EmailComposerDialog";
import { SendFormDialog } from "@/components/patient/SendFormDialog";
import { ClientFormsList } from "@/components/patient/ClientFormsList";
import { ConsultationDocCard } from "@/components/patient/ConsultationDocCard";
import { LoyaltyPointsCard } from "@/components/patient/LoyaltyPointsCard";


import { logCommunication, sendPatientEmail } from "@/lib/patient-hub.functions";
import { useLinkFee } from "@/lib/use-link-fee";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { chargeCardOnFile, removeCardOnFile } from "@/lib/card-on-file.functions";
import { TreatmentPlansPanel } from "@/components/TreatmentPlansPanel";


export const Route = createFileRoute("/_authenticated/dashboard/patients/$id/details")({
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
  const [sendConsentKey, setSendConsentKey] = useState(0);
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

  const demo = useDemoGuard();
  async function uploadAvatar(file: File) {
    if (demo.blocked()) return;
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
  const [exportingRecord, setExportingRecord] = useState(false);
  async function exportPatient() {
    if (!client) return;
    setExportingRecord(true);
    try {
      const [{ generatePatientRecordPdf }, { listClientNotes }, { getConsultation }, { listConsentsForClient, getConsentForClient }, profile] = await Promise.all([
        import("@/lib/patient-record-pdf"),
        import("@/lib/clients.functions"),
        import("@/lib/consultations.functions"),
        import("@/lib/treatment-consents.functions"),
        profileFn() as Promise<any>,
      ]);
      const [notes, fullConsults, consentList] = await Promise.all([
        (listClientNotes as any)({ data: { client_id: id } }),
        Promise.all((consults || []).map((c: any) => (getConsultation as any)({ data: { id: c.id } }).catch(() => null))),
        (listConsentsForClient as any)({ data: { client_id: id } }).catch(() => []),
      ]);
      const fullConsents = await Promise.all(
        (consentList as any[]).map((r) =>
          (getConsentForClient as any)({ data: { client_id: id, token: r.token } }).catch(() => r),
        ),
      );
      const doc = await generatePatientRecordPdf({
        clinic: profile ? {
          clinic_name: profile.clinic_name,
          full_name: profile.full_name,
          logo_url: profile.logo_url ?? profile.hero_url ?? null,
          brand_color: profile.brand_color,
          address: profile.address,
          email: profile.email,
          phone: profile.phone,
        } : null,
        patient: client,
        notes: (notes as any[]) || [],
        consultations: (fullConsults as any[]).filter(Boolean),
        appointments: appts || [],
        consents: fullConsents as any[],
        options: { includeDetails: true, includeNotes: true, includeConsultations: true, includeAppointments: true, includeConsents: true },
      });
      const safe = String(client.full_name || "patient").replace(/[^a-z0-9-_ ]/gi, "").trim() || "patient";
      doc.save(`Patient record - ${safe}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF failed");
    } finally { setExportingRecord(false); }
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
      <div className="rounded-xl border bg-card shadow-sm lg:sticky lg:top-24 lg:z-10 lg:bg-card/95 lg:backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Button size="sm" variant="default" className="shrink-0" asChild>
            <Link to="/dashboard/new-appointment" search={{ clientId: client.id }}><CalendarPlus className="mr-1.5 h-4 w-4" />Book</Link>
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
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setSendConsentKey((x) => x + 1)}>
            <FileSignature className="mr-1.5 h-4 w-4" />Send consent
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
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <h1 className="break-words text-lg font-bold sm:text-2xl">{client.full_name}</h1>
              {client.has_allergies && (
                <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />Allergy</Badge>
              )}
              {client.archived && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
            {client.phone && <div className="break-all text-sm font-semibold">{client.phone}</div>}
            {client.email && <div className="break-all text-xs text-muted-foreground sm:text-sm">{client.email}</div>}
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
      <Section title="Medical & consent forms">
        <ClientFormsList
          client={{ id: client.id, full_name: client.full_name, email: client.email, phone: client.phone }}
          clinicName={clinicName}
          refreshKey={commsRefresh}
          includeConsents
          openConsentSendKey={sendConsentKey}
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
              <Link to="/dashboard/new-appointment" search={{ clientId: client.id }}><Plus className="mr-1 h-3.5 w-3.5" />New</Link>
            </Button>
          </>
        }
      >
        {visibleAppts.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No appointments.</div>
        ) : visibleAppts.map(a => (
          <AppointmentRow key={a.id} appt={a} onRescheduled={reload} />
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
      {/* Treatment plans */}
      <TreatmentPlansPanel clientId={id} profileId={profileId} />

      {/* Card on file (for no-show / late cancel charges) */}
      <CardOnFileSection client={client} onReload={reload} />

      {/* Loyalty points */}
      <LoyaltyPointsCard clientId={id} />



      {/* Notes */}
      <NotesSection clientId={id} patient={client} />

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
        <Button variant="outline" className="flex-1" onClick={exportPatient} disabled={exportingRecord}>
          {exportingRecord
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <Download className="mr-1.5 h-3.5 w-3.5" />}
          Download record (PDF)
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
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 bg-muted px-3 py-2 sm:px-4 sm:py-2.5">
        <h2 className="truncate text-xs font-bold uppercase tracking-wider text-primary sm:text-sm">{title}</h2>
        {onEdit && <Button size="sm" variant="outline" className="h-7 shrink-0 rounded-full" onClick={onEdit}><Edit2 className="mr-1 h-3 w-3" />Edit</Button>}
        {actionsRight}
      </div>
      <div className="space-y-1 p-3 sm:p-4">{children}</div>
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

function AppointmentRow({ appt, onRescheduled }: { appt: any; onRescheduled?: () => void }) {
  const [open, setOpen] = useState(false);
  const [resched, setResched] = useState(false);
  const dt = new Date(appt.scheduled_date + "T" + appt.start_time);
  const dateLabel = dt.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const treatment = appt.treatments?.name ?? "Treatment";
  const priceCents = appt.total_amount_cents ?? appt.price_cents ?? appt.treatments?.price_cents;
  const price = typeof priceCents === "number" ? `£${(priceCents / 100).toFixed(2)}` : null;
  const paid = appt.payment_status === "paid" || appt.status === "paid";
  const location = appt.locations?.name || appt.location_name;
  const practitioner = appt.practitioners?.full_name || appt.practitioner_name;
  const canReschedule = appt.status !== "cancelled";
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
          {canReschedule && (
            <div className="pt-2">
              <Button size="sm" variant="outline" onClick={() => setResched(true)}>
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />Change date / time
              </Button>
            </div>
          )}
        </div>
      )}
      {resched && (
        <RescheduleAppointmentDialog
          open={resched}
          onOpenChange={(v) => setResched(v)}
          appointmentId={appt.id}
          initialDate={appt.scheduled_date}
          initialStart={appt.start_time}
          initialEnd={appt.end_time}
          onRescheduled={() => { setResched(false); onRescheduled?.(); }}
        />
      )}
    </div>
  );
}

function AvatarUpload({ client, onUpload }: { client: any; onUpload: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button onClick={() => ref.current?.click()} className="group relative">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-muted text-xl font-bold text-muted-foreground sm:h-32 sm:w-32 sm:text-2xl">
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

function NotesSection({ clientId, patient }: { clientId: string; patient: any }) {
  const list = useServerFn(listClientNotes);
  const up = useServerFn(upsertClientNote);
  const del = useServerFn(deleteClientNote);
  const toggleVis = useServerFn(toggleClientNoteVisibility);
  const fetchProfile = useServerFn(getMyProfile);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "shared" | "private">("all");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<null | { id?: string; body: string; visible_to_patient: boolean; face_map?: any }>(null);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function reload() {
    setRows((await list({ data: { client_id: clientId } })) as any[]);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = rows.filter((n: any) => {
      if (filter === "shared" && !n.visible_to_patient) return false;
      if (filter === "private" && n.visible_to_patient) return false;
      if (query && !String(n.body ?? "").toLowerCase().includes(query)) return false;
      return true;
    });
    out.sort((a: any, b: any) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      return sort === "new" ? bt - at : at - bt;
    });
    return out;
  }, [rows, q, filter, sort]);

  async function saveNote() {
    if (!editing || !editing.body.trim()) return;
    setSaving(true);
    try {
      await up({ data: {
        id: editing.id, client_id: clientId,
        body: editing.body.trim(),
        visible_to_patient: editing.visible_to_patient,
        face_map: editing.face_map ?? null,
      } as any });
      setEditing(null);
      setShowMap(false);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function exportPdf(scope: "all" | "selected" | "filtered") {
    const source =
      scope === "all" ? rows :
      scope === "selected" ? rows.filter(r => selected.has(r.id)) :
      filtered;
    if (source.length === 0) { toast.error("No notes to export"); return; }
    setExporting(true);
    try {
      const [{ generateNotesPdf }, profile] = await Promise.all([
        import("@/lib/notes-pdf"),
        fetchProfile() as Promise<any>,
      ]);
      const doc = await generateNotesPdf({
        clinic: profile ? {
          clinic_name: profile.clinic_name,
          full_name: profile.full_name,
          logo_url: profile.logo_url ?? profile.hero_url ?? null,
          brand_color: profile.brand_color,
          address: profile.address,
        } : null,
        patient: { full_name: patient?.full_name, email: patient?.email, phone: patient?.phone },
        notes: source,
        title: scope === "selected" ? "Selected patient notes" : scope === "filtered" ? "Filtered patient notes" : "All patient notes",
      });
      const safe = String(patient?.full_name ?? "patient").replace(/[^a-z0-9-_ ]/gi, "").trim() || "patient";
      doc.save(`Notes - ${safe}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF failed");
    } finally { setExporting(false); }
  }

  const anySelected = selected.size > 0;

  return (
    <SectionDark
      title={`Notes${rows.length ? ` (${rows.length})` : ""}`}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm" variant="ghost"
            onClick={() => exportPdf(anySelected ? "selected" : "all")}
            disabled={exporting || rows.length === 0}
            title={anySelected ? "Download selected as PDF" : "Download all as PDF"}
          >
            {exporting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
            {anySelected ? `PDF (${selected.size})` : "PDF"}
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => { setEditing({ body: "", visible_to_patient: false, face_map: { pins: [], strokes: [], bg: "realistic" } }); setShowMap(true); }}
          >
            <Syringe className="mr-1 h-3.5 w-3.5" />Treatment diagram
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setEditing({ body: "", visible_to_patient: false }); setShowMap(false); }}>
            <Plus className="mr-1 h-3.5 w-3.5" />New note
          </Button>
        </div>
      }
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes…"
            className="h-9 pl-8 text-sm"
          />
          <ClipboardList className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "shared", "private"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition ${
                filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSort((s) => (s === "new" ? "old" : "new"))}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
            title="Toggle sort order"
          >
            {sort === "new" ? "Newest" : "Oldest"}
          </button>
        </div>
      </div>

      {anySelected && (
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs">
          <span>{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" variant="outline" onClick={() => exportPdf("selected")} disabled={exporting}>
              <Download className="mr-1 h-3.5 w-3.5" />Download selected
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
          {rows.length === 0 ? "No notes yet. Add your first note above." : "No notes match your filters."}
        </div>
      ) : (
        <ul className="divide-y">
          {filtered.map((n: any) => {
            const isSel = selected.has(n.id);
            return (
              <li key={n.id} className={`group flex items-start gap-3 p-3 transition ${isSel ? "bg-primary/5" : ""}`}>
                <Checkbox
                  checked={isSel}
                  onCheckedChange={() => toggleSelect(n.id)}
                  className="mt-1"
                />
                <button
                  type="button"
                  onClick={() => { setEditing({ id: n.id, body: n.body, visible_to_patient: !!n.visible_to_patient, face_map: n.face_map ?? null }); setShowMap(!!n.face_map); }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{n.body}</div>
                  {n.face_map && (
                    <FaceMapView value={n.face_map} className="mt-2 max-w-[180px]" />
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {n.face_map && <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Diagram</Badge>}
                    {n.visible_to_patient
                      ? <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">Shared with patient</Badge>
                      : <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Private</Badge>}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon" variant="ghost"
                    title={n.visible_to_patient ? "Make private" : "Share with patient"}
                    onClick={async () => {
                      await toggleVis({ data: { id: n.id, visible: !n.visible_to_patient } });
                      reload();
                    }}
                  >
                    {n.visible_to_patient ? <Send className="h-3.5 w-3.5 text-primary" /> : <Send className="h-3.5 w-3.5 opacity-50" />}
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => { setEditing({ id: n.id, body: n.body, visible_to_patient: !!n.visible_to_patient, face_map: n.face_map ?? null }); setShowMap(!!n.face_map); }}
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    onClick={async () => {
                      if (!confirm("Delete this note?")) return;
                      await del({ data: { id: n.id } });
                      setSelected(prev => { const s = new Set(prev); s.delete(n.id); return s; });
                      reload();
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit note" : "New note"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Start from a treatment template or write freehand.</span>
                <NoteTemplatePicker
                  scope="note"
                  onInsert={(text) => setEditing((e) => (e ? { ...e, body: appendTemplate(e.body, text) } : e))}
                />
              </div>
              <Textarea
                autoFocus
                rows={14}
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                placeholder="Write your clinical note here…"
                className="min-h-[240px] resize-y text-sm leading-relaxed"
              />
              <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-muted/30 p-3">
                <Checkbox
                  checked={editing.visible_to_patient}
                  onCheckedChange={(v) => setEditing({ ...editing, visible_to_patient: !!v })}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  <span className="block font-medium">Share with patient</span>
                  <span className="block text-xs text-muted-foreground">
                    Shows in their patient portal. Leave unticked for private clinical notes.
                  </span>
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveNote} disabled={saving || !editing?.body.trim()}>
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {editing?.id ? "Save changes" : "Add note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  const demo = useDemoGuard();
  async function onFile(file: File) {
    if (demo.blocked()) return;
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
              <F label="Registration no. *" hint="GMC/GPhC/NMC"><Input value={form.prescriber_reg_number} onChange={e => setForm({ ...form, prescriber_reg_number: e.target.value })} /></F>
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

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
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
  const sendEmailFn = useServerFn(sendPatientEmail);
  const [emailing, setEmailing] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [includeFees, setIncludeFees] = useState(true);
  const [feeCents, setFeeCents] = useState(0);
  const previewFee = useLinkFee(Math.round(Number(amount || 0) * 100), includeFees);

  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription(clinicName ? `Payment for ${clinicName}` : "Payment");
      setUrl(null);
      setIncludeFees(true);
      setFeeCents(0);
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
          includeFees,
        },
      });
      setUrl(r?.stripe_url ?? null);
      setFeeCents(Number(r?.surcharge_cents ?? 0));
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

  const smsHref = client.phone && url ? `sms:${client.phone}?&body=${encodeURIComponent(`Payment link: ${url}`)}` : null;
  const waHref = client.phone && url ? `https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Payment link: ${url}`)}` : null;

  async function markLogged(channel: "email" | "sms" | "whatsapp") {
    try {
      await logComm({ data: { clientId: client.id, channel: channel === "whatsapp" ? "sms" : channel, body: `Payment link sent: ${url}` } });
      onSent();
    } catch { /* ignore */ }
  }

  async function handleSendEmail() {
    if (!client.email || !url) return;
    setEmailing(true);
    try {
      const firstName = client.full_name?.split(" ")[0] || "there";
      const subject = `Payment link${clinicName ? ` from ${clinicName}` : ""}`;
      const body = `Hi ${firstName},\n\nHere is your payment link:\n\n${url}\n\nThank you,\n${clinicName || ""}`.trim();
      await sendEmailFn({ data: { clientId: client.id, subject, body } });
      await markLogged("email");
      toast.success("Payment link emailed to patient");
    } catch (e: any) {
      toast.error(e?.message || "Could not send email");
    } finally {
      setEmailing(false);
    }
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
            <label className="flex items-start gap-2 rounded-md border p-2.5">
              <Checkbox checked={includeFees} onCheckedChange={(v) => setIncludeFees(v === true)} className="mt-0.5" />
              <span className="text-xs">
                <span className="font-medium block">Add platform &amp; processing fees</span>
                <span className="text-muted-foreground">
                  {includeFees && previewFee > 0
                    ? `Adds £${(previewFee / 100).toFixed(2)} — patient pays £${(Number(amount || 0) + previewFee / 100).toFixed(2)}.`
                    : "Adds your card processing surcharge on top. Untick to absorb it yourself."}
                </span>
              </span>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            {feeCents > 0 && (
              <p className="text-xs text-muted-foreground">
                Includes £{(feeCents / 100).toFixed(2)} platform &amp; processing fees — patient pays £{(Number(amount || 0) + feeCents / 100).toFixed(2)}.
              </p>
            )}
            <div className="rounded-md border bg-muted/50 p-2 text-xs break-all">{url}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Copied"); } catch { /* */ } }}>Copy link</Button>
              {client.email && (
                <Button size="sm" variant="outline" onClick={handleSendEmail} disabled={emailing}>
                  {emailing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
                  Email
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
