import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getConsultation } from "@/lib/consultations.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ClipboardList, ExternalLink, Loader2, FileText } from "lucide-react";

type Props = {
  id: string;
  createdAt: string;
  status: string;
  currentStep: number;
};

export function ConsultationDocCard({ id, createdAt, status, currentStep }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<any>(null);
  const get = useServerFn(getConsultation);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !doc) {
      setLoading(true);
      try {
        const r = await get({ data: { id } });
        setDoc(r);
      } catch (e: any) {
        // noop
      } finally {
        setLoading(false);
      }
    }
  }

  const completed = status === "completed";

  return (
    <div className="rounded-md border bg-card">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="font-medium">Consultation</span>
          <span className="text-muted-foreground">· {new Date(createdAt).toLocaleDateString()}</span>
        </span>
        <span className="flex items-center gap-2">
          <Badge variant={completed ? "default" : "secondary"} className="text-[10px]">
            {completed ? "Completed" : `Step ${currentStep}/8`}
          </Badge>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t bg-muted/20 px-4 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading document…
            </div>
          )}
          {doc && (
            <div className="mx-auto max-w-3xl rounded-md border bg-white p-5 text-[13px] leading-relaxed text-slate-800 shadow-sm dark:bg-zinc-50">
              {/* Header */}
              <div className="mb-4 border-b pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                      <FileText className="h-3.5 w-3.5" /> Consultation Record
                    </div>
                    <h3 className="mt-0.5 text-lg font-semibold text-slate-900">{doc.patient_name}</h3>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>Created: {new Date(doc.created_at).toLocaleString()}</div>
                    {doc.completed_at && <div>Completed: {new Date(doc.completed_at).toLocaleString()}</div>}
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-4 text-[11px] text-slate-500">
                  {doc.patient_email && <div>Email: {doc.patient_email}</div>}
                  {doc.patient_phone && <div>Phone: {doc.patient_phone}</div>}
                </div>
              </div>

              <DocSection title="1. Medical history">
                <MedicalSummary data={doc.medical} />
              </DocSection>

              <DocSection title="2. Concerns">
                <ConcernsSummary data={doc.concerns} />
              </DocSection>

              <DocSection title="3. Assessment">
                <AssessmentSummary data={doc.assessment} beforePhotos={doc.before_photos} />
                <PhotoStrip photos={doc.before_photos} label="Before" />
              </DocSection>

              <DocSection title="4. Treatment plan">
                <PlanSummary data={doc.treatment_plan} />
              </DocSection>

              <DocSection title="5. Consent">
                <ConsentSummary data={doc.consent} />
              </DocSection>

              <DocSection title="6. After photos">
                <PhotoStrip photos={doc.after_photos} label="After" />
              </DocSection>

              <DocSection title="7. Treatment log">
                <TreatmentLogSummary data={doc.treatment_log} />
              </DocSection>

              <DocSection title="8. Invoice & payment">
                <InvoiceSummary data={doc.invoice} />
              </DocSection>

              {doc.notes && (
                <DocSection title="Practitioner notes">
                  <p className="whitespace-pre-wrap text-slate-700">{doc.notes}</p>
                </DocSection>
              )}

              <div className="mt-4 flex justify-end">
                <Button asChild size="sm" variant="outline">
                  <Link to="/dashboard/consultations/$id" params={{ id }}>
                    Open full consultation <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
      <div className="text-slate-800">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="italic text-slate-400">Not recorded.</p>;
}

function isEmpty(obj: any) {
  if (!obj) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === "object") return Object.keys(obj).length === 0;
  return !String(obj).trim();
}

function MedicalSummary({ data }: { data: any }) {
  if (isEmpty(data)) return <Empty />;
  const conditions = data.conditions || data.medical_conditions || {};
  const meds = data.medications;
  const allergies = data.allergies;
  const flagged = Object.entries(conditions).filter(([_, v]) => v === true || v === "yes").map(([k]) => k);
  return (
    <ul className="space-y-0.5">
      {flagged.length > 0 && <li><strong>Flagged conditions:</strong> {flagged.join(", ")}</li>}
      {allergies && <li><strong>Allergies:</strong> {String(allergies)}</li>}
      {meds && <li><strong>Medications:</strong> {String(meds)}</li>}
      {data.pregnant && <li><strong>Pregnant / breastfeeding:</strong> Yes</li>}
      {data.notes && <li><strong>Notes:</strong> {data.notes}</li>}
      {flagged.length === 0 && !allergies && !meds && !data.notes && (
        <li className="text-slate-500">No significant medical history recorded.</li>
      )}
    </ul>
  );
}

