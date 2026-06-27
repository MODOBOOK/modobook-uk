import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyPackages, createPackage, updatePackage, deletePackage } from "@/lib/packages.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/packages")({
  ssr: false,
  component: PackagesPage,
});

type Pkg = {
  id: string;
  name: string;
  treatment_id: string | null;
  session_count: number;
  price: number;
  expiry_days: number | null;
  active: boolean;
};
type Treatment = { id: string; name: string };

function PackagesPage() {
  const list = useServerFn(listMyPackages);
  const create = useServerFn(createPackage);
  const update = useServerFn(updatePackage);
  const remove = useServerFn(deletePackage);
  const listTreatments = useServerFn(getMyTreatments);

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [form, setForm] = useState({
    name: "",
    treatment_id: "" as string,
    session_count: 1,
    price: 0,
    expiry_days: "" as string,
    active: true,
  });

  async function refresh() {
    const [p, t] = await Promise.all([list(), listTreatments()]);
    setPackages(p as Pkg[]);
    setTreatments((t as Treatment[]) ?? []);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", treatment_id: "", session_count: 1, price: 0, expiry_days: "", active: true });
    setOpen(true);
  }
  function openEdit(p: Pkg) {
    setEditing(p);
    setForm({
      name: p.name,
      treatment_id: p.treatment_id ?? "",
      session_count: p.session_count,
      price: Number(p.price),
      expiry_days: p.expiry_days ? String(p.expiry_days) : "",
      active: p.active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const payload = {
      name: form.name.trim(),
      treatment_id: form.treatment_id || null,
      session_count: Number(form.session_count) || 1,
      price: Number(form.price) || 0,
      expiry_days: form.expiry_days ? Number(form.expiry_days) : null,
      active: form.active,
    };
    try {
      if (editing) await update({ data: { id: editing.id, ...payload } });
      else await create({ data: payload });
      toast.success("Saved");
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this package?")) return;
    try { await remove({ data: { id } }); toast.success("Deleted"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Packages</h1>
          <p className="text-sm text-muted-foreground">Create treatment packages (e.g. 3 sessions for £X) shown to patients alongside single treatments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New package</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 3x Skin Booster Course" />
              </div>
              <div>
                <Label>Treatment (optional)</Label>
                <Select value={form.treatment_id || "none"} onValueChange={(v) => setForm({ ...form, treatment_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select treatment" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {treatments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sessions</Label>
                  <Input type="number" min={1} value={form.session_count} onChange={(e) => setForm({ ...form, session_count: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Price (£)</Label>
                  <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Expires after (days, optional)</Label>
                <Input type="number" min={1} value={form.expiry_days} onChange={(e) => setForm({ ...form, expiry_days: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {packages.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No packages yet. Create one to offer multi-session deals.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => {
            const t = treatments.find((tt) => tt.id === p.treatment_id);
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t?.name ?? "Multi/Any treatment"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="flex justify-between"><span>{p.session_count} session{p.session_count === 1 ? "" : "s"}</span><span className="font-semibold">£{Number(p.price).toFixed(2)}</span></div>
                  {p.expiry_days && <p className="mt-1 text-xs text-muted-foreground">Expires after {p.expiry_days} days</p>}
                  {!p.active && <p className="mt-1 text-xs text-amber-600">Hidden from patients</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
