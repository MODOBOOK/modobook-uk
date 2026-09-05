import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listDiscountCodes, upsertDiscountCode, deleteDiscountCode, setTreatmentDiscount,
} from "@/lib/discounts.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { getMyCategories } from "@/lib/categories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag, Percent, ArrowLeft, ChevronDown, Check, Search } from "lucide-react";

type Category = { id: string; name: string };

function TreatmentPicker({
  treatments, categories, value, onChange, placeholder = "All treatments",
}: {
  treatments: Treat[];
  categories: Category[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const byCat = new Map<string | null, Treat[]>();
    for (const t of treatments) {
      const key = (t as any).category_id ?? null;
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(t);
    }
    const ordered: { cat: Category | null; items: Treat[] }[] = [];
    for (const c of categories) {
      if (byCat.has(c.id)) ordered.push({ cat: c, items: byCat.get(c.id)! });
    }
    if (byCat.has(null)) ordered.push({ cat: null, items: byCat.get(null)! });
    return ordered;
  }, [treatments, categories]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return grouped;
    return grouped
      .map((g) => ({ ...g, items: g.items.filter((t) => t.name.toLowerCase().includes(s)) }))
      .filter((g) => g.items.length > 0);
  }, [grouped, q]);

  const selected = new Set(value);
  const total = treatments.length;
  const label =
    value.length === 0 ? placeholder :
    value.length === total ? `All ${total} treatments` :
    `${value.length} selected`;

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  }
  function toggleGroup(ids: string[], allOn: boolean) {
    if (allOn) onChange(value.filter((x) => !ids.includes(x)));
    else onChange(Array.from(new Set([...value, ...ids])));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[min(92vw,32rem)] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-2">
          <Search className="h-4 w-4 opacity-50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search treatments…"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs">
          <button type="button" className="font-medium underline"
            onClick={() => onChange(treatments.map((t) => t.id))}>Select all</button>
          <button type="button" className="font-medium underline"
            onClick={() => onChange([])}>Clear</button>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground">No matches</p>
          )}
          {filtered.map((g) => {
            const ids = g.items.map((t) => t.id);
            const allOn = ids.every((id) => selected.has(id));
            const someOn = ids.some((id) => selected.has(id));
            return (
              <div key={g.cat?.id ?? "uncat"} className="mb-1">
                <button type="button"
                  onClick={() => toggleGroup(ids, allOn)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted">
                  <span>{g.cat?.name ?? "Uncategorised"}</span>
                  <span className="text-[10px] normal-case">
                    {allOn ? "Unselect all" : someOn ? "Select all" : "Select all"}
                  </span>
                </button>
                {g.items.map((t) => {
                  const on = selected.has(t.id);
                  return (
                    <button key={t.id} type="button"
                      onClick={() => toggle(t.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${on ? "bg-muted/60" : ""}`}>
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className="text-xs text-muted-foreground">£{Number(t.price).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/discounts")({
  ssr: false,
  component: DiscountsPage,
});

type Code = {
  id: string; code: string; label: string | null; kind: "percent" | "fixed";
  amount: number; treatment_ids: string[];
  starts_at: string | null; ends_at: string | null;
  days_of_week: number[] | null; max_uses: number | null;
  uses_count: number; active: boolean;
};
type Treat = {
  id: string; name: string; price: number;
  category_id: string | null;
  discount_percent: number | null;
  discount_starts_at: string | null; discount_ends_at: string | null;
  discount_days_of_week: number[] | null;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DiscountsPage() {
  const listCodes = useServerFn(listDiscountCodes);
  const listTreats = useServerFn(getMyTreatments);
  const listCategories = useServerFn(getMyCategories);
  const [codes, setCodes] = useState<Code[]>([]);
  const [treats, setTreats] = useState<Treat[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [c, t, cats] = await Promise.all([listCodes(), listTreats(), listCategories()]);
      setCodes((c as any) ?? []);
      setTreats((t as any) ?? []);
      setCategories(((cats as any) ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Discounts</h1>
        <p className="text-sm text-muted-foreground">Apply discounts directly to the menu, or create checkout codes patients enter at booking.</p>
      </header>

      <Tabs defaultValue="menu">
        <TabsList>
          <TabsTrigger value="menu"><Percent className="mr-1.5 h-4 w-4" />Menu discounts</TabsTrigger>
          <TabsTrigger value="codes"><Tag className="mr-1.5 h-4 w-4" />Discount codes</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-4 space-y-4">
          <BulkMenuDiscount treatments={treats} categories={categories} onSaved={refresh} />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Per-treatment</p>
            <p className="text-xs text-muted-foreground">Shows a strikethrough original price with the discounted price on your booking page.</p>
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {treats.map((t) => (
              <MenuDiscountRow key={t.id} treat={t} onSaved={refresh} />
            ))}
            {!loading && treats.length === 0 && (
              <p className="text-sm text-muted-foreground">No treatments yet. Add some under Services.</p>
            )}
          </div>
        </TabsContent>


        <TabsContent value="codes" className="mt-4 space-y-3">
          <CodeEditor treatments={treats} categories={categories} onSaved={refresh} />
          <div className="space-y-2">
            {codes.map((c) => (
              <CodeRow key={c.id} code={c} treatments={treats} categories={categories} onChanged={refresh} />
            ))}
            {!loading && codes.length === 0 && <p className="text-sm text-muted-foreground">No codes yet.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MenuDiscountRow({ treat, onSaved }: { treat: Treat; onSaved: () => void }) {
  const save = useServerFn(setTreatmentDiscount);
  const [pct, setPct] = useState<string>(treat.discount_percent?.toString() ?? "");
  const [start, setStart] = useState(treat.discount_starts_at?.slice(0, 10) ?? "");
  const [end, setEnd] = useState(treat.discount_ends_at?.slice(0, 10) ?? "");
  const [dows, setDows] = useState<number[]>(treat.discount_days_of_week ?? []);
  const [open, setOpen] = useState(false);

  async function commit(activate: boolean) {
    const p = activate ? Number(pct || "0") : null;
    if (activate && (!p || p <= 0 || p > 100)) { toast.error("Enter 1–100%"); return; }
    try {
      await save({ data: {
        id: treat.id,
        discount_percent: p,
        discount_starts_at: activate && start ? new Date(start).toISOString() : null,
        discount_ends_at: activate && end ? new Date(end + "T23:59:59").toISOString() : null,
        discount_days_of_week: activate && dows.length ? dows : null,
      }});
      toast.success(activate ? "Discount saved" : "Discount removed");
      onSaved();
      setOpen(false);
    } catch (e) { toast.error((e as Error).message); }
  }

  const hasDiscount = treat.discount_percent != null && treat.discount_percent > 0;
  const discounted = hasDiscount ? Number(treat.price) * (1 - (treat.discount_percent ?? 0) / 100) : null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{treat.name}</p>
          {hasDiscount ? (
            <p className="text-xs text-muted-foreground">
              <span className="line-through">£{Number(treat.price).toFixed(2)}</span>{" "}
              <span className="font-semibold text-emerald-600">£{discounted!.toFixed(2)}</span>{" "}
              <span>· {treat.discount_percent}% off</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">£{Number(treat.price).toFixed(2)} · no discount</p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />{hasDiscount ? "Edit" : "Add"}
          </Button>
          <DialogContent>
            <DialogHeader><DialogTitle>{treat.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>% off</Label>
                <Input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="e.g. 20" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><Label>Starts</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                <div><Label>Ends</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              </div>
              <div>
                <Label className="mb-1 block">Days only (optional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_NAMES.map((d, i) => {
                    const on = dows.includes(i);
                    return (
                      <button key={i} type="button"
                        onClick={() => setDows((prev) => on ? prev.filter((x) => x !== i) : [...prev, i])}
                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-muted-foreground/30"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              {hasDiscount && <Button variant="outline" onClick={() => commit(false)}>Remove</Button>}
              <Button onClick={() => commit(true)}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function CodeEditor({ treatments, categories, onSaved, editing, onClose }: {
  treatments: Treat[]; categories: Category[]; onSaved: () => void;
  editing?: Code | null; onClose?: () => void;
}) {
  const save = useServerFn(upsertDiscountCode);
  const [open, setOpen] = useState(!!editing);
  useEffect(() => { setOpen(!!editing); }, [editing]);

  const [code, setCode] = useState(editing?.code ?? "");
  const [label, setLabel] = useState(editing?.label ?? "");
  const [kind, setKind] = useState<"percent" | "fixed">(editing?.kind ?? "percent");
  const [amount, setAmount] = useState<string>(editing?.amount?.toString() ?? "");
  const [tIds, setTIds] = useState<string[]>(editing?.treatment_ids ?? []);
  const [start, setStart] = useState(editing?.starts_at?.slice(0, 10) ?? "");
  const [end, setEnd] = useState(editing?.ends_at?.slice(0, 10) ?? "");
  const [dows, setDows] = useState<number[]>(editing?.days_of_week ?? []);
  const [maxUses, setMaxUses] = useState<string>(editing?.max_uses?.toString() ?? "");
  const [active, setActive] = useState(editing?.active ?? true);

  useEffect(() => {
    if (!editing) return;
    setCode(editing.code); setLabel(editing.label ?? "");
    setKind(editing.kind); setAmount(editing.amount.toString());
    setTIds(editing.treatment_ids ?? []);
    setStart(editing.starts_at?.slice(0, 10) ?? "");
    setEnd(editing.ends_at?.slice(0, 10) ?? "");
    setDows(editing.days_of_week ?? []);
    setMaxUses(editing.max_uses?.toString() ?? "");
    setActive(editing.active);
  }, [editing]);

  function reset() {
    setCode(""); setLabel(""); setKind("percent"); setAmount("");
    setTIds([]); setStart(""); setEnd(""); setDows([]); setMaxUses(""); setActive(true);
  }

  async function submit() {
    if (!code.trim()) { toast.error("Code is required"); return; }
    const a = Number(amount);
    if (!a || a <= 0) { toast.error("Enter an amount"); return; }
    try {
      await save({ data: {
        id: editing?.id,
        code: code.trim(),
        label: label || null,
        kind, amount: a,
        treatment_ids: tIds,
        starts_at: start ? new Date(start).toISOString() : null,
        ends_at: end ? new Date(end + "T23:59:59").toISOString() : null,
        days_of_week: dows.length ? dows : null,
        max_uses: maxUses ? Number(maxUses) : null,
        active,
      }});
      toast.success("Saved");
      onSaved(); reset(); setOpen(false); onClose?.();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onClose?.(); }}>
      {!editing && (
        <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New code</Button>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit code" : "New discount code"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" /></div>
            <div><Label>Label (optional)</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Summer offer" /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "percent" | "fixed")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% off</SelectItem>
                  <SelectItem value="fixed">£ off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{kind === "percent" ? "Percent" : "Amount (£)"}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div>
            <Label className="mb-1 block">Treatments</Label>
            <p className="mb-1 text-xs text-muted-foreground">Leave empty to apply to all.</p>
            <TreatmentPicker treatments={treatments} categories={categories} value={tIds} onChange={setTIds} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Starts</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Ends</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div>
            <Label className="mb-1 block">Days only (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES.map((d, i) => {
                const on = dows.includes(i);
                return (
                  <button key={i} type="button"
                    onClick={() => setDows((prev) => on ? prev.filter((x) => x !== i) : [...prev, i])}
                    className={`rounded-full border px-3 py-1 text-xs ${on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-muted-foreground/30"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <div><Label>Max uses (optional)</Label><Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
            <div className="flex items-center gap-2 pb-2"><Switch checked={active} onCheckedChange={setActive} /><span className="text-sm">Active</span></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CodeRow({ code, treatments, categories, onChanged }: { code: Code; treatments: Treat[]; categories: Category[]; onChanged: () => void }) {
  const del = useServerFn(deleteDiscountCode);
  const [editing, setEditing] = useState(false);
  const tNames = useMemo(() => {
    if (!code.treatment_ids || code.treatment_ids.length === 0) return "All treatments";
    return treatments.filter((t) => code.treatment_ids.includes(t.id)).map((t) => t.name).join(", ");
  }, [code, treatments]);
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {code.code} <span className="text-muted-foreground">· {code.kind === "percent" ? `${code.amount}% off` : `£${code.amount} off`}</span>
            {!code.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">Inactive</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{tNames} · used {code.uses_count}{code.max_uses ? `/${code.max_uses}` : ""}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
        <Button size="sm" variant="ghost" onClick={async () => {
          if (!confirm("Delete this code?")) return;
          try { await del({ data: { id: code.id } }); toast.success("Deleted"); onChanged(); }
          catch (e) { toast.error((e as Error).message); }
        }}><Trash2 className="h-4 w-4" /></Button>
      </CardContent>
      {editing && (
        <CodeEditor treatments={treatments} categories={categories} onSaved={onChanged} editing={code} onClose={() => setEditing(false)} />
      )}
    </Card>
  );
}

function BulkMenuDiscount({ treatments, categories, onSaved }: { treatments: Treat[]; categories: Category[]; onSaved: () => void }) {
  const save = useServerFn(setTreatmentDiscount);
  const [ids, setIds] = useState<string[]>([]);
  const [pct, setPct] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dows, setDows] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  async function apply(activate: boolean) {
    const targets = ids.length ? ids : treatments.map((t) => t.id);
    if (!targets.length) { toast.error("Pick at least one treatment"); return; }
    const p = activate ? Number(pct || "0") : null;
    if (activate && (!p || p <= 0 || p > 100)) { toast.error("Enter 1–100%"); return; }
    setBusy(true);
    try {
      await Promise.all(targets.map((id) => save({ data: {
        id,
        discount_percent: p,
        discount_starts_at: activate && start ? new Date(start).toISOString() : null,
        discount_ends_at: activate && end ? new Date(end + "T23:59:59").toISOString() : null,
        discount_days_of_week: activate && dows.length ? dows : null,
      }})));
      toast.success(activate ? `Applied to ${targets.length} treatment${targets.length === 1 ? "" : "s"}` : `Reset ${targets.length}`);
      onSaved();
      if (!activate) { setIds([]); setPct(""); setStart(""); setEnd(""); setDows([]); }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Apply offer to multiple treatments</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="mb-1 block">Treatments</Label>
          {treatments.length === 0 ? (
            <p className="px-1 text-xs italic text-muted-foreground">No treatments yet.</p>
          ) : (
            <TreatmentPicker treatments={treatments} categories={categories} value={ids} onChange={setIds} placeholder="Select treatments…" />
          )}
          <p className="mt-1 text-xs text-muted-foreground">{ids.length ? `${ids.length} selected` : "All treatments"}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">% off</Label><Input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="20" /></div>
          <div><Label className="text-xs">Starts</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label className="text-xs">Ends</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div>
          <Label className="mb-1 block text-xs">Days only (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((d, i) => {
              const on = dows.includes(i);
              return (
                <button key={i} type="button"
                  onClick={() => setDows((prev) => on ? prev.filter((x) => x !== i) : [...prev, i])}
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-muted-foreground/30"}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => apply(true)}>{busy ? "Saving…" : "Apply offer"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => apply(false)}>Reset selected to normal prices</Button>
        </div>
      </CardContent>
    </Card>
  );
}

