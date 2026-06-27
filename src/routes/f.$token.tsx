import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFormByToken, submitFormByToken } from "@/lib/medical-forms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/f/$token")({
  ssr: false,
  component: FillFormPage,
});

type FormElement = {
  id: string;
  type: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  text?: string;
  level?: 1 | 2 | 3;
  fieldType?: string;
};
type FormStep = { id: string; title: string; elements: FormElement[] };

function FillFormPage() {
  const { token } = useParams({ from: "/f/$token" });
  const fetchOne = useServerFn(getFormByToken);
  const submit = useServerFn(submitFormByToken);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r: any = await fetchOne({ data: { token } });
        setData(r);
        if (r?.status === "submitted") setDone(true);
        if (r?.response) setResponses(r.response);
      } catch {
        setData(null);
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, [token]);

  if (loading) return <Centered><Loader2 className="h-6 w-6 animate-spin" /></Centered>;
  if (!data) return <Centered><p className="text-sm text-muted-foreground">Form not found or expired.</p></Centered>;

  const steps: FormStep[] = data.template_schema?.steps ?? [];
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  if (done) {
    return (
      <Centered>
        <Card className="max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h2 className="mb-1 text-xl font-bold">All done</h2>
          <p className="text-sm text-muted-foreground">Thanks {data.patient_name}. Your form has been sent to {data.clinic_name}.</p>
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
      const r: any = await submit({ data: { token, response: responses } });
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

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-bold">{step.title}</h2>
          {step.elements.map((el) => <RenderElement key={el.id} el={el} value={responses[el.id]} onChange={(v) => setField(el.id, v)} />)}
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
  if (el.type === "heading") {
    const T = (el.level === 1 ? "h1" : el.level === 3 ? "h3" : "h2") as any;
    const cls = el.level === 1 ? "text-2xl font-bold" : el.level === 3 ? "text-base font-bold" : "text-lg font-bold";
    return <T className={cls}>{el.text}</T>;
  }
  if (el.type === "paragraph") return <p className="text-sm text-muted-foreground">{el.text}</p>;
  if (el.type === "separator") return <hr />;
  if (el.type === "space") return <div className="h-3" />;
  if (el.type === "field") {
    const t = el.fieldType ?? "text";
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{el.required && <span className="text-destructive"> *</span>}</Label>
        {t === "textarea" ? (
          <Textarea rows={3} placeholder={el.placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <Input type={t} placeholder={el.placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
    );
  }
  if (el.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{el.required && <span className="text-destructive"> *</span>}</Label>
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {(el.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (el.type === "checkbox") {
    return (
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
        <span>{el.label}{el.required && <span className="text-destructive"> *</span>}</span>
      </label>
    );
  }
  if (el.type === "signature") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{el.label}{el.required && <span className="text-destructive"> *</span>}</Label>
        <Input placeholder="Type your full name to sign" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        <p className="text-xs text-muted-foreground">By typing your name you confirm your electronic signature.</p>
      </div>
    );
  }
  return null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;
}