function ConcernsSummary({ data }: { data: any }) {
  if (isEmpty(data)) return <Empty />;
  const list: string[] = data.selected || data.concerns || [];
  return (
    <>
      {list.length > 0 && <p>{list.join(" · ")}</p>}
      {data.notes && <p className="mt-1 text-slate-700">{data.notes}</p>}
      {list.length === 0 && !data.notes && <Empty />}
    </>
  );
}

function AssessmentSummary({ data, beforePhotos }: { data: any; beforePhotos: any }) {
  const hasText = data?.notes || data?.summary;
  const pins = data?.pins?.length || data?.map?.pins?.length || 0;
  const before = Array.isArray(beforePhotos) ? beforePhotos.length : 0;
  if (!hasText && !pins && !before) return <Empty />;
  return (
    <ul className="space-y-0.5">
      {hasText && <li>{data.notes || data.summary}</li>}
      {pins > 0 && <li><strong>Face map (plan):</strong> {pins} marker{pins === 1 ? "" : "s"}</li>}
      {before > 0 && <li><strong>Before photos:</strong> {before} attached</li>}
    </ul>
  );
}

function PlanSummary({ data }: { data: any }) {
  if (isEmpty(data)) return <Empty />;
  const items = data.items || data.treatments || [];
  return (
    <>
      {Array.isArray(items) && items.length > 0 && (
        <ul className="list-disc pl-5">
          {items.map((it: any, i: number) => (
            <li key={i}>{typeof it === "string" ? it : (it.name || it.title || JSON.stringify(it))}</li>
          ))}
        </ul>
      )}
      {data.notes && <p className="mt-1">{data.notes}</p>}
      {(!items.length && !data.notes) && <Empty />}
    </>
  );
}

function ConsentSummary({ data }: { data: any }) {
  if (isEmpty(data)) return <Empty />;
  const signed = data.signed || data.signature_data_url || data.signed_at;
  return (
    <ul className="space-y-0.5">
      <li><strong>Status:</strong> {signed ? "Signed" : "Not signed"}</li>
      {data.signed_at && <li><strong>Signed at:</strong> {new Date(data.signed_at).toLocaleString()}</li>}
      {data.photo_consent && <li><strong>Photo consent:</strong> {Object.entries(data.photo_consent).filter(([_, v]) => v).map(([k]) => k).join(", ") || "None"}</li>}
    </ul>
  );
}

function PhotoCount({ data, label }: { data: any; label: string }) {
  const n = Array.isArray(data) ? data.length : 0;
  if (!n) return <Empty />;
  return <p>{n} {label}{n === 1 ? "" : "s"} attached.</p>;
}

function TreatmentLogSummary({ data }: { data: any }) {
  if (isEmpty(data)) return <Empty />;
  const items = data.items || data.products || [];
  return (
    <>
      {Array.isArray(items) && items.length > 0 ? (
        <ul className="list-disc pl-5">
          {items.map((it: any, i: number) => (
            <li key={i}>
              {it.product || it.name}
              {it.batch && <> · Batch {it.batch}</>}
              {it.expiry && <> · Exp {it.expiry}</>}
              {it.amount && <> · {it.amount}</>}
            </li>
          ))}
        </ul>
      ) : data.notes ? <p>{data.notes}</p> : <Empty />}
    </>
  );
}

function InvoiceSummary({ data }: { data: any }) {
  if (isEmpty(data)) return <Empty />;
  return (
    <ul className="space-y-0.5">
      {data.total != null && <li><strong>Total:</strong> £{Number(data.total).toFixed(2)}</li>}
      {data.status && <li><strong>Status:</strong> {data.status}</li>}
      {data.payment_link && <li><strong>Payment link:</strong> sent</li>}
      {data.paid_at && <li><strong>Paid:</strong> {new Date(data.paid_at).toLocaleString()}</li>}
    </ul>
  );
}
