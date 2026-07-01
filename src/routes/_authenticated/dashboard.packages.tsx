import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyPackages, createPackage, updatePackage, deletePackage } from "@/lib/packages.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, X, Search, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/packages")({
  ssr: false,
  component: PackagesPage,
});

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  treatment_id: string | null;
  treatment_ids: string[] | null;
  session_count: number;
  price: number;
  duration_minutes: number | null;
  expiry_days: number | null;
  image_url: string | null;
  active: boolean;
};
type Treatment = { id: string; name: string };

const blankForm = {
  name: "",
  description: "",
  treatment_ids: [] as string[],
  session_count: 1,
  price: 0,
  duration_minutes: "" as string,
  expiry_days: "" as string,
  image_url: "",
  active: true,
};

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
  const [form, setForm] = useState(blankForm);

  async function refresh() {
    const [p, t] = await Promise.all([list(), listTreatments()]);
    setPackages(p as Pkg[]);
    setTreatments((t as Treatment[]) ?? []);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...blankForm });
    setOpen(true);
  }
  function openEdit(p: Pkg) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      treatment_ids: p.treatment_ids ?? (p.treatment_id ? [p.treatment_id] : []),
      session_count: p.session_count,
      price: Number(p.price),
      duration_minutes: p.duration_minutes ? String(p.duration_minutes) : "",
      expiry_days: p.expiry_days ? String(p.expiry_days) : "",
      image_url: p.image_url ?? "",
      active: p.active,
    });
    setOpen(true);
  }

  function toggleTreatment(id: string) {
    setForm((f) => ({
      ...f,
      treatment_ids: f.treatment_ids.includes(id)
        ? f.treatment_ids.filter((x) => x !== id)
        : [...f.treatment_ids, id],
    }));
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      treatment_id: form.treatment_ids[0] ?? null,
      treatment_ids: form.treatment_ids,
      session_count: Number(form.session_count) || 1,
      price: Number(form.price) || 0,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      expiry_days: form.expiry_days ? Number(form.expiry_days) : null,
      image_url: form.image_url.trim() || null,
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
          <p className="text-sm text-muted-foreground">Bundle multiple treatments or sessions and sell them as one bookable package.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New package</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label>Package name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 3x Skin Booster Course" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What's included, what to expect, results timeline…"
                  rows={3}
                />
                <p className="mt-1 text-xs text-muted-foreground">Use this if your package doesn't map to an existing treatment.</p>
              </div>

              <div>
                <Label>Included treatments (optional)</Label>
                {treatments.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">You haven't added any treatments yet. The package will be sold using just the description above.</p>
                ) : (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-md border p-2">
                    {treatments.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                        <Checkbox
                          checked={form.treatment_ids.includes(t.id)}
                          onCheckedChange={() => toggleTreatment(t.id)}
                        />
                        <span className="text-sm">{t.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {form.treatment_ids.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.treatment_ids.length} treatment{form.treatment_ids.length === 1 ? "" : "s"} selected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Total sessions</Label>
                  <Input type="number" min={1} value={form.session_count} onChange={(e) => setForm({ ...form, session_count: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Price (£)</Label>
                  <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Per-session duration (min)</Label>
                  <Input type="number" min={0} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="e.g. 45" />
                </div>
                <div>
                  <Label>Expires after (days)</Label>
                  <Input type="number" min={1} value={form.expiry_days} onChange={(e) => setForm({ ...form, expiry_days: e.target.value })} placeholder="optional" />
                </div>
              </div>
              <div>
                <Label>Image URL (optional)</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active (visible to patients)</Label>
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
          No packages yet. Create one to offer multi-session bundles.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => {
            const ids = p.treatment_ids ?? (p.treatment_id ? [p.treatment_id] : []);
            const names = ids.map((id) => treatments.find((tt) => tt.id === id)?.name).filter(Boolean) as string[];
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {names.length > 0 ? names.join(" · ") : "Custom package"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  {p.description && <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                  <div className="flex justify-between">
                    <span>{p.session_count} session{p.session_count === 1 ? "" : "s"}</span>
                    <span className="font-semibold">£{Number(p.price).toFixed(2)}</span>
                  </div>
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
