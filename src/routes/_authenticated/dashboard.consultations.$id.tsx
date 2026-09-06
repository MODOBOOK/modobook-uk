import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getConsultation, updateConsultation, ensureConsultationPatient } from "@/lib/consultations.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { TreatmentPlansPanel } from "@/components/TreatmentPlansPanel";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { generateConsultationPdf } from "@/lib/consultation-pdf";
import { supabase } from "@/integrations/supabase/client";
import { NoteTemplatePicker, appendTemplate } from "@/components/NoteTemplatePicker";
import { listMyConsentTemplates, getConsentTemplate } from "@/lib/treatment-consents.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ChevronLeft, ChevronRight, Check, Camera, X,
  HeartPulse, ListChecks, Stethoscope, ClipboardEdit, FileSignature,
  Images, Syringe, Receipt, ArrowLeft, Plus, Search, Download,
} from "lucide-react";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-mode";
import { ClientFormsList } from "@/components/patient/ClientFormsList";
import { ProductEntryCard, type LogProduct } from "@/components/consultation/ProductEntryCard";
import { FaceMapAnnotator } from "@/components/consultation/FaceMapAnnotator";
import { ConsentSectionsView, type ConsentSection } from "@/components/ConsentSections";

export const Route = createFileRoute("/_authenticated/dashboard/consultations/$id")({
  ssr: false,
  component: ConsultationWizard,
});

const STEPS = [
  { n: 1, label: "Medical", icon: HeartPulse },
  { n: 2, label: "Concerns", icon: ListChecks },
  { n: 3, label: "Assessment", icon: Stethoscope },
  { n: 4, label: "Plan", icon: ClipboardEdit },
  { n: 5, label: "Consent", icon: FileSignature },
  { n: 6, label: "After", icon: Images },
  { n: 7, label: "Treatment", icon: Syringe },
  { n: 8, label: "Invoice", icon: Receipt },
] as const;

const MEDICAL_SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Medical history",
    items: [
      "Diabetes","Autoimmune disease","Cancer (past or present)","Blood clotting disorder",
      "Heart condition","High blood pressure","Low blood pressure","Epilepsy or seizures",
      "Thyroid disorder","Liver disease","Kidney disease","HIV or Hepatitis",
      "Keloid or hypertrophic scarring","Rosacea","Eczema, psoriasis or dermatitis",
      "Cold sores (Herpes Simplex)","Any chronic medical condition",
      "Any condition affecting healing or immune system",
    ],
  },
  {
    title: "Allergies",
    items: [
      "Lidocaine or local anaesthetic","Hyaluronic acid products","Poly-L-lactic acid (Sculptra)",
      "Latex","Adhesives","Medications","Foods","Other allergies",
    ],
  },
  {
    title: "Medications",
    items: [
      "Prescription medications","Blood thinners","Steroids","Immunosuppressants",
      "Acne medication (e.g. Roaccutane/Isotretinoin)","Vitamins and supplements",
      "Weight-loss medications (e.g. GLP-1)",
    ],
  },
  {
    title: "Pregnancy",
    items: ["Pregnant","Breastfeeding","Trying to conceive"],
  },
  {
    title: "Previous aesthetic treatments",
    items: [
      "Anti-wrinkle injections","Dermal filler","Sculptra","Skin boosters","Polynucleotides",
      "Fat dissolving injections","Microneedling","Chemical peels","Laser treatments",
      "PDO threads","Facial surgery",
    ],
  },
  {
    title: "Previous complications",
    items: [
      "Infection","Vascular occlusion","Allergic reaction","Delayed swelling",
      "Nodules or granulomas","Product migration","Poor healing","Excessive bruising",
    ],
  },
  {
    title: "Current health (last 2 weeks)",
    items: [
      "Cold sore","Illness or fever","Skin infection","Dental treatment","Vaccination",
      "Antibiotics","Facial injury","Open wounds or acne flare-up",
    ],
  },
  {
    title: "Lifestyle",
    items: ["Smokes or vapes","Drinks alcohol","Bruises easily"],
  },
  {
    title: "Practitioner assessment",
    items: [
      "Suitable for treatment","Contraindications identified","Risks discussed",
      "Treatment plan agreed","Products recommended","Aftercare discussed",
    ],
  },
];


const CONCERN_OPTIONS = [
  "Forehead lines", "Frown lines (11s)", "Crow's feet", "Bunny lines",
  "Lip lines", "Marionette lines", "Nasolabial folds", "Jawline definition",
  "Cheek volume", "Under-eye hollows", "Lip volume", "Skin texture",
  "Pigmentation", "Acne / scarring", "Excessive sweating", "Migraines",
];

