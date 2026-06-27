import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyTreatments, createTreatment, updateTreatment, deleteTreatment } from "@/lib/treatments.functions";
import { getMyCategories } from "@/lib/categories.functions";
import {
  getTreatmentConsents,
  setTreatmentConsents,
  listMyConsentTemplates,
} from "@/lib/treatment-consents.functions";
import { getTreatmentAddons, setTreatmentAddons } from "@/lib/treatment-addons.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, FileText, X, Tag, PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/treatments")({
  ssr: false,
  component: TreatmentsPage,
});

type Treatment = {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string | null;
  active: boolean;
  category_id: string | null;
  addon_mode?: "off" | "optional" | null;
  discount_percent?: number | null;
  discount_starts_at?: string | null;
  discount_ends_at?: string | null;
  discount_show_was_now?: boolean | null;
  discount_label?: string | null;
};

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  icon: string | null;
};

type TreatmentForm = {
  name: string;
  duration: number;
  price: number;
  description: string;
  category_id: string | null;
  active: boolean;
  consent_ids: string[];
  addon_ids: string[];
  addon_mode: "off" | "optional";
  discount_percent: number | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  discount_show_was_now: boolean;
  discount_label: string | null;
};

type ConsentTpl = { id: string; name: string; treatment_type: string | null; is_system: boolean };


