import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listMyConnectedPractitioners } from "@/lib/clinic-visits.functions";
import { createWalkIn, listLinkedPractitionerMedicalForms } from "@/lib/prescriber-directions.functions";

export function WalkInDialog({ trigger, onCreated }: { trigger: React.ReactNode; onCreated?: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const fetchLinks = useServerFn(listMyConnectedPractitioners);
  const create = useServerFn(createWalkIn);
  const fetchForms = useServerFn(listLinkedPractitionerMedicalForms);
  const linksQ = useQuery({ queryKey: ["my-linked-practitioners"], queryFn: () => fetchLinks(), enabled: open });
  const links = linksQ.data ?? [];
  const [formSearch, setFormSearch] = useState("");
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    practitioner_profile_id: "",
    patient_name: "",
    patient_email: "",
    patient_phone: "",
    patient_dob: "",
    note: "",
  });

  const formsQ = useQuery({
    queryKey: ["linked-practitioner-medical-forms", form.practitioner_profile_id],
    queryFn: () => fetchForms({ data: { practitioner_profile_id: form.practitioner_profile_id } }),
    enabled: open && !!form.practitioner_profile_id,
  });
  const medicalForms = (formsQ.data ?? []) as { id: string; name: string; description?: string | null; is_system?: boolean }[];
  const filteredForms = useMemo(() => {
    const q = formSearch.trim().toLowerCase();
    return q ? medicalForms.filter((f) => `${f.name} ${f.description ?? ""}`.toLowerCase().includes(q)) : medicalForms;
  }, [medicalForms, formSearch]);

  useEffect(() => {
    if (open && !form.practitioner_profile_id && links.length === 1) {
      setForm((f) => ({ ...f, practitioner_profile_id: links[0].profile_id }));
    }
  }, [open, links, form.practitioner_profile_id]);

  function toggleForm(id: string) {
    setSelectedFormIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!form.practitioner_profile_id) return toast.error("Pick a practitioner");
    if (!form.patient_name.trim()) return toast.error("Patient name required");
    try {
      const res = await create({ data: { ...form, medical_form_template_ids: Array.from(selectedFormIds) } });
      toast.success("Walk-in started");
      qc.invalidateQueries({ queryKey: ["my-referrals"] });
      qc.invalidateQueries({ queryKey: ["prescriber-analytics"] });
      qc.invalidateQueries({ queryKey: ["prescriber-nav-refs"] });
      setOpen(false);
      setSelectedFormIds(new Set());
      setFormSearch("");
      onCreated?.(res.id);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New walk-in consultation</DialogTitle>
        </DialogHeader>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren't linked to any practitioners yet. Head to Practitioners to link first.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Practitioner / clinic</Label>
              <Select value={form.practitioner_profile_id} onValueChange={(v) => { setForm({ ...form, practitioner_profile_id: v }); setSelectedFormIds(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Choose practitioner" /></SelectTrigger>
                <SelectContent>
                  {links.map((l) => <SelectItem key={l.profile_id} value={l.profile_id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Patient full name</Label><Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} /></div>
              <div><Label>Date of birth</Label><Input type="date" value={form.patient_dob} onChange={(e) => setForm({ ...form, patient_dob: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.patient_email} onChange={(e) => setForm({ ...form, patient_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.patient_phone} onChange={(e) => setForm({ ...form, patient_phone: e.target.value })} /></div>
            </div>
            <div><Label>Notes (visible to practitioner)</Label><Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Reason for walk-in consult, chaperone present, etc." /></div>
            {form.practitioner_profile_id && (
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label className="m-0">Medical forms to load</Label>
                  {selectedFormIds.size > 0 && <Badge variant="secondary">{selectedFormIds.size} selected</Badge>}
                </div>
                <Input
                  value={formSearch}
                  onChange={(e) => setFormSearch(e.target.value)}
                  placeholder="Search medical forms…"
                  className="mb-2"
                />
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {formsQ.isLoading ? (
                    <p className="py-2 text-xs text-muted-foreground">Loading forms…</p>
                  ) : filteredForms.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">No medical forms found for this practitioner.</p>
                  ) : filteredForms.map((mf) => (
                    <label key={mf.id} className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2 text-sm hover:bg-accent/40">
                      <Checkbox checked={selectedFormIds.has(mf.id)} onCheckedChange={() => toggleForm(mf.id)} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{mf.name}</span>
                        {mf.description ? <span className="block truncate text-xs text-muted-foreground">{mf.description}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={links.length === 0}>Start walk-in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
