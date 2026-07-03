import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type FormElement = {
  id: string;
  type: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
  variant?: string;
  max?: number;

  text?: string;
  level?: 1 | 2 | 3;
  fieldType?: string;
  logic?: { showIfId: string; equals: string } | null;
};
type FormStep = { id: string; title: string; elements: FormElement[] };
type FormSearch = { returnTo?: string };

export const Route = createFileRoute("/f/$token")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): FormSearch => ({
    returnTo: typeof s.returnTo === "string" && s.returnTo.startsWith("/m/") ? s.returnTo : undefined,
  }),
  component: FillFormPage,
});

function normalizeMedicalSchema(schema: unknown): FormStep[] {
  if (schema && typeof schema === "object" && !Array.isArray(schema) && Array.isArray((schema as { steps?: unknown }).steps)) {
    return ((schema as { steps: any[] }).steps ?? []).map((step, index) => ({
      id: String(step.id ?? `step-${index}`),
      title: String(step.title ?? `Section ${index + 1}`),
      elements: normalizeElements(step.elements),
    }));
  }

  if (Array.isArray(schema)) {
    return schema.map((group: any, index) => ({
      id: String(group.id ?? group.group ?? `group-${index}`),
      title: String(group.title ?? group.group ?? `Section ${index + 1}`),
      elements: normalizeElements(Array.isArray(group.elements) ? group.elements : group.questions),
    }));
  }

  return [];
}

function normalizeElements(elements: unknown): FormElement[] {
  if (!Array.isArray(elements)) return [];
  return elements.map((el: any, index) => {
    const id = String(el.id ?? `field-${index}`);
    const base = { ...el, id, label: el.label ?? el.text ?? `Question ${index + 1}` } as FormElement;

    if (el.type === "yesno") return { ...base, type: "radio", options: ["Yes", "No"] };
    if (el.type === "checkboxes") return { ...base, type: "checkbox_group", options: Array.isArray(el.options) ? el.options : [] };
    if (!el.type || el.type === "text" || el.type === "date" || el.type === "tel" || el.type === "email") {
      return { ...base, type: "field", fieldType: el.fieldType ?? el.type ?? "text" };
    }

    return base;
  });
}

function isVisible(el: FormElement, responses: Record<string, any>): boolean {
  if (!el.logic || !el.logic.showIfId) return true;
  const v = responses[el.logic.showIfId];
  const target = el.logic.equals;
  if (!target) return true;
  if (Array.isArray(v)) return v.includes(target);
  if (typeof v === "boolean") return (target === "Checked") === v;
  return String(v ?? "") === target;
}

type ClientContact = Record<string, any> | null | undefined;