function buildCategoryPaths(cats: Category[]) {
  const byId = new Map(cats.map((c) => [c.id, c]));
  function path(c: Category): string {
    const parts: string[] = [];
    let cur: Category | undefined = c;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return parts.join(" › ");
  }
  return cats
    .map((c) => ({ id: c.id, label: path(c), depth: path(c).split(" › ").length - 1 }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function TreatmentsPage() {
  const list = useServerFn(getMyTreatments);
  const listCats = useServerFn(getMyCategories);
  const create = useServerFn(createTreatment);
  const update = useServerFn(updateTreatment);
  const remove = useServerFn(deleteTreatment);
  const listConsents = useServerFn(listMyConsentTemplates);
  const setConsents = useServerFn(setTreatmentConsents);
  const [items, setItems] = useState<Treatment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [consentTemplates, setConsentTemplates] = useState<ConsentTpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);

  const categoryOptions = useMemo(() => buildCategoryPaths(categories), [categories]);
  const categoryById = useMemo(() => {
    const m = new Map<string, { label: string }>();
    for (const o of categoryOptions) m.set(o.id, { label: o.label });
    return m;
  }, [categoryOptions]);

  async function load() {
    setLoading(true);
    try {
      const [data, cats, tpls] = await Promise.all([list({}), listCats({}), listConsents({})]);
      setItems(data as Treatment[]);
      setCategories(cats as Category[]);
      setConsentTemplates(tpls as ConsentTpl[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load treatments");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleSave(form: TreatmentForm) {
    try {
      const { consent_ids, ...rest } = form;
      let id: string;
      if (editing) {
        await update({ data: { id: editing.id, ...rest } });
        id = editing.id;
        toast.success("Treatment updated");
      } else {
        const created = await create({ data: rest });
        id = (created as { id: string }).id;
        toast.success("Treatment created");
      }
      await setConsents({ data: { treatmentId: id, consentTemplateIds: consent_ids } });
      setOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this treatment?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  // Group treatments by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, Treatment[]>();
    for (const t of items) {
      const key = t.category_id ?? "__none__";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return (categoryById.get(a)?.label ?? "").localeCompare(categoryById.get(b)?.label ?? "");
    });
  }, [items, categoryById]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Treatments</h1>
          <p className="text-muted-foreground">Define what patients can book. Assign to categories or sub-categories.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" /> New treatment
            </Button>
          </DialogTrigger>
          <TreatmentDialog
            treatment={editing}
            categories={categories}
            consentTemplates={consentTemplates}
            onSave={handleSave}
          />

        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No treatments yet. Add your first one.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([catId, treatments]) => (
            <div key={catId} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {catId === "__none__" ? "Uncategorised" : categoryById.get(catId)?.label ?? "Unknown"}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {treatments.map((t) => (
                  <Card key={t.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                      <div>
                        <CardTitle className="text-base">{t.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">£{t.price} · {t.duration} min</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    {t.description && (
                      <CardContent className="text-sm text-muted-foreground">{t.description}</CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TreatmentDialog({
  treatment,
  categories,
  consentTemplates,
  onSave,
}: {
  treatment: Treatment | null;
  categories: Category[];
  consentTemplates: ConsentTpl[];
  onSave: (f: TreatmentForm) => void;
}) {
  const fetchConsents = useServerFn(getTreatmentConsents);
  const [name, setName] = useState(treatment?.name ?? "");
  const [duration, setDuration] = useState(treatment?.duration ?? 30);
  const [price, setPrice] = useState(treatment?.price ?? 0);
  const [description, setDescription] = useState(treatment?.description ?? "");
  const [active, setActive] = useState(treatment?.active ?? true);
  const [consentIds, setConsentIds] = useState<string[]>([]);

  // Two-step category picker: parent category + optional subcategory
  const topLevel = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childrenOf = (parentId: string | null) =>
    parentId ? categories.filter((c) => c.parent_id === parentId) : [];

  // Resolve initial category/subcategory from treatment.category_id (which may be a sub or parent)
  const initial = useMemo(() => {
    const id = treatment?.category_id ?? null;
    if (!id) return { parent: null as string | null, sub: null as string | null };
    const cat = categories.find((c) => c.id === id);
    if (!cat) return { parent: null, sub: null };
    if (cat.parent_id) return { parent: cat.parent_id, sub: cat.id };
    return { parent: cat.id, sub: null };
  }, [treatment, categories]);

  const [parentId, setParentId] = useState<string | null>(initial.parent);
  const [subId, setSubId] = useState<string | null>(initial.sub);

  useEffect(() => {
    setName(treatment?.name ?? "");
    setDuration(treatment?.duration ?? 30);
    setPrice(treatment?.price ?? 0);
    setDescription(treatment?.description ?? "");
    setActive(treatment?.active ?? true);
    setParentId(initial.parent);
    setSubId(initial.sub);
    if (treatment?.id) {
      fetchConsents({ data: { treatmentId: treatment.id } })
        .then((ids) => setConsentIds(ids as string[]))
        .catch(() => setConsentIds([]));
    } else {
      setConsentIds([]);
    }
  }, [treatment, fetchConsents, initial.parent, initial.sub]);

  function toggleConsent(id: string) {
    setConsentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const subOptions = childrenOf(parentId);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{treatment ? "Edit treatment" : "New treatment"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1">
            <Label>Service Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 1 Area" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <span className="text-muted-foreground">Hide</span>
            <Switch checked={!active} onCheckedChange={(v) => setActive(!v)} />
          </label>
        </div>

        <div>
          <Label>Assign to category</Label>
          {parentId ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{categories.find((c) => c.id === parentId)?.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => { setParentId(null); setSubId(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Select onValueChange={(v) => { setParentId(v); setSubId(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {topLevel.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No categories yet — create one in Categories.
                  </div>
                ) : (
                  topLevel.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {parentId && (
          <div>
            <Label>Assign to a sub category</Label>
            {subId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{categories.find((c) => c.id === subId)?.name}</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => setSubId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : subOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No sub-categories under this category. Add one in Categories.
              </p>
            ) : (
              <Select onValueChange={(v) => setSubId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sub category" />
                </SelectTrigger>
                <SelectContent>
                  {subOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Duration (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div>
            <Label>Price (£)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="m-0">Consent forms to send on booking</Label>
          </div>
          {consentTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No consent forms yet. Add them in Dashboard → Consent forms.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {consentTemplates.map((t) => (
                <label key={t.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={consentIds.includes(t.id)}
                    onCheckedChange={() => toggleConsent(t.id)}
                  />
                  <span>
                    {t.name}
                    {t.is_system && (
                      <span className="ml-2 text-xs text-muted-foreground">(template)</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Patients receive a link to complete each selected form after they book.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSave({
              name,
              duration,
              price,
              description,
              category_id: subId ?? parentId,
              active,
              consent_ids: consentIds,
            })
          }
          disabled={!name}
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}


