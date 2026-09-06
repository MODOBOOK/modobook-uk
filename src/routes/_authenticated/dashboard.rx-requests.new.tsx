import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listLinkedPartners, createRxRequest } from "@/lib/rx-requests.functions";
import { Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/rx-requests/new")({
  head: () => ({ meta: [{ title: "New prescription request | MODO" }] }),
  component: NewRxRequest,
});

function NewRxRequest() {
  const navigate = useNavigate();
  const fetchPartners = useServerFn(listLinkedPartners);
  const submit = useServerFn(createRxRequest);
  const partnersQ = useQuery({
    queryKey: ["rx-partners", "prescriber"],
    queryFn: () => fetchPartners({ data: { kind: "prescriber" } }),
  });

  const [form, setForm] = useState({
    prescriber_id: "",
    patient_full_name: "",
    patient_dob: "",
    allergies: "",
    treatment_name: "",
    product_name: "",
    dose: "",
    units: "",
    area: "",
    batch_number: "",
    clinical_notes: "",
    medical_history: "",
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.prescriber_id || !form.treatment_name || !form.patient_full_name) {
      toast.error("Please fill required fields");
      return;
    }
    setBusy(true);
    try {
      const { id } = await submit({
        data: {
          prescriber_id: form.prescriber_id,
          treatment_name: form.treatment_name,
          product_name: form.product_name || null,
          dose: form.dose || null,
          units: form.units || null,
          area: form.area || null,
          batch_number: form.batch_number || null,
          clinical_notes: form.clinical_notes || null,
          patient_snapshot: {
            full_name: form.patient_full_name,
            dob: form.patient_dob || undefined,
            allergies: form.allergies || undefined,
          },
          medical_history: form.medical_history ? { notes: form.medical_history } : {},
        },
      });
      toast.success("Request sent", { description: "You can now attach photos and chat." });
      navigate({ to: "/prescriber/requests/$id", params: { id } });
    } catch (e) {
      toast.error("Failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Prescriber</CardTitle></CardHeader>
          <CardContent>
            <Label>Send to</Label>
            <Select value={form.prescriber_id} onValueChange={(v) => set("prescriber_id", v)}>
              <SelectTrigger><SelectValue placeholder={partnersQ.isLoading ? "Loading…" : "Choose a linked prescriber"} /></SelectTrigger>
              <SelectContent>
                {(partnersQ.data ?? []).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {partnersQ.data && partnersQ.data.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">You have no linked prescribers yet. Add a hub code from the Prescriber Hub first.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Patient</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Full name *</Label>
              <Input value={form.patient_full_name} onChange={(e) => set("patient_full_name", e.target.value)} required />
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input type="date" value={form.patient_dob} onChange={(e) => set("patient_dob", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Known allergies</Label>
              <Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Treatment</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Treatment *</Label>
              <Input value={form.treatment_name} onChange={(e) => set("treatment_name", e.target.value)} placeholder="e.g. Botulinum toxin A — upper face" required />
            </div>
            <div><Label>Product</Label><Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} /></div>
            <div><Label>Dose</Label><Input value={form.dose} onChange={(e) => set("dose", e.target.value)} /></div>
            <div><Label>Units</Label><Input value={form.units} onChange={(e) => set("units", e.target.value)} /></div>
            <div><Label>Area</Label><Input value={form.area} onChange={(e) => set("area", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Batch number</Label><Input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} /></div>
            <div className="md:col-span-2">
              <Label>Clinical notes</Label>
              <Textarea rows={4} value={form.clinical_notes} onChange={(e) => set("clinical_notes", e.target.value)} placeholder="Consultation summary, indication, rationale…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Medical history</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={4} value={form.medical_history} onChange={(e) => set("medical_history", e.target.value)} placeholder="Relevant PMH, medications, pregnancy/breastfeeding status…" />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            <Send className="h-4 w-4 mr-1" /> {busy ? "Sending…" : "Send request"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">You can add clinical photos, consent PDFs and before/after images once the request is created.</p>
      </form>
    </div>
  );
}
