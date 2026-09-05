import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAddons, upsertAddon, deleteAddon, setAddonLinks,
  type AddonRow, type AddonLinkRow,
} from "@/lib/addons.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { getMyCategories } from "@/lib/categories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Sparkles, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/addons")({
  ssr: false,
  component: AddonsPage,
});

type Treatment = { id: string; name: string; price: number | null; category_id: string | null };
type Category = { id: string; name: string; parent_id: string | null };
type DiscountKind = "percent" | "amount";

function poundsFromCents(c?: number | null) {
  return ((c ?? 0) / 100).toFixed(2);
}

function netAddonPrice(addon: Pick<AddonRow, "price_cents" | "discount_percent" | "discount_amount">) {
  const base = (addon.price_cents ?? 0) / 100;
  if ((addon.discount_amount ?? 0) > 0) return Math.max(0, base - Number(addon.discount_amount));
  return base * (1 - Number(addon.discount_percent ?? 0) / 100);
}

function addonDiscountLabel(addon: Pick<AddonRow, "discount_percent" | "discount_amount">) {
  if ((addon.discount_amount ?? 0) > 0) return `£${Number(addon.discount_amount).toFixed(2)} off`;
  if ((addon.discount_percent ?? 0) > 0) return `${Number(addon.discount_percent)}% off`;
  return null;
}

