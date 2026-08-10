import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyPackages, createPackage, updatePackage, deletePackage, reorderPackages } from "@/lib/packages.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { getMyPackageCategories, createPackageCategory, deletePackageCategory } from "@/lib/categories.functions";
import { getMyProfile } from "@/lib/profiles.functions";
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
import { ImageUploader } from "@/components/ImageUploader";
import { toast } from "sonner";
import { Plus, Minus, Pencil, Trash2, Package, X, Search, Check, ArrowUp, ArrowDown } from "lucide-react";

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
  compare_at_price?: number | null;
  duration_minutes: number | null;
  expiry_days: number | null;
  image_url: string | null;
  active: boolean;
  category_id: string | null;
  allow_split_payment?: boolean | null;
  is_limited?: boolean | null;
  limited_starts_at?: string | null;
  limited_ends_at?: string | null;
  limited_quantity?: number | null;
  limited_claimed?: number | null;
};
type Treatment = { id: string; name: string; price: number | null };
type Category = { id: string; name: string; parent_id: string | null };

type PriceMode = "custom" | "percent";

/** ISO string -> value for <input type="datetime-local"> in local time */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string) {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const blankForm = {
  name: "",
  description: "",
  treatment_ids: [] as string[],
  session_count: 1,
  price: 0,
  compare_at_price: "" as string,
  priceMode: "custom" as PriceMode,
  discountPercent: 0,
  duration_minutes: "" as string,
  expiry_days: "" as string,
  image_url: "",
  active: true,
  category_id: "" as string,
  allow_split_payment: false,
  is_limited: false,
  limited_starts_at: "" as string,
  limited_ends_at: "" as string,
  limited_quantity: "" as string,
};


function PackagesPage() {
  const list = useServerFn(listMyPackages);
  const create = useServerFn(createPackage);
  const update = useServerFn(updatePackage);
  const remove = useServerFn(deletePackage);
  const reorder = useServerFn(reorderPackages);
  const listTreatments = useServerFn(getMyTreatments);
  const listCategories = useServerFn(getMyPackageCategories);
  const createCat = useServerFn(createPackageCategory);
  const deleteCat = useServerFn(deletePackageCategory);
  const fetchProfile = useServerFn(getMyProfile);

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [form, setForm] = useState(blankForm);

  async function refresh() {
    const [p, t, c, profile] = await Promise.all([list(), listTreatments(), listCategories(), fetchProfile()]);
    setPackages(p as Pkg[]);
    setTreatments((t as Treatment[]) ?? []);
    setCategories((c as Category[]) ?? []);
    setProfileId((profile as { id?: string } | null)?.id ?? "");
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= packages.length) return;
    const next = [...packages];
    [next[index], next[target]] = [next[target], next[index]];
    setPackages(next);
    try {
      await reorder({ data: { ids: next.map((p) => p.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder");
      refresh();
    }
  }

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
      compare_at_price: p.compare_at_price == null ? "" : String(Number(p.compare_at_price)),
      priceMode: "custom",
      discountPercent: 0,
      duration_minutes: p.duration_minutes ? String(p.duration_minutes) : "",
      expiry_days: p.expiry_days ? String(p.expiry_days) : "",
      image_url: p.image_url ?? "",
      active: p.active,
      category_id: p.category_id ?? "",
      allow_split_payment: Boolean(p.allow_split_payment),
    });
    setOpen(true);
  }

  // treatment_ids may repeat — a repeat means "N sessions of that treatment"
  const selectedGrouped = useMemo(() => {
    const out: { id: string; qty: number }[] = [];
    for (const id of form.treatment_ids) {
      const found = out.find((x) => x.id === id);
      if (found) found.qty += 1;
      else out.push({ id, qty: 1 });
    }
    return out;
  }, [form.treatment_ids]);

  // Sessions are always set manually by the practitioner — never derived
  // from the selected treatments.
  const totalSessions = Math.max(1, Number(form.session_count) || 1);
  const suggestedSessions = form.treatment_ids.length;

  const originalTotal = useMemo(() => {
    if (form.treatment_ids.length === 0) return 0;
    return form.treatment_ids.reduce((sum, id) => {
      const t = treatments.find((x) => x.id === id);
      return sum + Number(t?.price ?? 0);
    }, 0);
  }, [form.treatment_ids, treatments]);

  const effectivePrice = useMemo(() => {
    if (form.priceMode === "percent") {
      const pct = Math.max(0, Math.min(100, Number(form.discountPercent) || 0));
      return Number((originalTotal * (1 - pct / 100)).toFixed(2));
    }
    return Number(form.price) || 0;
  }, [form.priceMode, form.discountPercent, form.price, originalTotal]);

  // The "usual price" the savings badge compares against. Blank = auto
  // (sum of the treatments in the package), 0 = hide savings entirely.
  const compareAt = form.compare_at_price.trim() === ""
    ? originalTotal
    : Math.max(0, Number(form.compare_at_price) || 0);
  const savings = Math.max(0, compareAt - effectivePrice);
  const savingsPct = compareAt > 0 ? Math.round((savings / compareAt) * 100) : 0;

  function toggleTreatment(id: string) {
    setForm((f) => ({
      ...f,
      treatment_ids: f.treatment_ids.includes(id)
        ? f.treatment_ids.filter((x) => x !== id)
        : [...f.treatment_ids, id],
    }));
  }

  function setQty(id: string, qty: number) {
    const n = Math.max(0, Math.min(50, Math.round(qty) || 0));
    setForm((f) => {
      const others = f.treatment_ids.filter((x) => x !== id);
      if (n === 0) return { ...f, treatment_ids: others };
      // keep original ordering by rebuilding from the grouped order
      const order: string[] = [];
      for (const x of f.treatment_ids) if (!order.includes(x)) order.push(x);
      if (!order.includes(id)) order.push(id);
      const counts = new Map<string, number>();
      for (const x of f.treatment_ids) counts.set(x, (counts.get(x) ?? 0) + 1);
      counts.set(id, n);
      const next: string[] = [];
      for (const oid of order) {
        for (let i = 0; i < (counts.get(oid) ?? 0); i++) next.push(oid);
      }
      return { ...f, treatment_ids: next };
    });
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      treatment_id: form.treatment_ids[0] ?? null,
      treatment_ids: form.treatment_ids,
      session_count: totalSessions,
      price: effectivePrice,
      compare_at_price: form.compare_at_price.trim() === "" ? null : Math.max(0, Number(form.compare_at_price) || 0),
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      expiry_days: form.expiry_days ? Number(form.expiry_days) : null,
      image_url: form.image_url.trim() || null,
      active: form.active,
      category_id: form.category_id || null,
      allow_split_payment: form.allow_split_payment && totalSessions > 1,
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
                <Label>Package category (optional)</Label>
                <div className="mt-1 flex gap-2">
                  <select
                    className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  >
                    <option value="">— No category —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt("New package category name");
                      if (!name?.trim()) return;
                      try {
                        const row = await createCat({ data: { name: name.trim() } });
                        setCategories((prev) => [...prev, row as Category]);
                        setForm((f) => ({ ...f, category_id: (row as Category).id }));
                        toast.success("Category added");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Package categories are separate from treatment categories. Patients see packages grouped by these on the booking page.
                </p>
              </div>


              <div>
                <Label>Included treatments</Label>
                {treatments.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">You haven't added any treatments yet. The package will be sold using just the description above.</p>
                ) : (
                  <>
                    <TreatmentSearchPicker
                      treatments={treatments}
                      selectedIds={form.treatment_ids}
                      onToggle={toggleTreatment}
                    />
                    {selectedGrouped.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {selectedGrouped.map(({ id, qty }) => {
                          const t = treatments.find((x) => x.id === id);
                          if (!t) return null;
                          const line = Number(t.price ?? 0) * qty;
                          return (
                            <div key={id} className="flex items-center gap-2 rounded-md border bg-background p-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{t.name}</div>
                                {t.price != null && (
                                  <div className="text-xs text-muted-foreground">
                                    £{Number(t.price).toFixed(2)} each · £{line.toFixed(2)}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(id, qty - 1)} aria-label={`Fewer sessions of ${t.name}`}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={qty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => setQty(id, Number(e.target.value))}
                                  className="h-7 w-14 text-center"
                                />
                                <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(id, qty + 1)} aria-label={`More sessions of ${t.name}`}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleTreatment(id)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted"
                                aria-label={`Remove ${t.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                        <p className="text-xs text-muted-foreground">
                          Set how many sessions of each treatment this package includes.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <Label>Total sessions</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.session_count}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm({ ...form, session_count: Number(e.target.value) })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  You decide how many sessions this package includes.
                  {suggestedSessions > 0 && suggestedSessions !== totalSessions && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setForm({ ...form, session_count: suggestedSessions })}
                      >
                        Use {suggestedSessions} from the treatments above
                      </button>
                    </>
                  )}
                </p>
              </div>


              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm font-semibold">Package pricing</Label>
                  {originalTotal > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Sessions total = <span className="font-medium">£{originalTotal.toFixed(2)}</span>
                    </span>
                  )}
                </div>

                <div className="mb-3 inline-flex rounded-md border bg-background p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, priceMode: "percent" })}
                    className={`rounded px-3 py-1.5 transition ${form.priceMode === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Apply % discount
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, priceMode: "custom" })}
                    className={`rounded px-3 py-1.5 transition ${form.priceMode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Set custom price
                  </button>
                </div>
                {form.priceMode === "percent" ? (
                  <div>
                    <Label>Discount (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={form.discountPercent}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                      placeholder="e.g. 15"
                    />
                  </div>
                ) : (
                  <div>
                    <Label>Package price (£)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className="mt-3">
                  <Label>Usual price shown to patients (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.compare_at_price}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })}
                    placeholder={originalTotal > 0 ? `Auto — £${originalTotal.toFixed(2)}` : "Leave blank for auto"}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave blank to work it out automatically from the treatments included.
                    Enter your own figure when the package already contains bundled prices,
                    or enter <span className="font-medium">0</span> to hide the savings badge.
                  </p>
                </div>

                {compareAt > 0 && (
                  <div className="mt-3 flex items-baseline justify-between rounded-md bg-background p-2.5">
                    <div className="text-xs text-muted-foreground">
                      {savings > 0 ? (
                        <>
                          Was <span className="line-through">£{compareAt.toFixed(2)}</span> — save{" "}
                          <span className="font-medium text-emerald-600">£{savings.toFixed(2)} ({savingsPct}%)</span>
                        </>
                      ) : effectivePrice > compareAt ? (
                        <span className="text-amber-600">Priced above the usual price</span>
                      ) : (
                        "No discount applied"
                      )}
                    </div>
                    <div className="text-lg font-semibold">£{effectivePrice.toFixed(2)}</div>
                  </div>
                )}
              </div>

              {totalSessions > 1 && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>Allow split payment</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Patient pays per session instead of all up front —{" "}
                        <span className="font-medium">
                          £{(effectivePrice / totalSessions).toFixed(2)}
                        </span>{" "}
                        × {totalSessions} sessions.
                      </p>
                    </div>
                    <Switch
                      checked={form.allow_split_payment}
                      onCheckedChange={(v) => setForm({ ...form, allow_split_payment: v })}
                    />
                  </div>
                </div>
              )}

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
              {profileId && (
                <ImageUploader
                  label="Package image (optional)"
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url ?? "" })}
                  profileId={profileId}
                  folder="packages"
                  previewClass="mt-2 h-32 w-full object-cover rounded-md"
                />
              )}
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

      <PackageCategoriesManager
        categories={categories}
        onAdd={async (name) => {
          const row = await createCat({ data: { name } });
          setCategories((prev) => [...prev, row as Category]);
        }}
        onDelete={async (id) => {
          if (!confirm("Delete this package category? Packages in it will become uncategorised.")) return;
          await deleteCat({ data: { id } });
          setCategories((prev) => prev.filter((c) => c.id !== id));
        }}
      />



      {packages.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No packages yet. Create one to offer multi-session bundles.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p, index) => {
            const ids = p.treatment_ids ?? (p.treatment_id ? [p.treatment_id] : []);
            const names = ids.map((id) => treatments.find((tt) => tt.id === id)?.name).filter(Boolean) as string[];
            // Each selected treatment (including repeats) is counted once —
            // never multiplied by session_count, which would triple a package
            // whose treatments already represent the full course.
            const autoOriginal = ids.reduce((sum, id) => sum + Number(treatments.find((tt) => tt.id === id)?.price ?? 0), 0);
            const original = p.compare_at_price == null ? autoOriginal : Number(p.compare_at_price);
            const price = Number(p.price);
            const saving = original > price ? original - price : 0;
            const savingPct = original > 0 && saving > 0 ? Math.round((saving / original) * 100) : 0;
            return (
              <Card key={p.id} className="overflow-hidden">
                {p.image_url && (
                  <div className="aspect-[16/7] w-full overflow-hidden bg-muted">
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                )}
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {names.length > 0 ? names.join(" · ") : "Custom package"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Move down" disabled={index === packages.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  {p.description && <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                  <div className="flex items-baseline justify-between gap-2">
                    <span>{p.session_count} session{p.session_count === 1 ? "" : "s"}</span>
                    <div className="text-right">
                      {saving > 0 && (
                        <div className="text-xs text-muted-foreground line-through">£{original.toFixed(2)}</div>
                      )}
                      <div className="font-semibold">£{price.toFixed(2)}</div>
                    </div>
                  </div>
                  {saving > 0 && (
                    <p className="mt-1 text-right text-xs font-medium text-emerald-600">
                      Save £{saving.toFixed(2)} ({savingPct}%)
                    </p>
                  )}
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

function TreatmentSearchPicker({
  treatments,
  selectedIds,
  onToggle,
}: {
  treatments: Treatment[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="mt-2 w-full justify-start font-normal text-muted-foreground">
          <Search className="mr-2 h-4 w-4" />
          Search treatments to add…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" />
          <CommandList>
            <CommandEmpty>No treatments found.</CommandEmpty>
            <CommandGroup>
              {treatments.map((t) => {
                const checked = selectedIds.includes(t.id);
                return (
                  <CommandItem key={t.id} value={t.name} onSelect={() => onToggle(t.id)}>
                    <Check className={`mr-2 h-4 w-4 ${checked ? "opacity-100" : "opacity-0"}`} />
                    <span className="flex-1">{t.name}</span>
                    {t.price != null && (
                      <span className="ml-2 text-xs text-muted-foreground">£{Number(t.price).toFixed(2)}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PackageCategoriesManager({
  categories,
  onAdd,
  onDelete,
}: {
  categories: Category[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Package categories</CardTitle>
        <p className="text-xs text-muted-foreground">
          Group packages on the booking page. Kept separate from your treatment categories.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">No package categories yet.</p>
          ) : (
            categories.map((c) => (
              <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                <span>{c.name}</span>
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => onDelete(c.id)}
                  className="rounded p-0.5 hover:bg-background/60"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Skin, Anti-wrinkle, Wellness…"
            className="h-9"
          />
          <Button
            size="sm"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try { await onAdd(name.trim()); setName(""); toast.success("Added"); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
              finally { setBusy(false); }
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
