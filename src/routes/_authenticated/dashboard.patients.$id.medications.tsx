import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMedications, upsertMedication, deleteMedication, type Medication } from "@/lib/patient-records.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, Pill, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$id/medications")({
  ssr: false,
  component: MedsPage,
});

function MedsPage() {
  const { id } = Route.useParams();
  const list = useServerFn(listMedications);
  const upsert = useServerFn(upsertMedication);
  const del = useServerFn(deleteMedication);
  const [rows, setRows] = useState<Medication[] | null>(null);
  const [editing, setEditing] = useState<Partial<Medication> | null>(null);

  async function reload() {
    setRows(null);
    try { setRows(await list({ data: { clientId: id } })); }
    catch (e: any) { toast.error(e?.message || "Failed to load"); setRows([]); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  const current = (rows ?? []).filter(r => r.is_current);
  const past = (rows ?? []).filter(r => !r.is_current);

  async function save() {
    if (!editing?.drug?.trim()) return;
    try {
      await upsert({ data: {
        id: editing.id, clientId: id,
        drug: editing.drug!.trim(),
        dose: editing.dose ?? null,
        route: editing.route ?? null,
        frequency: editing.frequency ?? null,
        prescriber: editing.prescriber ?? null,
        started_on: editing.started_on ?? null,
        stopped_on: editing.stopped_on ?? null,
        is_current: editing.is_current ?? true,
        notes: editing.notes ?? null,
      } });
      setEditing(null);
      await reload();
      toast.success("Saved");
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
  }

  async function remove(m: Medication) {
    if (!confirm(`Remove ${m.drug}?`)) return;
    await del({ data: { id: m.id } });
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Medications</h2>
        <Button size="sm" onClick={() => setEditing({ is_current: true })}>
          <Plus className="mr-1 h-4 w-4" />Add medication
        </Button>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Pill className="mx-auto mb-2 h-8 w-8 opacity-50" />No medications recorded.
        </CardContent></Card>
      ) : (
        <>
          <MedGroup title="Current" items={current} onEdit={setEditing} onDelete={remove} />
          {past.length > 0 && <MedGroup title="Past" items={past} onEdit={setEditing} onDelete={remove} muted />}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit medication" : "Add medication"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Drug" required>
                <Input value={editing.drug ?? ""} onChange={e => setEditing({ ...editing, drug: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Dose"><Input value={editing.dose ?? ""} onChange={e => setEditing({ ...editing, dose: e.target.value })} /></Field>
                <Field label="Route"><Input value={editing.route ?? ""} onChange={e => setEditing({ ...editing, route: e.target.value })} placeholder="Oral, IM, topical…" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Frequency"><Input value={editing.frequency ?? ""} onChange={e => setEditing({ ...editing, frequency: e.target.value })} placeholder="Once daily…" /></Field>
                <Field label="Prescriber"><Input value={editing.prescriber ?? ""} onChange={e => setEditing({ ...editing, prescriber: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Started"><Input type="date" value={editing.started_on ?? ""} onChange={e => setEditing({ ...editing, started_on: e.target.value })} /></Field>
                <Field label="Stopped"><Input type="date" value={editing.stopped_on ?? ""} onChange={e => setEditing({ ...editing, stopped_on: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editing.is_current !== false} onCheckedChange={v => setEditing({ ...editing, is_current: !!v })} />
                Currently taking
              </label>
              <Field label="Notes"><Textarea rows={2} value={editing.notes ?? ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!editing?.drug?.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}{required && " *"}</Label>
      {children}
    </div>
  );
}

function MedGroup({ title, items, onEdit, onDelete, muted }: {
  title: string; items: Medication[]; onEdit: (m: Medication) => void; onDelete: (m: Medication) => void; muted?: boolean;
}) {
  return (
    <div>
      <div className={"mb-2 text-sm font-medium " + (muted ? "text-muted-foreground" : "")}>{title} ({items.length})</div>
      <div className="space-y-2">
        {items.map(m => (
          <Card key={m.id} className={muted ? "opacity-75" : ""}>
            <CardContent className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{m.drug}</div>
                  {m.dose && <Badge variant="outline" className="text-[10px]">{m.dose}</Badge>}
                  {m.route && <Badge variant="outline" className="text-[10px]">{m.route}</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {[m.frequency, m.prescriber && `Prescriber: ${m.prescriber}`, m.started_on && `From ${m.started_on}`, m.stopped_on && `Stopped ${m.stopped_on}`].filter(Boolean).join(" · ")}
                </div>
                {m.notes && <div className="mt-1 text-xs text-muted-foreground">{m.notes}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(m)}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
