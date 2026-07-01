import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  listMySnippets, upsertSnippet, deleteSnippet,
  listMyRxTemplates, upsertRxTemplate, deleteRxTemplate,
} from "@/lib/prescriber-directions.functions";

export const Route = createFileRoute("/_authenticated/prescriber/directions")({
  ssr: false,
  component: DirectionsPage,
});

function DirectionsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Directions library</h2>
        <p className="text-sm text-muted-foreground">Reusable snippets and full prescription templates you can drop into any script.</p>
      </div>
      <Tabs defaultValue="snippets">
        <TabsList>
          <TabsTrigger value="snippets">Snippets</TabsTrigger>
          <TabsTrigger value="templates">Full Rx templates</TabsTrigger>
        </TabsList>
        <TabsContent value="snippets" className="pt-4"><SnippetsTab /></TabsContent>
        <TabsContent value="templates" className="pt-4"><TemplatesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Snippets -------- */
type Snippet = { id: string; label: string; body: string; category: string | null; sort_order: number };
function SnippetsTab() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMySnippets);
  const del = useServerFn(deleteSnippet);
  const q = useQuery({ queryKey: ["snippets"], queryFn: () => fetchList() });
  const rows = (q.data ?? []) as Snippet[];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SnippetDialog trigger={<Button size="sm"><Plus className="mr-1 h-4 w-4" />New snippet</Button>} onSaved={() => qc.invalidateQueries({ queryKey: ["snippets"] })} />
      </div>
      {rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No snippets yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  {s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}
                </div>
                <div className="flex gap-1">
                  <SnippetDialog snippet={s} trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>} onSaved={() => qc.invalidateQueries({ queryKey: ["snippets"] })} />
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm("Delete snippet?")) return;
                    await del({ data: { id: s.id } });
                    qc.invalidateQueries({ queryKey: ["snippets"] });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent><pre className="whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</pre></CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
function SnippetDialog({ snippet, trigger, onSaved }: { snippet?: Snippet; trigger: React.ReactNode; onSaved: () => void }) {
  const save = useServerFn(upsertSnippet);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: snippet?.id ?? null,
    label: snippet?.label ?? "",
    category: snippet?.category ?? "",
    body: snippet?.body ?? "",
    sort_order: snippet?.sort_order ?? 0,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{snippet ? "Edit snippet" : "New snippet"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div><Label>Category (optional)</Label><Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Aftercare, Injectables" /></div>
          <div><Label>Body</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              await save({ data: { ...form, category: form.category || null } });
              toast.success("Snippet saved");
              setOpen(false);
              onSaved();
            } catch (e) { toast.error((e as Error).message); }
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Full Rx templates -------- */
type RxTpl = { id: string; label: string; drug_name: string; drug_form: string | null; drug_strength: string | null; dose: string | null; quantity: string | null; directions: string | null; repeats_allowed: number; validity_days: number | null; notes: string | null; sort_order: number };
function TemplatesTab() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyRxTemplates);
  const del = useServerFn(deleteRxTemplate);
  const q = useQuery({ queryKey: ["rx-templates"], queryFn: () => fetchList() });
  const rows = (q.data ?? []) as RxTpl[];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <TemplateDialog trigger={<Button size="sm"><Plus className="mr-1 h-4 w-4" />New Rx template</Button>} onSaved={() => qc.invalidateQueries({ queryKey: ["rx-templates"] })} />
      </div>
      {rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No templates yet.</CardContent></Card>
      ) : rows.map((t) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{t.label}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t.drug_name}{t.drug_strength ? ` · ${t.drug_strength}` : ""}{t.drug_form ? ` · ${t.drug_form}` : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <TemplateDialog template={t} trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>} onSaved={() => qc.invalidateQueries({ queryKey: ["rx-templates"] })} />
              <Button size="icon" variant="ghost" onClick={async () => {
                if (!confirm("Delete template?")) return;
                await del({ data: { id: t.id } });
                qc.invalidateQueries({ queryKey: ["rx-templates"] });
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {t.dose && <div><span className="text-muted-foreground">Dose:</span> {t.dose}</div>}
            {t.quantity && <div><span className="text-muted-foreground">Qty:</span> {t.quantity}</div>}
            <div><span className="text-muted-foreground">Repeats:</span> {t.repeats_allowed}</div>
            {t.validity_days != null && <div><span className="text-muted-foreground">Valid:</span> {t.validity_days}d</div>}
            {t.directions && <div className="sm:col-span-2 whitespace-pre-wrap"><span className="text-muted-foreground">Directions:</span> {t.directions}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function TemplateDialog({ template, trigger, onSaved }: { template?: RxTpl; trigger: React.ReactNode; onSaved: () => void }) {
  const save = useServerFn(upsertRxTemplate);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    id: template?.id ?? null,
    label: template?.label ?? "",
    drug_name: template?.drug_name ?? "",
    drug_form: template?.drug_form ?? "",
    drug_strength: template?.drug_strength ?? "",
    dose: template?.dose ?? "",
    quantity: template?.quantity ?? "",
    directions: template?.directions ?? "",
    repeats_allowed: template?.repeats_allowed ?? 0,
    validity_days: (template?.validity_days ?? 28) as number | null,
    notes: template?.notes ?? "",
    sort_order: template?.sort_order ?? 0,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{template ? "Edit Rx template" : "New Rx template"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Label</Label><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Botulinum – standard glabellar" /></div>
          <div><Label>Drug name</Label><Input value={f.drug_name} onChange={(e) => setF({ ...f, drug_name: e.target.value })} /></div>
          <div><Label>Form</Label><Input value={f.drug_form ?? ""} onChange={(e) => setF({ ...f, drug_form: e.target.value })} placeholder="solution / cream" /></div>
          <div><Label>Strength</Label><Input value={f.drug_strength ?? ""} onChange={(e) => setF({ ...f, drug_strength: e.target.value })} /></div>
          <div><Label>Dose</Label><Input value={f.dose ?? ""} onChange={(e) => setF({ ...f, dose: e.target.value })} /></div>
          <div><Label>Quantity</Label><Input value={f.quantity ?? ""} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div><Label>Repeats</Label><Input type="number" value={String(f.repeats_allowed)} onChange={(e) => setF({ ...f, repeats_allowed: Number(e.target.value) || 0 })} /></div>
          <div><Label>Validity (days)</Label><Input type="number" value={String(f.validity_days ?? "")} onChange={(e) => setF({ ...f, validity_days: e.target.value ? Number(e.target.value) : null })} /></div>
          <div className="sm:col-span-2"><Label>Directions</Label><Textarea rows={3} value={f.directions ?? ""} onChange={(e) => setF({ ...f, directions: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              await save({ data: {
                ...f,
                drug_form: f.drug_form || null,
                drug_strength: f.drug_strength || null,
                dose: f.dose || null,
                quantity: f.quantity || null,
                directions: f.directions || null,
                notes: f.notes || null,
              } });
              toast.success("Template saved");
              setOpen(false);
              onSaved();
            } catch (e) { toast.error((e as Error).message); }
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