// Match a field label/id to a contact field. Only non-medical demographic/contact info.
function matchContactKey(el: FormElement): keyof NonNullable<ClientContact> | null {
  const raw = `${el.id ?? ""} ${el.label ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!raw) return null;
  const has = (...tokens: string[]) => tokens.every((t) => raw.includes(t));
  const any = (...tokens: string[]) => tokens.some((t) => raw.includes(t));

  if (has("emergency") && any("phone", "tel", "mobile", "number")) return "emergency_contact_phone";
  if (has("emergency") && any("name", "contact")) return "emergency_contact_name";
  if (any("gp") && any("address")) return "gp_address";
  if (any("gp", "doctor", "surgery") && any("name", "practice")) return "gp_name";
  if (any("postcode", "postal", "zip")) return "postcode";
  if (has("address", "1") || has("address", "line", "1") || has("street")) return "address_line1";
  if (has("address", "2") || has("address", "line", "2")) return "address_line2";
  if (any("city", "town")) return "city";
  if (any("county", "state", "region")) return "county";
  if (any("country")) return "country";
  if (raw === "address" || any("address")) return "address";
  if (any("email")) return "email";
  if (any("phone", "mobile", "tel", "telephone")) return "phone";
  if (any("dob", "birth") || (any("date") && any("birth"))) return "dob";
  if (any("gender", "sex")) return "gender";
  if (any("name") && !any("clinic", "practitioner", "doctor", "gp", "emergency", "next", "kin", "referrer", "signature")) return "full_name";
  return null;
}

// Only pre-fill safe, non-medical field types. Never signature/consent/checkbox groups.
function isPrefillableType(el: FormElement): boolean {
  if (el.type === "field") {
    const ft = el.fieldType ?? "text";
    return ["text", "email", "tel", "date", "textarea"].includes(ft);
  }
  return el.type === "select";
}

function buildPrefill(steps: FormStep[], contact: ClientContact): Record<string, any> {
  if (!contact) return {};
  const out: Record<string, any> = {};
  for (const step of steps) {
    for (const el of step.elements) {
      if (!isPrefillableType(el)) continue;
      const key = matchContactKey(el);
      if (!key) continue;
      const v = contact[key];
      if (v == null || v === "") continue;
      out[el.id] = String(v);
    }
  }
  return out;
}


function FillFormPage() {
  const { token } = useParams({ from: "/f/$token" });
  const search = useSearch({ from: "/f/$token" });

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [fallbackSlug, setFallbackSlug] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/medical-form/${encodeURIComponent(token)}`);
        const payload = await res.json().catch(() => ({}));
        const r = payload.form ? { ...payload.form, template_schema: normalizeMedicalSchema(payload.form.template_schema) } : null;
        setData(r);
        if (r?.status === "submitted") setDone(true);
        if (r?.response && Object.keys(r.response).length > 0) {
          setResponses(r.response);
        } else if (r?.client_contact && r.status !== "submitted") {
          const pf = buildPrefill(r.template_schema, r.client_contact);
          if (Object.keys(pf).length > 0) {
            setResponses(pf);
            setPrefilled(true);
          }
        }
        if (!r || payload.fallbackSlug) setFallbackSlug(payload.fallbackSlug ?? r?.slug ?? null);
      } catch {
        setData(null);
      } finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <Centered><Loader2 className="h-6 w-6 animate-spin" /></Centered>;
  const backHref = search.returnTo ?? (fallbackSlug ? `/m/${fallbackSlug}` : data?.slug ? `/m/${data.slug}` : "/");
  if (!data) return (
    <Centered>
      <Card className="max-w-md p-8 text-center">
        <h2 className="mb-1 text-xl font-bold">Form unavailable</h2>
        <p className="text-sm text-muted-foreground">This form link may have expired or already been completed.</p>
        <a href={backHref} className="mt-5 inline-block">
          <Button>Back to clinic</Button>
        </a>
      </Card>
    </Centered>
  );

  const steps: FormStep[] = Array.isArray(data.template_schema) ? data.template_schema : [];
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  if (!steps.length || !step) {
    return (
      <Centered>
        <Card className="max-w-md p-8 text-center">
          <h2 className="mb-1 text-xl font-bold">Form unavailable</h2>
          <p className="text-sm text-muted-foreground">This medical form does not have any questions ready to complete yet.</p>
          <a href={backHref} className="mt-5 inline-block">
            <Button style={data.brand_color ? { backgroundColor: data.brand_color, color: "white" } : undefined}>
              Back to {data.clinic_name || "clinic"}
            </Button>
          </a>
        </Card>
      </Centered>
    );
  }

  if (done) {
    return (
      <Centered>
        <Card className="max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h2 className="mb-1 text-xl font-bold">All done</h2>
          <p className="text-sm text-muted-foreground">Thanks {data.patient_name}. Your form has been sent to {data.clinic_name}.</p>
          <a href={backHref} className="mt-5 inline-block">
            <Button style={data.brand_color ? { backgroundColor: data.brand_color, color: "white" } : undefined}>
              Back to {data.clinic_name || "clinic"}
            </Button>
          </a>
        </Card>
      </Centered>
    );
  }

  function setField(id: string, v: any) {
    setResponses((s) => ({ ...s, [id]: v }));
  }

  function validateStep() {
    for (const el of step.elements) {
      if (!el.required) continue;
      if (!isVisible(el, responses)) continue;
      const v = responses[el.id];
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) {
        toast.error(`Please complete: ${el.label}`);
        return false;
      }
    }
    return true;
  }

  async function next() {
    if (!validateStep()) return;
    if (!isLast) { setStepIdx((i) => i + 1); window.scrollTo(0, 0); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/medical-form/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: responses }),
      });
      const r = await res.json().catch(() => ({ ok: false }));
      if (r.ok) setDone(true);
      else toast.error("Failed to submit");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="border-b bg-card px-4 py-4" style={data.brand_color ? { backgroundColor: data.brand_color, color: "white" } : undefined}>
        <div className="mx-auto max-w-2xl">
          <div className="text-xs opacity-80">{data.clinic_name}</div>
          <h1 className="text-xl font-bold">{data.template_name}</h1>
          <div className="text-xs opacity-80">For {data.patient_name} · {data.scheduled_date} {String(data.start_time).slice(0, 5)} · {data.treatment_name}</div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Step {stepIdx + 1} of {steps.length}
          <div className="ml-auto flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        {prefilled && stepIdx === 0 && (
          <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-900">
            We've pre-filled some of your contact details from your record. Please review and update anything that's changed. Medical questions must be answered fresh each visit.
          </div>
        )}


        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-bold">{step.title}</h2>
          {step.elements.filter((el) => isVisible(el, responses)).map((el) => <RenderElement key={el.id} el={el} value={responses[el.id]} onChange={(v) => setField(el.id, v)} />)}
        </Card>

        <div className="flex gap-2">
          {stepIdx > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStepIdx((i) => i - 1)}>Back</Button>
          )}
          <Button className="flex-1" onClick={next} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLast ? "Submit" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RenderElement({ el, value, onChange }: { el: FormElement; value: any; onChange: (v: any) => void }) {
  const reqMark = el.required ? <span className="text-destructive"> *</span> : null;
  const help = el.helpText ? <p className="text-xs text-muted-foreground">{el.helpText}</p> : null;

  if (el.type === "heading") {
    const T = (el.level === 1 ? "h1" : el.level === 3 ? "h3" : "h2") as any;
    const cls = el.level === 1 ? "text-2xl font-bold" : el.level === 3 ? "text-base font-bold" : "text-lg font-bold";
    return <T className={cls}>{el.text}</T>;
  }
  if (el.type === "paragraph") return <p className="text-sm text-muted-foreground">{el.text}</p>;
  if (el.type === "info") {
    const tones: Record<string, string> = {
      info: "border-sky-300 bg-sky-50 text-sky-900",
      warning: "border-amber-300 bg-amber-50 text-amber-900",
      success: "border-emerald-300 bg-emerald-50 text-emerald-900",
    };
    return <div className={`rounded-md border p-3 text-sm ${tones[(el as any).variant ?? "info"]}`}>{el.text}</div>;
  }
  if (el.type === "separator") return <hr />;
  if (el.type === "space") return <div className="h-3" />;
  if (el.type === "field") {
    const t = el.fieldType ?? "text";
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{reqMark}</Label>
        {t === "textarea" ? (
          <Textarea rows={3} placeholder={el.placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <Input type={t} placeholder={el.placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        )}
        {help}
      </div>
    );
  }
  if (el.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{reqMark}</Label>
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {(el.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {help}
      </div>
    );
  }
  if (el.type === "radio") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{reqMark}</Label>
        <div className="space-y-1.5">
          {(el.options ?? []).map((o) => (
            <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm ${value === o ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name={el.id} checked={value === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {help}
      </div>
    );
  }
  if (el.type === "checkbox_group") {
    const arr: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{reqMark}</Label>
        <div className="space-y-1.5">
          {(el.options ?? []).map((o) => {
            const checked = arr.includes(o);
            return (
              <label key={o} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm ${checked ? "border-primary bg-primary/5" : ""}`}>
                <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(c) => onChange(c ? [...arr, o] : arr.filter((x) => x !== o))} />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
        {help}
      </div>
    );
  }
  if (el.type === "checkbox") {
    return (
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
          <span>{el.label}{reqMark}</span>
        </label>
        {help}
      </div>
    );
  }
  if (el.type === "rating") {
    const max = (el as any).max ?? 5;
    const v = Number(value) || 0;
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{reqMark}</Label>
        <div className="flex gap-1">
          {Array.from({ length: max }).map((_, i) => (
            <button key={i} type="button" onClick={() => onChange(i + 1)} className="text-2xl leading-none">
              <span className={i < v ? "text-amber-500" : "text-muted-foreground/40"}>★</span>
            </button>
          ))}
        </div>
        {help}
      </div>
    );
  }
  if (el.type === "signature") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{reqMark}</Label>
        <SignaturePad
          value={typeof value === "string" && value.startsWith("data:image") ? value : null}
          onChange={(v) => onChange(v ?? "")}
        />
        {help}
      </div>
    );
  }
  return null;
}


function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;
}