export function ConsultationWizard() {
  const { id } = Route.useParams();
  const get = useServerFn(getConsultation);
  const update = useServerFn(updateConsultation);
  const ensurePatient = useServerFn(ensureConsultationPatient);
  const fetchProfile = useServerFn(getMyProfile);
  const [exporting, setExporting] = useState(false);

  async function exportPdf() {
    setExporting(true);
    try {
      const profile: any = await fetchProfile();
      const doc = await generateConsultationPdf({
        clinic: profile
          ? {
              clinic_name: profile.clinic_name,
              full_name: profile.full_name,
              email: profile.email,
              phone: profile.phone,
              address: profile.address,
              logo_url: profile.logo_url ?? profile.hero_url ?? null,
              brand_color: profile.brand_color,
            }
          : null,
        consultation: c,
      });
      const safeName = String(c?.patient_name ?? "consultation").replace(/[^a-z0-9-_ ]/gi, "").trim() || "consultation";
      doc.save(`Consultation - ${safeName}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate PDF");
    } finally {
      setExporting(false);
    }
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [c, setC] = useState<any>(null);
  const [step, setStep] = useState(1);
  const dirtyRef = useRef<Record<string, any> | null>(null);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const data: any = await get({ data: { id } });
      setC(data);
      setStep(data.current_step ?? 1);
      setLoading(false);
      // Auto-link to a patient record so the treatment plans panel is usable
      if (!data.patient_id && data.patient_name) {
        try {
          const res: any = await ensurePatient({ data: { id } });
          if (res?.patient_id) setC((prev: any) => prev ? ({ ...prev, patient_id: res.patient_id }) : prev);
        } catch { /* ignore */ }
      }
    })();
  }, [id]); // eslint-disable-line

  // autosave
  const queueSave = useCallback((patch: Record<string, any>) => {
    dirtyRef.current = { ...(dirtyRef.current ?? {}), ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const p = dirtyRef.current; dirtyRef.current = null;
      if (!p) return;
      setSaving(true);
      try { await update({ data: { id, patch: p } }); } catch (e: any) { toast.error("Save failed"); }
      finally { setSaving(false); }
    }, 700);
  }, [id, update]);

  const setField = (key: string, val: any) => {
    setC((prev: any) => ({ ...prev, [key]: val }));
    queueSave({ [key]: val });
  };

  const goStep = (n: number) => {
    setStep(n);
    queueSave({ current_step: n });
  };

  async function complete() {
    setSaving(true);
    try {
      await update({ data: { id, patch: { status: "completed", completed_at: new Date().toISOString() } } });
      setC((p: any) => ({ ...p, status: "completed" }));
      toast.success("Consultation completed");
    } finally { setSaving(false); }
  }

  if (loading || !c) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">{c.patient_name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {c.patient_email || "no email"} {c.patient_phone ? `· ${c.patient_phone}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saving ? (
            <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" />Saved</Badge>
          )}
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      </div>

      {/* Step pill scroller */}
      <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.n;
            const done = step > s.n || c.status === "completed";
            return (
              <button
                key={s.n}
                onClick={() => goStep(s.n)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active ? "border-primary bg-primary text-primary-foreground" :
                  done ? "border-emerald-300 bg-emerald-50 text-emerald-700" :
                  "border-border bg-card text-muted-foreground"
                }`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                  active ? "bg-primary-foreground/20" : done ? "bg-emerald-200" : "bg-muted"
                }`}>{done && !active ? <Check className="h-3 w-3" /> : s.n}</span>
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <Card><CardContent className="space-y-4 p-4 sm:p-6">
        {step === 1 && <Step1 consultationId={c.id} medical={c.medical} onChange={(v: any) => setField("medical", v)} clientId={c.patient_id} clientName={c.patient_name} clientEmail={c.patient_email} clientPhone={c.patient_phone} onLinked={(pid) => setC((prev: any) => ({ ...prev, patient_id: pid }))} />}
        {step === 2 && <Step2 concerns={c.concerns} onChange={(v: any) => setField("concerns", v)} />}
        {step === 3 && <Step3 profileId={c.profile_id} consultationId={c.id} assessment={c.assessment} photos={c.before_photos} onChangeAssess={(v: any) => setField("assessment", v)} onChangePhotos={(v: any) => setField("before_photos", v)} />}
        {step === 4 && (
          <>
            <Step4 plan={c.treatment_plan} onChange={(v: any) => setField("treatment_plan", v)} />
            {c.patient_id && (
              <div className="pt-4 border-t mt-4">
                <TreatmentPlansPanel clientId={c.patient_id} consultationId={c.id} profileId={c.profile_id} />
              </div>
            )}
          </>
        )}
        {step === 5 && <Step5 consultationId={c.id} consent={c.consent} patientName={c.patient_name} onChange={(v: any) => setField("consent", v)} onLinked={(pid: string) => setC((prev: any) => ({ ...prev, patient_id: pid }))} />}
        {step === 6 && <Step6 profileId={c.profile_id} consultationId={c.id} photos={c.after_photos} onChange={(v: any) => setField("after_photos", v)} />}
        {step === 7 && <Step7 log={c.treatment_log} onChange={(v: any) => setField("treatment_log", v)} />}
        {step === 8 && <Step8 invoice={c.invoice} email={c.patient_email} patientName={c.patient_name} consultationId={c.id} onChange={(v: any) => setField("invoice", v)} onComplete={complete} completed={c.status === "completed"} />}
      </CardContent></Card>



      {/* Sticky nav */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={step === 1} onClick={() => goStep(step - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <span className="text-xs text-muted-foreground">Step {step} of 8</span>
          {step < 8 ? (
            <Button size="sm" onClick={() => goStep(step + 1)}>
              Next<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={complete} disabled={c.status === "completed"}>
              {c.status === "completed" ? "Completed" : "Finish"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Steps ---------- */

function Step1({ consultationId, medical, onChange, clientId, clientName, clientEmail, clientPhone, onLinked }: {
  consultationId: string;
  medical: any;
  onChange: (v: any) => void;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  onLinked: (pid: string) => void;
}) {
  const ensure = useServerFn(ensureConsultationPatient);
  const [linking, setLinking] = useState(false);
  const answers = medical?.answers ?? {};
  const notes = medical?.notes ?? "";
  const toggle = (q: string, v: boolean) => onChange({ ...medical, answers: { ...answers, [q]: v } });

  async function linkNow() {
    setLinking(true);
    try {
      const res: any = await ensure({ data: { id: consultationId } });
      if (res?.patient_id) {
        onLinked(res.patient_id);
        toast.success("Patient linked — you can now add forms");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to link patient");
    } finally { setLinking(false); }
  }

  return (
    <div className="space-y-4">
      <Header n={1} title="Medical history" subtitle="Tick anything that applies, or send a full form for the patient to complete at home." />

      {clientId ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <ClientFormsList
            client={{ id: clientId, full_name: clientName ?? "", email: clientEmail ?? undefined, phone: clientPhone ?? undefined }}
            compact
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Link this consultation to a patient record to send additional medical forms.</span>
          <Button size="sm" onClick={linkNow} disabled={linking}>
            {linking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Link patient & enable forms
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {MEDICAL_SECTIONS.map((section) => (
          <div key={section.title} className="rounded-lg border bg-card">
            <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </div>
            <div className="grid gap-1.5 p-2 sm:grid-cols-2">
              {section.items.map((q: string) => (
                <label key={q} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 active:bg-muted">
                  <Checkbox checked={!!answers[q]} onCheckedChange={(v) => toggle(q, !!v)} />
                  <span>{q}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Additional notes</Label>
        <Textarea rows={3} value={notes} onChange={(e) => onChange({ ...medical, notes: e.target.value })} placeholder="Allergies, medications, anything relevant…" />
      </div>
    </div>
  );
}


function Step2({ concerns, onChange }: { concerns: any; onChange: (v: any) => void }) {
  const selected: string[] = concerns?.selected ?? [];
  const notes = concerns?.notes ?? "";
  const toggle = (c: string) => {
    const s = new Set(selected);
    s.has(c) ? s.delete(c) : s.add(c);
    onChange({ ...concerns, selected: Array.from(s) });
  };
  return (
    <div className="space-y-4">
      <Header n={2} title="Concerns" subtitle="What is the patient looking to address?" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CONCERN_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              selected.includes(c) ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label>Patient's own words</Label>
        <Textarea rows={3} value={notes} onChange={(e) => onChange({ ...concerns, notes: e.target.value })} placeholder="What does the patient say in their own words?" />
      </div>
    </div>
  );
}

function Step3({ profileId, consultationId, assessment, photos, onChangeAssess, onChangePhotos }: any) {
  return (
    <div className="space-y-4">
      <Header n={3} title="Assessment" subtitle="Clinical notes and before photos." />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Clinical assessment</Label>
          <NoteTemplatePicker
            scope="assessment"
            variant="ghost"
            onInsert={(text) => onChangeAssess({ ...assessment, notes: appendTemplate(assessment?.notes ?? "", text) })}
          />
        </div>
        <Textarea rows={5} value={assessment?.notes ?? ""} onChange={(e) => onChangeAssess({ ...assessment, notes: e.target.value })} placeholder="Skin condition, muscle tone, asymmetries…" />
      </div>


      <PhotoGrid label="Before photos" photos={photos ?? []} onChange={onChangePhotos} profileId={profileId} consultationId={consultationId} />
    </div>
  );
}

function Step4({ plan, onChange }: any) {
  return (
    <div className="space-y-4">
      <Header n={4} title="Treatment plan" subtitle="What you recommend." />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Recommended treatments & plan</Label>
          <NoteTemplatePicker
            scope="plan"
            variant="ghost"
            onInsert={(text) => onChange({ ...plan, text: appendTemplate(plan?.text ?? "", text) })}
          />
        </div>
        <Textarea rows={8} value={plan?.text ?? ""} onChange={(e) => onChange({ ...plan, text: e.target.value })} placeholder="e.g. Botox – 3 areas (forehead, glabella, crow's feet) – 50 units total. Review in 2 weeks." />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Estimated price (£)</Label>
          <Input type="number" inputMode="decimal" value={plan?.price ?? ""} onChange={(e) => onChange({ ...plan, price: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Follow-up in (weeks)</Label>
          <Input type="number" inputMode="numeric" value={plan?.followup_weeks ?? ""} onChange={(e) => onChange({ ...plan, followup_weeks: e.target.value })} />
        </div>
      </div>

      <FaceMapAnnotator
        title="Face map — treatment plan"
        value={plan?.face_map}
        onChange={(v) => onChange({ ...plan, face_map: v })}
      />
    </div>
  );
}

function Step5({ consent, patientName, onChange }: any) {
  const body = consent?.body ?? defaultConsent(patientName);
  const attachedIds: string[] = Array.isArray(consent?.attached_template_ids)
    ? consent.attached_template_ids
    : [];
  const photoUses: { key: string; label: string; hint: string }[] = [
    { key: "photo_file", label: "Patient file", hint: "Stored privately in clinical records." },
    { key: "photo_social", label: "Social media", hint: "May be posted on Instagram, Facebook, TikTok etc." },
    { key: "photo_marketing", label: "Marketing & website", hint: "Use on website, brochures and ads." },
    { key: "photo_show_patients", label: "Showing other patients", hint: "May be shown in consultations as examples." },
    { key: "photo_training", label: "Training & education", hint: "Used in courses, conferences or teaching." },
  ];
  return (
    <div className="space-y-4">
      <Header n={5} title="Treatment consent" subtitle="Patient signs to confirm understanding." />

      <ConsentTemplatesAttach
        selectedIds={attachedIds}
        onChange={(ids) => onChange({ ...consent, attached_template_ids: ids })}
      />

      <div className="space-y-1.5">
        <Label>Additional consent text</Label>
        <Textarea rows={6} value={body} onChange={(e) => onChange({ ...consent, body: e.target.value })} />
      </div>
      <div className="grid gap-2">
        {["I confirm I have read and understand the above","I confirm the medical information provided is accurate","I consent to before/after photos being taken for my records"].map((l) => (
          <label key={l} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3">
            <Checkbox checked={!!consent?.[l]} onCheckedChange={(v) => onChange({ ...consent, [l]: !!v })} />
            <span className="text-sm">{l}</span>
          </label>
        ))}
      </div>

      {/* Photo consent — per-use opt-in */}
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <div>
          <Label className="text-sm">Photo & image consent</Label>
          <p className="text-xs text-muted-foreground">Tick the uses the patient is happy with. Leave others blank.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {photoUses.map((u) => (
            <label key={u.key} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3">
              <Checkbox
                checked={!!consent?.[u.key]}
                onCheckedChange={(v) => onChange({ ...consent, [u.key]: !!v })}
              />
              <span>
                <span className="block text-sm font-medium">{u.label}</span>
                <span className="block text-xs text-muted-foreground">{u.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <SignaturePad value={consent?.signature ?? null} signedAt={consent?.signed_at} signerName={consent?.signer_name ?? patientName} onChange={(sig, name) => onChange({ ...consent, body, signature: sig, signed_at: sig ? new Date().toISOString() : null, signer_name: name })} />
    </div>
  );
}

type ConsentTpl = {
  id: string;
  name: string;
  treatment_type?: string | null;
  is_system: boolean;
  summary?: string | null;
  sections?: ConsentSection[] | null;
};

function ConsentTemplatesAttach({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const fetchAll = useServerFn(listMyConsentTemplates);
  const [all, setAll] = useState<ConsentTpl[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchAll().then((rows) => setAll((rows ?? []) as ConsentTpl[])).catch(() => {});
  }, [fetchAll]);

  const selected = useMemo(
    () => all.filter((t) => selectedIds.includes(t.id)),
    [all, selectedIds],
  );
  const query = q.trim().toLowerCase();
  const filtered = query
    ? all.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          (t.treatment_type ?? "").toLowerCase().includes(query),
      )
    : all;

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Attach consent forms</Label>
          <p className="text-xs text-muted-foreground">
            Pull in any of your library consent forms. They render below for the patient to read and sign.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Done" : "Add"}
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((t) => (
            <div key={t.id} className="rounded-lg border bg-muted/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t.name}</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => toggle(t.id)} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2">
                <ConsentSectionsView
                  sections={t.sections ?? null}
                  summary={t.summary ?? undefined}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search consent forms…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border bg-muted/10 p-1">
            {filtered.length === 0 ? (
              <p className="p-2 text-center text-xs text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((t) => {
                const checked = selectedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-background ${checked ? "bg-background ring-1 ring-primary/40" : ""}`}
                  >
                    <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                    <span className="flex-1">
                      <span className="block font-medium">{t.name}</span>
                      {t.treatment_type && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t.treatment_type}
                        </span>
                      )}
                    </span>
                    {t.is_system && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        template
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}



function Step6({ profileId, consultationId, photos, onChange }: any) {
  return (
    <div className="space-y-4">
      <Header n={6} title="After photos" subtitle="Capture results right after treatment." />
      <PhotoGrid label="After photos" photos={photos ?? []} onChange={onChange} profileId={profileId} consultationId={consultationId} />
    </div>
  );
}

function Step7({ log, onChange }: any) {
  const products: LogProduct[] = log?.products ?? [];
  const update = (i: number, v: LogProduct) => {
    const next = products.slice(); next[i] = v;
    onChange({ ...log, products: next });
  };
  const add = () => onChange({ ...log, products: [...products, { quantity: "1" }] });
  const remove = (i: number) => onChange({ ...log, products: products.filter((_, j) => j !== i) });

  const total = products.reduce((sum, p) => {
    const price = Number(p.price ?? 0);
    const qty = Number(p.quantity ?? 1);
    return sum + (isFinite(price) ? price : 0) * (isFinite(qty) ? qty : 1);
  }, 0);

  return (
    <div className="space-y-4">
      <Header n={7} title="Treatment performed" subtitle="Record products used, face mapping, and dosing." />

      {products.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center text-xs text-muted-foreground">
          No treatments added yet. Tap "Add a treatment" to log products used.
        </div>
      )}

      {products.map((p, i) => (
        <ProductEntryCard
          key={i} index={i} value={p}
          onChange={(v) => update(i, v)}
          onRemove={() => remove(i)}
        />
      ))}

      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="mr-2 h-4 w-4" />Add a treatment to this appointment
      </Button>

      {products.length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">£{total.toFixed(2)}</span>
        </div>
      )}

      <FaceMapAnnotator
        title="Face map — treatment performed"
        value={log?.face_map}
        onChange={(v) => onChange({ ...log, face_map: v })}
      />

      <Separator />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Aftercare advice given</Label>
          <NoteTemplatePicker
            scope="aftercare"
            variant="ghost"
            onInsert={(text) => onChange({ ...log, aftercare: appendTemplate(log?.aftercare ?? "", text) })}
          />
        </div>
        <Textarea rows={4} value={log?.aftercare ?? ""} onChange={(e) => onChange({ ...log, aftercare: e.target.value })} />
      </div>

    </div>
  );
}


type InvLine = { description: string; qty: number; unitPrice: number };

function Step8({ invoice, email, patientName, consultationId, onChange, onComplete, completed }: any) {
  const createLink = useServerFn(createPaymentLink);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const includeFees = invoice?.include_fees !== false;
  const feeCents = Number(invoice?.fee_cents ?? 0);
  const items: InvLine[] = Array.isArray(invoice?.items) && invoice.items.length > 0
    ? invoice.items
    : [{ description: invoice?.notes ?? "", qty: 1, unitPrice: Number(invoice?.amount ?? 0) }];
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const amountNum = subtotal;
  const sendEmail = (invoice?.email ?? email ?? "").trim();

  function setItems(next: InvLine[]) {
    const total = next.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    onChange({ ...invoice, items: next, amount: total });
  }

  async function loadProfileForPdf() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, clinic_name, full_name, address, email, phone, brand_color, avatar_url, hero_url, invoice_bank_name, invoice_account_name, invoice_sort_code, invoice_account_number, invoice_iban, invoice_swift, invoice_payment_reference, invoice_footer_notes, invoice_vat_number, invoice_company_number, invoice_show_bank_details, invoice_show_logo")
      .eq("user_id", user!.id).single();
    return profile;
  }

  function profileToInvoiceArgs(profile: any) {
    const addr = (profile?.address ?? {}) as Record<string, string>;
    const addrLines = [addr.line1, addr.line2, [addr.city, addr.postcode].filter(Boolean).join(" "), addr.country].filter(Boolean) as string[];
    return {
      clinic: profile?.clinic_name || profile?.full_name || "Invoice",
      practitioner: profile?.full_name ?? undefined,
      clinicAddress: addrLines,
      clinicEmail: profile?.email ?? null,
      clinicPhone: profile?.phone ?? null,
      vatNumber: profile?.invoice_vat_number ?? null,
      companyNumber: profile?.invoice_company_number ?? null,
      logoUrl: profile?.invoice_show_logo === false ? null : (profile?.avatar_url ?? null),
      brandColor: profile?.brand_color ?? null,
      patientName,
      patientEmail: sendEmail,
      date: new Date().toLocaleDateString("en-GB"),
      items: items.map((it) => ({ description: it.description || "Treatment", qty: Number(it.qty) || 1, unitPrice: Number(it.unitPrice) || 0 })),
      amount: amountNum,
      notes: invoice?.notes,
      footerNotes: profile?.invoice_footer_notes ?? null,
      paymentLink: invoice?.payment_link,
      feeCents: invoice?.payment_link ? feeCents : 0,
      feeLabel: "Card & processing fee",
      reference: consultationId?.slice(0, 8).toUpperCase(),
      showBank: !!profile?.invoice_show_bank_details,
      bank: {
        bankName: profile?.invoice_bank_name,
        accountName: profile?.invoice_account_name,
        sortCode: profile?.invoice_sort_code,
        accountNumber: profile?.invoice_account_number,
        iban: profile?.invoice_iban,
        swift: profile?.invoice_swift,
        paymentReference: profile?.invoice_payment_reference,
      },
    };
  }

  async function generateStripeLink() {
    if (!Number.isFinite(amountNum) || amountNum < 1) {
      toast.error("Enter an amount of £1 or more");
      return;
    }
    setGenerating(true);
    try {
      const row: any = await createLink({
        data: {
          amountCents: Math.round(amountNum * 100),
          description: items.map(i => i.description).filter(Boolean).join(", ") || `Consultation ${consultationId?.slice(0, 8) ?? ""}`,
          kind: "checkout",
          recipientEmail: sendEmail || null,
          recipientName: patientName || null,
          includeFees,
        },
      });
      onChange({ ...invoice, items, amount: amountNum, payment_link: row.stripe_url, payment_link_id: row.id, fee_cents: Number(row.surcharge_cents ?? 0), include_fees: includeFees, status: "sent", sent_at: new Date().toISOString() });
      toast.success("Stripe payment link created");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create payment link");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Add at least one line item");
      return;
    }
    setDownloading(true);
    try {
      const { generateInvoicePdf } = await import("@/lib/invoice-pdf");
      const profile = await loadProfileForPdf();
      const doc = await generateInvoicePdf(profileToInvoiceArgs(profile));
      doc.save(`invoice-${(patientName || "patient").replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate PDF");
    } finally {
      setDownloading(false);
    }
  }

  async function emailInvoiceWithPdf() {
    if (!sendEmail) { toast.error("Add a recipient email first"); return; }
    if (amountNum <= 0) { toast.error("Add at least one line item"); return; }
    setEmailing(true);
    try {
      const profile = await loadProfileForPdf();

      // Auto-create a Stripe payment link if we don't already have one.
      let paymentLink: string | null = invoice?.payment_link ?? null;
      let paymentLinkId: string | null = invoice?.payment_link_id ?? null;
      let linkFeeCents = feeCents;
      if (!paymentLink) {
        try {
          const row: any = await createLink({
            data: {
              amountCents: Math.round(amountNum * 100),
              description: items.map(i => i.description).filter(Boolean).join(", ") || `Consultation ${consultationId?.slice(0, 8) ?? ""}`,
              kind: "checkout",
              recipientEmail: sendEmail || null,
              recipientName: patientName || null,
              includeFees,
            },
          });
          paymentLink = row.stripe_url;
          paymentLinkId = row.id;
          linkFeeCents = Number(row.surcharge_cents ?? 0);
        } catch (e: any) {
          toast.error(e?.message ?? "Could not create Stripe payment link");
          setEmailing(false);
          return;
        }
      }

      // Generate the branded invoice PDF (with the pay-now button baked in)
      // and upload to storage so we can link it in the email.
      const { generateInvoicePdf } = await import("@/lib/invoice-pdf");
      const pdfArgs = profileToInvoiceArgs(profile);
      const doc = await generateInvoicePdf({ ...pdfArgs, paymentLink: paymentLink ?? undefined, feeCents: linkFeeCents });
      const pdfBlob = doc.output("blob");
      const { data: { user } } = await supabase.auth.getUser();
      const pdfPath = `${profile!.id}/invoices/${consultationId}-${Date.now()}.pdf`;
      const up = await supabase.storage
        .from("clinic-assets")
        .upload(pdfPath, pdfBlob, { upsert: true, contentType: "application/pdf" });
      if (up.error) throw up.error;
      const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
      const signed = await supabase.storage.from("clinic-assets").createSignedUrl(pdfPath, TEN_YEARS);
      const pdfUrl = signed.data?.signedUrl ?? null;

      const clinicName = profile?.clinic_name || profile?.full_name || "your clinic";
      const itemsText = items
        .map(i => `• ${i.description || "Treatment"} × ${i.qty} — £${(Number(i.qty) * Number(i.unitPrice)).toFixed(2)}`)
        .join("\n");
      const body =
        `Hi ${patientName ?? "there"},\n\n` +
        `Please find your invoice from ${clinicName} below.\n\n` +
        `${itemsText}\n\n` +
        `Total: £${amountNum.toFixed(2)}\n\n` +
        `Reference: ${consultationId?.slice(0, 8).toUpperCase() ?? ""}\n\n` +
        `Thank you,\n${profile?.full_name ?? clinicName}`;

      const actions: { label: string; url: string; variant?: "primary" | "secondary" }[] = [];
      if (paymentLink) actions.push({ label: "Pay now", url: paymentLink, variant: "primary" });
      if (pdfUrl) actions.push({ label: "View invoice PDF", url: pdfUrl, variant: "secondary" });

      const { sendAppEmail } = await import("@/lib/email/send");
      const res = await sendAppEmail({
        templateName: "patient-message",
        recipientEmail: sendEmail,
        idempotencyKey: `invoice-${consultationId}-${Math.round(amountNum * 100)}-${Date.now()}`,
        templateData: {
          subject: `Your invoice from ${clinicName}`,
          body,
          clinicName,
          logoUrl: profile?.invoice_show_logo === false ? null : (profile?.avatar_url ?? null),
          brandColor: profile?.brand_color ?? null,
          actions,
        },
      });
      if (!res.ok) throw new Error(res.error || "Send failed");

      onChange({
        ...invoice,
        items,
        amount: amountNum,
        payment_link: paymentLink,
        payment_link_id: paymentLinkId,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      toast.success("Invoice sent to patient via MODO");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send invoice");
    } finally {
      setEmailing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Header n={8} title="Invoice & payment" subtitle="Add line items, generate a Stripe link, download or email the branded invoice." />

      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Line items</Label>
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: "", qty: 1, unitPrice: 0 }])}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 rounded-md border bg-background p-2">
              <Input className="col-span-6" placeholder="Description (e.g. Botox – 3 areas)" value={it.description} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], description: e.target.value }; setItems(n); }} />
              <Input className="col-span-2" type="number" min="0" step="1" placeholder="Qty" value={it.qty} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], qty: Number(e.target.value) || 0 }; setItems(n); }} />
              <Input className="col-span-3" type="number" min="0" step="0.01" placeholder="Unit £" value={it.unitPrice} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], unitPrice: Number(e.target.value) || 0 }; setItems(n); }} />
              <Button className="col-span-1" size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label="Remove">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">£{amountNum.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Send to email</Label>
        <Input type="email" value={invoice?.email ?? email ?? ""} onChange={(e) => onChange({ ...invoice, email: e.target.value })} />
      </div>

      <label className="flex items-start gap-2 rounded-md border p-3">
        <Checkbox checked={includeFees} onCheckedChange={(v) => onChange({ ...invoice, include_fees: v === true })} className="mt-0.5" />
        <span className="text-xs">
          <span className="block font-medium">Add platform &amp; processing fees to the Stripe link</span>
          <span className="text-muted-foreground">Uses the card surcharges set in Settings. The fee is shown as its own line on the invoice PDF.</span>
        </span>
      </label>

      {invoice?.payment_link ? (
        <div className="rounded-md border bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Stripe payment link</div>
          <a href={invoice.payment_link} target="_blank" rel="noreferrer" className="break-all text-emerald-700 underline dark:text-emerald-300">{invoice.payment_link}</a>
          {feeCents > 0 && (
            <div className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
              Includes £{(feeCents / 100).toFixed(2)} fees — patient pays £{(amountNum + feeCents / 100).toFixed(2)}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(invoice.payment_link); toast.success("Link copied"); }}>Copy link</Button>
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...invoice, payment_link: null, payment_link_id: null })}>Remove</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          No payment link yet. Generate one — it's created on Stripe automatically.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={generateStripeLink} disabled={generating}>
          {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : invoice?.payment_link ? "Regenerate Stripe link" : "Create Stripe payment link"}
        </Button>
        <Button variant="outline" onClick={downloadPdf} disabled={downloading}>
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
          Download PDF
        </Button>
        <Button variant="outline" onClick={emailInvoiceWithPdf} disabled={emailing}>
          {emailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send invoice via MODO
        </Button>
        <Button variant="ghost" onClick={() => onChange({ ...invoice, items, amount: amountNum, status: "paid", paid_at: new Date().toISOString() })}>
          Mark as paid
        </Button>
        {invoice?.status && <Badge variant="secondary" className="ml-auto">{invoice.status}</Badge>}
      </div>
      <Separator />
      <Button onClick={onComplete} disabled={completed} className="w-full">
        {completed ? <><Check className="mr-2 h-4 w-4" />Completed</> : "Complete consultation"}
      </Button>
    </div>
  );
}

/* ---------- Shared ---------- */

function Header({ n, title, subtitle }: { n: number; title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">Step {n}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function defaultConsent(name: string) {
  return `I, ${name}, confirm that the treatment has been fully explained to me, including the risks, benefits and alternatives. I have had the opportunity to ask questions and I consent to proceed.`;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes
const SIGNED_URL_REFRESH_MS = 8 * 60 * 1000; // refresh ~2 min before expiry

async function compressImageToBlob(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  const img: HTMLImageElement | ImageBitmap = bitmap ?? await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const w0 = (img as any).width; const h0 = (img as any).height;
  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.round(w0 * scale); const h = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");
  ctx.drawImage(img as any, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality)
  );
}

// A stored photo is either a legacy inline data URL or a bucket path
// like `{profile_id}/consultations/{consultation_id}/{uuid}.jpg`.
function isInlinePhoto(v: string) {
  return typeof v === "string" && (v.startsWith("data:") || v.startsWith("http://") || v.startsWith("https://") || v.startsWith("blob:"));
}

function PhotoGrid({ label, photos, onChange, profileId, consultationId }: {
  label: string;
  photos: string[];
  onChange: (v: string[]) => void;
  profileId?: string;
  consultationId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});

  // Sign private bucket paths and refresh before expiry
  useEffect(() => {
    let cancelled = false;
    const paths = (photos ?? []).filter((p) => p && !isInlinePhoto(p));
    if (!paths.length) { setUrlMap({}); return; }

    async function sign() {
      const { data, error } = await supabase.storage
        .from("patient-photos")
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (cancelled) return;
      if (error) { toast.error("Couldn't load photos"); return; }
      const next: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
      }
      setUrlMap(next);
    }
    sign();
    const timer = window.setInterval(sign, SIGNED_URL_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [photos]);

  const displaySrc = useCallback((p: string) => (isInlinePhoto(p) ? p : (urlMap[p] ?? "")), [urlMap]);

  const demo = useDemoGuard();
  async function onFiles(files: FileList | null) {
    if (demo.blocked()) return;
    if (!files?.length) return;
    if (!profileId || !consultationId) { toast.error("Consultation not ready"); return; }
    const arr = Array.from(files);
    const invalid = arr.find((f) => !ALLOWED_IMAGE_TYPES.includes(f.type));
    if (invalid) { toast.error("Only JPEG, PNG or WebP images are allowed"); return; }

    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const f of arr) {
        const blob = await compressImageToBlob(f);
        const path = `${profileId}/consultations/${consultationId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("patient-photos")
          .upload(path, blob, { upsert: false, contentType: "image/jpeg", cacheControl: "0" });
        if (error) throw error;
        uploaded.push(path);
      }
      onChange([...(photos ?? []), ...uploaded]);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload image");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(i: number) {
    const target = photos[i];
    const next = photos.filter((_, j) => j !== i);
    onChange(next);
    if (target && !isInlinePhoto(target)) {
      // Best-effort delete; RLS enforces ownership.
      supabase.storage.from("patient-photos").remove([target]).catch(() => {});
    }
  }

  useEffect(() => {
    if (lightboxIdx == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i == null ? i : Math.min((photos.length - 1), i + 1)));
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i == null ? i : Math.max(0, i - 1)));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, photos.length]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
          Add photo
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {photos?.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((src, i) => {
            const url = displaySrc(src);
            return (
              <div key={src + i} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <button
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="block h-full w-full"
                  aria-label="Expand photo"
                >
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover transition hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  )}
                </button>
                <button
                  onClick={() => remove(i)}
                  aria-label="Delete photo"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white shadow-md transition hover:bg-black"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center text-xs text-muted-foreground">
          No photos yet. Tap "Add photo" to take or upload.
        </div>
      )}

      {lightboxIdx != null && photos[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightboxIdx(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxIdx > 0 && (
            <button
              type="button"
              aria-label="Previous"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i == null ? i : Math.max(0, i - 1))); }}
              className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {lightboxIdx < photos.length - 1 && (
            <button
              type="button"
              aria-label="Next"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i == null ? i : Math.min(photos.length - 1, i + 1))); }}
              className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          <img
            src={displaySrc(photos[lightboxIdx])}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">
            {lightboxIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}

function SignaturePad({ value, signedAt, signerName, onChange }: { value: string | null; signedAt?: string | null; signerName: string; onChange: (sig: string | null, name: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [name, setName] = useState(signerName ?? "");
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
      setEmpty(false);
    }
  }, []); // eslint-disable-line

  function pos(e: any) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - rect.left;
    const y = (t ? t.clientY : e.clientY) - rect.top;
    return { x, y };
  }
  function start(e: any) { e.preventDefault(); drawing.current = true; lastPt.current = pos(e); }
  function move(e: any) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current!.x, lastPt.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPt.current = p;
    setEmpty(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"), name);
  }
  function clear() {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null, name);
  }

  return (
    <div className="space-y-2">
      <Label>Patient signature</Label>
      <div className="rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full touch-none rounded-lg"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Print name" value={name} onChange={(e) => { setName(e.target.value); onChange(value, e.target.value); }} className="max-w-xs" />
        <Button size="sm" variant="outline" onClick={clear} disabled={empty && !value}>Clear</Button>
        {signedAt && <Badge variant="secondary">Signed {new Date(signedAt).toLocaleString()}</Badge>}
      </div>
    </div>
  );
}

/* Simple face map – tap to drop labelled pins on an SVG face outline */
function FaceMap({ value, onChange }: { value: { x: number; y: number; label: string }[]; onChange: (v: any) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  function add(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM()!.inverse();
    const local = pt.matrixTransform(m);
    const label = prompt("Pin label (e.g. Frown lines)") ?? "";
    if (!label.trim()) return;
    onChange([...(value ?? []), { x: local.x, y: local.y, label }]);
  }
  function remove(i: number) {
    if (!confirm("Remove this pin?")) return;
    onChange(value.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Face map</Label>
        <span className="text-xs text-muted-foreground">Tap to drop a pin</span>
      </div>
      <div className="overflow-hidden rounded-lg border bg-muted/30 p-2">
        <svg ref={svgRef} viewBox="0 0 200 260" className="block w-full" onClick={add}>
          {/* Face outline */}
          <ellipse cx="100" cy="120" rx="70" ry="95" fill="#fce7d6" stroke="#c08868" strokeWidth="1.5" />
          {/* Eyes */}
          <ellipse cx="72" cy="105" rx="9" ry="5" fill="#fff" stroke="#444" />
          <ellipse cx="128" cy="105" rx="9" ry="5" fill="#fff" stroke="#444" />
          <circle cx="72" cy="105" r="2.5" fill="#333" />
          <circle cx="128" cy="105" r="2.5" fill="#333" />
          {/* Brows */}
          <path d="M60 92 Q72 86 84 92" fill="none" stroke="#5a3" strokeWidth="2" />
          <path d="M116 92 Q128 86 140 92" fill="none" stroke="#5a3" strokeWidth="2" />
          {/* Nose */}
          <path d="M100 110 L94 140 Q100 145 106 140 Z" fill="none" stroke="#a76" strokeWidth="1.5" />
          {/* Lips */}
          <path d="M82 170 Q100 162 118 170 Q100 180 82 170 Z" fill="#e89a8a" stroke="#a55" />
          {/* Pins */}
          {(value ?? []).map((p, i) => (
            <g key={i} onClick={(e) => { e.stopPropagation(); remove(i); }} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r="4" fill="#dc2626" stroke="#fff" strokeWidth="1.5" />
              <text x={p.x + 6} y={p.y + 3} fontSize="7" fill="#111" style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 2 }}>{p.label}</text>
            </g>
          ))}
        </svg>
      </div>
      {value?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">{p.label}</Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
