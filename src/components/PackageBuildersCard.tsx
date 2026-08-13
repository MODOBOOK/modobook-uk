import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Wand2, Pencil } from "lucide-react";
import {
  listMyPackageBuilders, savePackageBuilder, deletePackageBuilder, type BuilderInput,
} from "@/lib/package-builder.functions";
import { describeBuilder, type BuilderMode } from "@/lib/package-builder-pricing";
import { getMyTreatments } from "@/lib/treatments.functions";
import { getMyCategories } from "@/lib/categories.functions";

type Treat = { id: string; name: string; price: number | null; active?: boolean | null };
type Cat = { id: string; name: string };

const MODES: { value: BuilderMode; label: string; hint: string }[] = [
  { value: "sum", label: "Straight total", hint: "Price is simply the sum of what they pick." },
  { value: "percent", label: "% off the bundle", hint: "e.g. 10% off any combination." },
  { value: "tier_count", label: "Tiered by number of items", hint: "e.g. 2 items 5% off, 3 items 10% off." },
  { value: "tier_spend", label: "Tiered by spend", hint: "e.g. £50 off when they spend £500." },
  { value: "fixed", label: "Fixed price bundle", hint: "e.g. pick any 3 for £399." },
];

const emptyBuilder = (): BuilderInput => ({
  name: "Build your own package",
  description: null,
  image_url: null,
  mode: "percent",
  discount_percent: 10,
  tiers: [],
  fixed_price: null,
  pick_count: null,
  min_items: 2,
  max_items: null,
  category_id: null,
  show_in_packages: true,
  active: true,
  items: [],
});