function AddonsPage() {
  const list = useServerFn(listAddons);
  const upsert = useServerFn(upsertAddon);
  const remove = useServerFn(deleteAddon);
  const setLinks = useServerFn(setAddonLinks);
  const listTreatments = useServerFn(getMyTreatments);
  const listCategories = useServerFn(getMyCategories);

  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [links, setLinksState] = useState<AddonLinkRow[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<AddonRow> | null>(null);
  const [editKind, setEditKind] = useState<DiscountKind>("percent");
  const [linksOpen, setLinksOpen] = useState<AddonRow | null>(null);

  async function refresh() {
    const [r, t, c] = await Promise.all([list(), listTreatments(), listCategories()]);
    setAddons(r.addons); setLinksState(r.links);
    setTreatments((t ?? []) as any);
    setCategories((c ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  function linksFor(addonId: string) {
    return links.filter((l) => l.addon_id === addonId);
  }

  function openCreate() { setEditing({ name: "", price_cents: 0, duration_min: 0, discount_percent: null, discount_amount: null, active: true }); setEditKind("percent"); setEditOpen(true); }
  function openEdit(a: AddonRow) { setEditing(a); setEditKind((a.discount_amount ?? 0) > 0 ? "amount" : "percent"); setEditOpen(true); }

  async function saveAddon() {
    if (!editing?.name?.trim()) { toast.error("Name required"); return; }
    try {
      await upsert({ data: {
        id: editing.id,
        name: editing.name!,
        price_cents: editing.price_cents ?? 0,
        duration_min: editing.duration_min ?? 0,
        discount_percent: editing.discount_percent ?? null,
        discount_amount: editing.discount_amount ?? null,
        active: editing.active ?? true,
        sort_order: editing.sort_order ?? 0,
      }});
      toast.success("Saved");
      setEditOpen(false);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this add-on?")) return;
    await remove({ data: { id } });
    refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Add-ons</h1>
          <p className="text-xs text-muted-foreground">Extras offered with treatments — tick to assign, set a discount per link.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />New</Button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : addons.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No add-ons yet. Tap <strong>New</strong> to create one.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {addons.map((a) => {
            const my = linksFor(a.id);
            const tCount = my.filter((l) => l.treatment_id).length;
            const cCount = my.filter((l) => l.category_id).length;
            const discountLabel = addonDiscountLabel(a);
            const netPrice = netAddonPrice(a);
            return (
              <Card key={a.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{a.name}</span>
                        {!a.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {discountLabel ? (
                          <>
                            <span className="line-through opacity-60">£{poundsFromCents(a.price_cents)}</span>{" "}
                            <span className="font-semibold text-foreground">£{netPrice.toFixed(2)}</span>{" "}
                            <span>· {discountLabel}</span>
                          </>
                        ) : (
                          <>£{poundsFromCents(a.price_cents)}</>
                        )}{" "}
                        · {a.duration_min} min
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {cCount > 0 && <Badge variant="secondary" className="text-[10px]">{cCount} categor{cCount === 1 ? "y" : "ies"}</Badge>}
                        {tCount > 0 && <Badge variant="secondary" className="text-[10px]">{tCount} treatment{tCount === 1 ? "" : "s"}</Badge>}
                        {cCount + tCount === 0 && <span className="text-[11px] text-muted-foreground">Not assigned yet</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="outline" size="sm" onClick={() => setLinksOpen(a)}>
                        <Tag className="mr-1 h-3.5 w-3.5" />Assign
                      </Button>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit add-on" : "New add-on"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Numbing cream" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Price (£)</Label>
                  <Input type="text" inputMode="decimal" value={poundsFromCents(editing.price_cents)}
                    onChange={(e) => setEditing({ ...editing, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="text" inputMode="numeric" value={editing.duration_min ?? 0}
                    onChange={(e) => setEditing({ ...editing, duration_min: parseInt(e.target.value || "0") })} />
                </div>
              </div>
              {(() => {
                const standard = (editing.price_cents ?? 0) / 100;
                const preview = netAddonPrice({
                  price_cents: editing.price_cents ?? 0,
                  discount_percent: editing.discount_percent ?? null,
                  discount_amount: editing.discount_amount ?? null,
                });
                const hasDiscount = preview < standard;
                return (
                  <div className="rounded-md border p-3">
                    <Label className="text-xs">Discount shown to patients</Label>
                    <div className="mt-1 grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={editKind}
                        onChange={(e) => {
                          const next = e.target.value as DiscountKind;
                          setEditKind(next);
                          setEditing(next === "percent"
                            ? { ...editing, discount_amount: null }
                            : { ...editing, discount_percent: null });
                        }}
                      >
                        <option value="percent">% off</option>
                        <option value="amount">£ off</option>
                      </select>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={editKind === "percent" ? "No discount" : "No discount"}
                        value={editKind === "percent" ? (editing.discount_percent ?? "") : (editing.discount_amount ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw === "" ? null : Math.max(0, parseFloat(raw));
                          setEditing(editKind === "percent"
                            ? { ...editing, discount_percent: parsed == null ? null : Math.min(100, parsed), discount_amount: null }
                            : { ...editing, discount_percent: null, discount_amount: parsed });
                        }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {hasDiscount ? (
                        <>Patient sees <span className="line-through">£{standard.toFixed(2)}</span> <span className="font-semibold text-foreground">£{preview.toFixed(2)}</span>.</>
                      ) : (
                        <>Leave blank for no discount.</>
                      )}
                    </div>
                  </div>
                );
              })()}
              <label className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Active</span>
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveAddon}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment sheet */}
      <Sheet open={!!linksOpen} onOpenChange={(v) => !v && setLinksOpen(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl sm:max-w-2xl sm:rounded-2xl">
          {linksOpen && (
            <AssignPanel
              addon={linksOpen}
              currentLinks={linksFor(linksOpen.id)}
              treatments={treatments}
              categories={categories}
              onClose={() => setLinksOpen(null)}
              onSave={async (payload) => {
                try {
                  await setLinks({ data: { addon_id: linksOpen.id, ...payload } });
                  toast.success("Assignment saved");
                  setLinksOpen(null);
                  refresh();
                } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

type DiscountValue = { kind: DiscountKind; percent: number | null; amount: number | null };
const EMPTY_DISC: DiscountValue = { kind: "percent", percent: null, amount: null };

function AssignPanel({
  addon, currentLinks, treatments, categories, onClose, onSave,
}: {
  addon: AddonRow;
  currentLinks: AddonLinkRow[];
  treatments: Treatment[];
  categories: Category[];
  onClose: () => void;
  onSave: (payload: {
    treatments: { id: string; discount_percent?: number | null; discount_amount?: number | null }[];
    categories: { id: string; discount_percent?: number | null; discount_amount?: number | null }[];
  }) => void;
}) {
  const fromRow = (percent: number | null, amount: number | null): DiscountValue => ({
    kind: amount != null ? "amount" : "percent",
    percent: percent ?? null,
    amount: amount ?? null,
  });
  const initialCats = useMemo(() => {
    const m = new Map<string, DiscountValue>();
    currentLinks.filter((l) => l.category_id).forEach((l) =>
      m.set(l.category_id!, fromRow(l.discount_percent ?? null, l.discount_amount ?? null))
    );
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLinks]);
  const initialTreats = useMemo(() => {
    const m = new Map<string, DiscountValue>();
    currentLinks.filter((l) => l.treatment_id).forEach((l) =>
      m.set(l.treatment_id!, fromRow(l.discount_percent ?? null, l.discount_amount ?? null))
    );
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLinks]);

  const [cats, setCats] = useState<Map<string, DiscountValue>>(initialCats);
  const [treats, setTreats] = useState<Map<string, DiscountValue>>(initialTreats);
  const [bulkKind, setBulkKind] = useState<DiscountKind>("percent");
  const [bulkValue, setBulkValue] = useState<string>("");

  function toggleCat(id: string) {
    const n = new Map(cats);
    if (n.has(id)) n.delete(id); else n.set(id, { ...EMPTY_DISC });
    setCats(n);
  }
  function toggleTreat(id: string) {
    const n = new Map(treats);
    if (n.has(id)) n.delete(id); else n.set(id, { ...EMPTY_DISC });
    setTreats(n);
  }
  function setKindFor(
    map: Map<string, DiscountValue>,
    setMap: (m: Map<string, DiscountValue>) => void,
    id: string,
    kind: DiscountKind,
  ) {
    const n = new Map(map);
    const cur = n.get(id) ?? { ...EMPTY_DISC };
    n.set(id, { ...cur, kind });
    setMap(n);
  }
  function setValueFor(
    map: Map<string, DiscountValue>,
    setMap: (m: Map<string, DiscountValue>) => void,
    id: string,
    v: string,
  ) {
    const n = new Map(map);
    const cur = n.get(id) ?? { ...EMPTY_DISC };
    const parsed = v === "" ? null : Math.max(0, parseFloat(v));
    if (cur.kind === "percent") {
      n.set(id, { kind: "percent", percent: parsed == null ? null : Math.min(100, parsed), amount: null });
    } else {
      n.set(id, { kind: "amount", percent: null, amount: parsed });
    }
    setMap(n);
  }

  function applyBulk() {
    const parsed = bulkValue === "" ? null : Math.max(0, parseFloat(bulkValue));
    const v: DiscountValue = bulkKind === "percent"
      ? { kind: "percent", percent: parsed == null ? null : Math.min(100, parsed), amount: null }
      : { kind: "amount", percent: null, amount: parsed };
    const nc = new Map(cats); for (const k of nc.keys()) nc.set(k, { ...v }); setCats(nc);
    const nt = new Map(treats); for (const k of nt.keys()) nt.set(k, { ...v }); setTreats(nt);
  }

  function selectAllCats() {
    const n = new Map(cats); categories.forEach((c) => { if (!n.has(c.id)) n.set(c.id, { ...EMPTY_DISC }); }); setCats(n);
  }
  function clearCats() { setCats(new Map()); }
  function selectAllTreats() {
    const n = new Map(treats); treatments.forEach((t) => { if (!n.has(t.id)) n.set(t.id, { ...EMPTY_DISC }); }); setTreats(n);
  }
  function clearTreats() { setTreats(new Map()); }

  const treatsByCat = useMemo(() => {
    const m = new Map<string | null, Treatment[]>();
    treatments.forEach((t) => {
      const k = t.category_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    });
    return m;
  }, [treatments]);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorised";

  const renderEditor = (
    val: DiscountValue,
    onKind: (k: DiscountKind) => void,
    onValue: (v: string) => void,
  ) => {
    const shown = val.kind === "percent" ? (val.percent ?? "") : (val.amount ?? "");
    return (
      <div className="flex items-center gap-1">
        <select
          className="h-8 rounded border bg-background px-1 text-xs"
          value={val.kind}
          onChange={(e) => onKind(e.target.value as DiscountKind)}
        >
          <option value="percent">% off</option>
          <option value="amount">£ off</option>
        </select>
        <Input
          type="text"
          inputMode="decimal"
          placeholder={val.kind === "percent" ? "%" : "£"}
          value={shown}
          onChange={(e) => onValue(e.target.value)}
          className="h-8 w-20"
        />
      </div>
    );
  };


  const basePrice = (addon.price_cents ?? 0) / 100;

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>Assign “{addon.name}”</SheetTitle>
      </SheetHeader>

      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">
            Standard price <span className="font-semibold text-foreground">£{basePrice.toFixed(2)}</span>{" "}
            · patients see this crossed out when a discount is set.
          </div>
          <Label className="mt-2 block text-xs">Apply discount to all ticked</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={bulkKind}
              onChange={(e) => setBulkKind(e.target.value as "percent" | "amount")}
            >
              <option value="percent">% off</option>
              <option value="amount">£ off</option>
            </select>
            <Input
              type="text"
              inputMode="decimal"
              placeholder={bulkKind === "percent" ? "%" : "£"}
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="w-24"
            />
            <Button variant="outline" onClick={applyBulk}>Apply to ticked</Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Categories</h3>
          <div className="flex gap-1 text-xs">
            <button className="rounded border px-2 py-0.5" onClick={selectAllCats}>Select all</button>
            <button className="rounded border px-2 py-0.5" onClick={clearCats}>Clear</button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Ticking a category applies the add-on to every treatment inside it (including sub-categories).</p>
        <div className="divide-y rounded-md border">
          {categories.length === 0 && <div className="p-3 text-xs text-muted-foreground">No categories yet.</div>}
          {categories.map((c) => {
            const ticked = cats.has(c.id);
            const val = cats.get(c.id) ?? EMPTY_DISC;
            return (
              <label key={c.id} className="flex items-center gap-3 p-2">
                <input type="checkbox" className="h-4 w-4" checked={ticked} onChange={() => toggleCat(c.id)} />
                <span className="flex-1 text-sm">{c.parent_id ? "↳ " : ""}{c.name}</span>
                {ticked && renderEditor(
                  val,
                  (k) => setKindFor(cats, setCats, c.id, k),
                  (v) => setValueFor(cats, setCats, c.id, v),
                )}
              </label>
            );
          })}
        </div>
      </section>

      {/* Treatments */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Individual treatments</h3>
          <div className="flex gap-1 text-xs">
            <button className="rounded border px-2 py-0.5" onClick={selectAllTreats}>Select all</button>
            <button className="rounded border px-2 py-0.5" onClick={clearTreats}>Clear</button>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from(treatsByCat.entries()).map(([catId, items]) => (
            <div key={catId ?? "uncat"} className="rounded-md border">
              <div className="border-b bg-muted/50 px-3 py-1.5 text-xs font-semibold">{catName(catId)}</div>
              <div className="divide-y">
                {items.map((t) => {
                  const ticked = treats.has(t.id);
                  const val = treats.get(t.id) ?? EMPTY_DISC;
                  return (
                    <label key={t.id} className="flex items-center gap-3 p-2">
                      <input type="checkbox" className="h-4 w-4" checked={ticked} onChange={() => toggleTreat(t.id)} />
                      <span className="flex-1 text-sm">{t.name}</span>
                      {ticked && renderEditor(
                        val,
                        (k) => setKindFor(treats, setTreats, t.id, k),
                        (v) => setValueFor(treats, setTreats, t.id, v),
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background px-4 py-3 sm:mx-0 sm:rounded-b-2xl">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={() => onSave({
          treatments: Array.from(treats.entries()).map(([id, d]) => ({
            id, discount_percent: d.percent, discount_amount: d.amount,
          })),
          categories: Array.from(cats.entries()).map(([id, d]) => ({
            id, discount_percent: d.percent, discount_amount: d.amount,
          })),
        })}>Save assignments</Button>
      </div>
    </div>
  );
}
