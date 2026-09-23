import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listProducts, upsertProduct, deleteProduct, logPurchase, deletePurchase, setProductTreatmentLinks,
  type ProductRow, type PurchaseRow, type TreatmentProductLink, type StaffOption,
} from "@/lib/products.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Package, ShoppingCart, Link2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/products")({
  ssr: false,
  component: ProductsPage,
});

type Treatment = { id: string; name: string };

function gbp(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

function ProductsPage() {
  const list = useServerFn(listProducts);
  const upsert = useServerFn(upsertProduct);
  const remove = useServerFn(deleteProduct);
  const logBuy = useServerFn(logPurchase);
  const removePurchase = useServerFn(deletePurchase);
  const saveLinks = useServerFn(setProductTreatmentLinks);
  const listTreatments = useServerFn(getMyTreatments);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [links, setLinks] = useState<TreatmentProductLink[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProductRow> | null>(null);

  const [buyOpen, setBuyOpen] = useState<ProductRow | null>(null);
  const [buyQty, setBuyQty] = useState("1");
  const [buyCost, setBuyCost] = useState("");
  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [buySupplier, setBuySupplier] = useState("");
  const [buyNotes, setBuyNotes] = useState("");

  const [linksOpen, setLinksOpen] = useState<ProductRow | null>(null);
  const [linkCosts, setLinkCosts] = useState<Record<string, string>>({});

  async function refresh() {
    const [r, t] = await Promise.all([list(), listTreatments()]);
    setProducts(r.products);
    setPurchases(r.purchases);
    setLinks(r.links);
    setStaff(r.staff);
    setTreatments(((t ?? []) as any[]).map((x) => ({ id: x.id, name: x.name })));
    setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const totals = useMemo(() => {
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    let month = 0;
    let all = 0;
    for (const p of purchases) {
      all += p.total_cost_cents;
      if (p.purchased_at?.slice(0, 7) === monthKey) month += p.total_cost_cents;
    }
    const lowStock = products.filter((p) => p.active && p.low_stock_threshold != null && p.stock_units <= p.low_stock_threshold).length;
    return { month, all, lowStock };
  }, [purchases, products]);

  function openCreate() {
    setEditing({ name: "", supplier: "", unit_cost_cents: 0, pack_size: 1, stock_units: 0, low_stock_threshold: null, owner_kind: "clinic", owner_staff_id: null, notes: "", active: true });
    setEditOpen(true);
  }
  function openEdit(p: ProductRow) { setEditing(p); setEditOpen(true); }

  async function saveProduct() {
    if (!editing?.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await upsert({ data: {
        id: editing.id,
        name: editing.name!,
        supplier: editing.supplier ?? null,
        unit_cost_cents: editing.unit_cost_cents ?? 0,
        pack_size: editing.pack_size ?? 1,
        stock_units: editing.stock_units ?? 0,
        low_stock_threshold: editing.low_stock_threshold ?? null,
        owner_kind: editing.owner_kind ?? "clinic",
        owner_staff_id: editing.owner_staff_id ?? null,
        notes: editing.notes ?? null,
        active: editing.active ?? true,
      }});
      toast.success("Saved");
      setEditOpen(false);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product? Its purchase history and treatment links will go too.")) return;
    await remove({ data: { id } });
    refresh();
  }

  function openBuy(p: ProductRow) {
    setBuyOpen(p);
    setBuyQty("1");
    setBuyCost(((p.unit_cost_cents ?? 0) / 100).toFixed(2));
    setBuyDate(new Date().toISOString().slice(0, 10));
    setBuySupplier(p.supplier ?? "");
    setBuyNotes("");
  }

  async function savePurchase() {
    if (!buyOpen) return;
    const qty = Number(buyQty);
    const cost = Math.round(Number(buyCost) * 100);
    if (!qty || qty <= 0) { toast.error("Quantity required"); return; }
    if (Number.isNaN(cost) || cost < 0) { toast.error("Cost required"); return; }
    setSaving(true);
    try {
      await logBuy({ data: {
        product_id: buyOpen.id,
        purchased_at: buyDate,
        quantity: qty,
        total_cost_cents: cost,
        supplier: buySupplier || null,
        notes: buyNotes || null,
        add_to_stock: true,
      }});
      toast.success("Purchase logged — stock updated");
      setBuyOpen(null);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  function openLinks(p: ProductRow) {
    setLinksOpen(p);
    const existing: Record<string, string> = {};
    for (const l of links.filter((l) => l.product_id === p.id)) {
      existing[l.treatment_id] = l.units_per_treatment != null
        ? String(l.units_per_treatment)
        : (l.cost_per_treatment_cents / 100).toFixed(2);
    }
    setLinkCosts(existing);
  }

  async function saveTreatmentLinks() {
    if (!linksOpen) return;
    setSaving(true);
    try {
      const rows = Object.entries(linkCosts)
        .map(([treatment_id, v]) => ({ treatment_id, units_per_treatment: Number(v) }))
        .filter((r) => r.units_per_treatment > 0);
      await saveLinks({ data: { product_id: linksOpen.id, links: rows } });
      toast.success("Treatment links saved");
      setLinksOpen(null);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  function linksFor(productId: string) {
    return links.filter((l) => l.product_id === productId);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Products & stock</h1>
          <p className="text-xs text-muted-foreground">Track product costs, purchases and stock — and link products to treatments for commission.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />New product</Button>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Spent this month</p>
          <p className="text-lg font-bold">{gbp(totals.month)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total spent</p>
          <p className="text-lg font-bold">{gbp(totals.all)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Low stock</p>
          <p className="text-lg font-bold">{totals.lowStock}</p>
        </CardContent></Card>
      </div>

      {products.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No products yet. Add your first product to start tracking costs and stock.</p>
          <Button variant="outline" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Add a product</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const low = p.low_stock_threshold != null && p.stock_units <= p.low_stock_threshold;
            const pLinks = linksFor(p.id);
            return (
              <Card key={p.id} className={!p.active ? "opacity-60" : undefined}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{p.name}</p>
                      {!p.active && <Badge variant="outline">Inactive</Badge>}
                      {low && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Low stock</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.supplier ? `${p.supplier} · ` : ""}
                      {gbp(p.unit_cost_cents)} per {p.pack_size > 1 ? `pack of ${p.pack_size}` : "unit"}
                      {" · "}
                      {p.owner_kind === "practitioner" ? `Owned by ${p.owner_name ?? "practitioner"}` : "Clinic stock"}
                    </p>
                    <p className="text-xs">
                      Stock: <span className={low ? "font-semibold text-destructive" : "font-medium"}>{p.stock_units} units</span>
                      {p.low_stock_threshold != null && <span className="text-muted-foreground"> (warn at {p.low_stock_threshold})</span>}
                    </p>
                    {pLinks.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Linked to {pLinks.length} treatment{pLinks.length === 1 ? "" : "s"}:{" "}
                        {pLinks.map((l) => `${treatments.find((t) => t.id === l.treatment_id)?.name ?? "Treatment"} (${l.units_per_treatment != null ? `${l.units_per_treatment} units · ` : ""}${gbp(l.cost_per_treatment_cents)})`).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openBuy(p)}><ShoppingCart className="mr-1 h-3.5 w-3.5" />Log purchase</Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => openLinks(p)}><Link2 className="mr-1 h-3.5 w-3.5" />Link to treatments</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {purchases.length > 0 && (
        <section className="space-y-2 pt-4">
          <h2 className="text-sm font-semibold">Recent purchases</h2>
          <Card><CardContent className="divide-y p-0">
            {purchases.slice(0, 30).map((pu) => (
              <div key={pu.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{pu.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(pu.purchased_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}qty {pu.quantity}{pu.supplier ? ` · ${pu.supplier}` : ""}{pu.notes ? ` · ${pu.notes}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{gbp(pu.total_cost_cents)}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { if (confirm("Delete this purchase?")) { await removePurchase({ data: { id: pu.id } }); refresh(); } }} aria-label="Delete purchase"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </CardContent></Card>
        </section>
      )}

      {/* Product editor */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Botox 100u vial" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Supplier</Label>
                  <Input value={editing.supplier ?? ""} onChange={(e) => setEditing({ ...editing, supplier: e.target.value })} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label>Cost per pack (£)</Label>
                  <Input type="number" min="0" step="0.01" value={((editing.unit_cost_cents ?? 0) / 100).toString()} onChange={(e) => setEditing({ ...editing, unit_cost_cents: Math.round(Number(e.target.value) * 100) })} />
                </div>
                <div className="space-y-1">
                  <Label>Units per pack</Label>
                  <Input type="number" min="1" step="1" value={(editing.pack_size ?? 1).toString()} onChange={(e) => setEditing({ ...editing, pack_size: Number(e.target.value) || 1 })} />
                </div>
                <div className="space-y-1">
                  <Label>Stock on hand (units)</Label>
                  <Input type="number" min="0" step="1" value={(editing.stock_units ?? 0).toString()} onChange={(e) => setEditing({ ...editing, stock_units: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label>Low-stock warning at</Label>
                  <Input type="number" min="0" step="1" value={editing.low_stock_threshold?.toString() ?? ""} onChange={(e) => setEditing({ ...editing, low_stock_threshold: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Off" />
                </div>
                <div className="space-y-1">
                  <Label>Stock owned by</Label>
                  <div className="flex gap-2 pt-1.5">
                    <Button type="button" size="sm" variant={editing.owner_kind !== "practitioner" ? "default" : "outline"} onClick={() => setEditing({ ...editing, owner_kind: "clinic", owner_staff_id: null })}>Clinic</Button>
                    <Button type="button" size="sm" variant={editing.owner_kind === "practitioner" ? "default" : "outline"} onClick={() => setEditing({ ...editing, owner_kind: "practitioner" })}>Practitioner</Button>
                  </div>
                </div>
              </div>
              {editing.owner_kind === "practitioner" && (
                <div className="space-y-1">
                  <Label>Which practitioner?</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editing.owner_staff_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, owner_staff_id: e.target.value || null })}
                  >
                    <option value="">Choose…</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} placeholder="Optional" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={saveProduct} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log purchase */}
      <Dialog open={!!buyOpen} onOpenChange={(o) => !o && setBuyOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log a purchase — {buyOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Quantity (packs)</Label>
                <Input type="number" min="1" step="1" value={buyQty} onChange={(e) => setBuyQty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Total cost (£)</Label>
                <Input type="number" min="0" step="0.01" value={buyCost} onChange={(e) => setBuyCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Supplier</Label>
                <Input value={buySupplier} onChange={(e) => setBuySupplier(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={buyNotes} onChange={(e) => setBuyNotes(e.target.value)} placeholder="Optional" />
            </div>
            <p className="text-xs text-muted-foreground">Stock increases by quantity × units per pack ({buyOpen?.pack_size ?? 1}).</p>
          </div>
          <DialogFooter>
            <Button onClick={savePurchase} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Log purchase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Treatment links */}
      <Dialog open={!!linksOpen} onOpenChange={(o) => !o && setLinksOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Link {linksOpen?.name} to treatments</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Enter how many units of this product each treatment uses (e.g. 1 or 1.5). MODO works out the cost from the pack price
            {linksOpen ? ` (${gbp(linksOpen.unit_cost_cents)} ÷ ${linksOpen.pack_size} = ${gbp(Math.round(linksOpen.unit_cost_cents / Math.max(1, linksOpen.pack_size)))} per unit)` : ""}
            {" "}and takes it off before commission. Leave blank or 0 for treatments that don't use this product.
          </p>
          <div className="space-y-2">
            {treatments.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm">{t.name}</p>
                <div className="flex w-32 items-center gap-1">
                  <Input
                    type="number" min="0" step="0.5" className="h-8"
                    value={linkCosts[t.id] ?? ""}
                    placeholder="0"
                    onChange={(e) => setLinkCosts({ ...linkCosts, [t.id]: e.target.value })}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">units</span>
                </div>
              </div>
            ))}
            {treatments.length === 0 && <p className="text-sm text-muted-foreground">No treatments yet.</p>}
          </div>
          <DialogFooter>
            <Button onClick={saveTreatmentLinks} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save links</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