export function PackageBuildersCard() {
  const fetchBuilders = useServerFn(listMyPackageBuilders);
  const fetchTreats = useServerFn(getMyTreatments);
  const fetchCats = useServerFn(getMyCategories);
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(savePackageBuilder);
  const remove = useServerFn(deletePackageBuilder);

  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile({}) });
  const enabled = packageBuilderEnabled((profile.data as { slug?: string | null } | null)?.slug);

  const builders = useQuery({ queryKey: ["package-builders"], queryFn: () => fetchBuilders({}), enabled });
  const treats = useQuery({ queryKey: ["my-treatments-builder"], queryFn: () => fetchTreats({}), enabled });
  const cats = useQuery({ queryKey: ["my-categories-builder"], queryFn: () => fetchCats({}), enabled });

  const [editing, setEditing] = useState<BuilderInput | null>(null);

  const treatments = ((treats.data ?? []) as Treat[]).filter((t) => t.active !== false);
  const categories = (cats.data ?? []) as Cat[];

  async function handleDelete(id: string) {
    if (!confirm("Delete this build-your-own offer?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
      builders.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4" /> Build your own package
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Let clients build their own bundle from treatments you choose. Shows on your booking page.
          </p>
        </div>
        <Button size="sm" className="rounded-full" onClick={() => setEditing(emptyBuilder())}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {builders.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (builders.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No builders yet. Create one, e.g. "Pick any 3 for £399".
          </p>
        ) : (
          ((builders.data ?? []) as unknown as (BuilderInput & { id: string; items: { treatment_id: string; max_qty: number }[] })[]).map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{b.name}</span>
                  {!b.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Hidden</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {describeBuilder(b as never)} · {(b.items ?? []).length} treatments
                  {b.category_id ? ` · in ${categories.find((c) => c.id === b.category_id)?.name ?? "category"}` : ""}
                  {b.show_in_packages ? " · Packages tab" : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing({ ...b, items: b.items ?? [] })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {editing && (
        <BuilderDialog
          value={editing}
          treatments={treatments}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            try {
              await save({ data: v });
              toast.success("Saved");
              setEditing(null);
              builders.refetch();
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </Card>
  );
}

function BuilderDialog({
  value, treatments, categories, onClose, onSave,
}: {
  value: BuilderInput;
  treatments: Treat[];
  categories: Cat[];
  onClose: () => void;
  onSave: (v: BuilderInput) => void | Promise<void>;
}) {
  const [form, setForm] = useState<BuilderInput>(value);
  useEffect(() => setForm(value), [value]);
  const set = <K extends keyof BuilderInput>(k: K, v: BuilderInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const mode = form.mode as BuilderMode;

  const selected = useMemo(() => new Map(form.items.map((i) => [i.treatment_id, i])), [form.items]);
  const toggle = (id: string) =>
    setForm((f) => ({
      ...f,
      items: f.items.some((i) => i.treatment_id === id)
        ? f.items.filter((i) => i.treatment_id !== id)
        : [...f.items, { treatment_id: id, max_qty: 3 }],
    }));
  const setMaxQty = (id: string, qty: number) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.treatment_id === id ? { ...i, max_qty: Math.max(1, qty) } : i)),
    }));

  const tiers = form.tiers ?? [];
  const setTier = (idx: number, key: "min" | "value", v: number) =>
    setForm((f) => ({ ...f, tiers: (f.tiers ?? []).map((t, i) => (i === idx ? { ...t, [key]: v } : t)) }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.name || "Build your own package"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Autumn build your own" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              placeholder="Choose the treatments that suit you and save."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Image URL (optional)</Label>
            <Input value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value || null)} />
          </div>

          <div className="space-y-1.5">
            <Label>Pricing</Label>
            <Select value={form.mode} onValueChange={(v) => set("mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{MODES.find((m) => m.value === form.mode)?.hint}</p>
          </div>

          {mode === "percent" && (
            <div className="space-y-1.5">
              <Label>Discount %</Label>
              <Input type="number" min={0} max={100} value={form.discount_percent}
                onChange={(e) => set("discount_percent", Number(e.target.value))} />
            </div>
          )}

          {(mode === "tier_count" || mode === "tier_spend") && (
            <div className="space-y-2">
              <Label>{mode === "tier_count" ? "Tiers (items → % off)" : "Tiers (spend £ → £ off)"}</Label>
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="number" value={t.min} onChange={(e) => setTier(i, "min", Number(e.target.value))}
                    placeholder={mode === "tier_count" ? "items" : "spend £"} />
                  <span className="text-sm text-muted-foreground">→</span>
                  <Input type="number" value={t.value} onChange={(e) => setTier(i, "value", Number(e.target.value))}
                    placeholder={mode === "tier_count" ? "% off" : "£ off"} />
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive"
                    onClick={() => set("tiers", tiers.filter((_, x) => x !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => set("tiers", [...tiers, { min: 0, value: 0 }])}>
                <Plus className="mr-1 h-4 w-4" /> Add tier
              </Button>
            </div>
          )}

          {mode === "fixed" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pick how many</Label>
                <Input type="number" min={1} value={form.pick_count ?? 3}
                  onChange={(e) => set("pick_count", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Package price £</Label>
                <Input type="number" min={0} step="0.01" value={form.fixed_price ?? ""}
                  onChange={(e) => set("fixed_price", e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </div>
          )}

          {mode !== "fixed" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Minimum items</Label>
                <Input type="number" min={1} value={form.min_items}
                  onChange={(e) => set("min_items", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Maximum items (optional)</Label>
                <Input type="number" min={1} value={form.max_items ?? ""}
                  onChange={(e) => set("max_items", e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Show inside a category (main treatment list)</Label>
            <Select
              value={form.category_id ?? "__none__"}
              onValueChange={(v) => set("category_id", v === "__none__" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Not in the main list" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not in the main list</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Show in Packages tab</p>
              <p className="text-xs text-muted-foreground">Appears as a card alongside your packages.</p>
            </div>
            <Switch checked={form.show_in_packages} onCheckedChange={(v) => set("show_in_packages", v)} />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Live on booking page</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
          </div>

          <div className="space-y-2">
            <Label>Treatments clients can pick from</Label>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border p-2">
              {treatments.length === 0 && <p className="p-2 text-sm text-muted-foreground">No treatments yet.</p>}
              {treatments.map((t) => {
                const item = selected.get(t.id);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <input type="checkbox" checked={Boolean(item)} onChange={() => toggle(t.id)} />
                      <span className="truncate">{t.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">£{Number(t.price ?? 0).toFixed(2)}</span>
                    </label>
                    {item && (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs text-muted-foreground">max</span>
                        <Input
                          type="number" min={1} className="h-8 w-16"
                          value={item.max_qty}
                          onChange={(e) => setMaxQty(t.id, Number(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || form.items.length === 0 || (mode === "fixed" && !form.fixed_price)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
