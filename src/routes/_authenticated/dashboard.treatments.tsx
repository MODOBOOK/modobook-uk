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
import { getTreatmentAddons, setTreatmentAddons, type AddonLink } from "@/lib/treatment-addons.functions";
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
  validateSearch: (s: Record<string, unknown>) => ({ edit: typeof s.edit === "string" ? s.edit : undefined }),
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
  addons: AddonLink[];
  addon_mode: "off" | "optional";
  discount_percent: number | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  discount_show_was_now: boolean;
  discount_label: string | null;
  session_count: number;
  allow_split_payment: boolean;
  rebook_reminder_days: number | null;
  aftercare_html: string;
  aftercare_delay_hours: number;
  auto_send_medical_forms: boolean;
  auto_send_aftercare: boolean;
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
  const setAddons = useServerFn(setTreatmentAddons);

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

  const search = Route.useSearch();
  useEffect(() => {
    if (!search.edit || items.length === 0) return;
    const t = items.find((x) => x.id === search.edit);
    if (t) {
      setEditing(t);
      setOpen(true);
    }
  }, [search.edit, items]);

  async function handleSave(form: TreatmentForm) {
    try {
      const { consent_ids, addons, ...rest } = form;
      let id: string;
      if (editing) {
        await update({ data: { id: editing.id, ...rest } });
        id = editing.id;
        toast.success("Treatment updated");
      } else {
        // create only accepts the legacy fields; send those, then patch the rest
        const created = await create({
          data: {
            name: rest.name,
            duration: rest.duration,
            price: rest.price,
            description: rest.description,
            category_id: rest.category_id,
            active: rest.active,
          },
        });
        id = (created as { id: string }).id;
        await update({ data: { id, ...rest } });
        toast.success("Treatment created");
      }
      await setConsents({ data: { treatmentId: id, consentTemplateIds: consent_ids } });
      await setAddons({ data: { treatmentId: id, addons } });
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
            allTreatments={items}
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
  allTreatments,
  onSave,
}: {
  treatment: Treatment | null;
  categories: Category[];
  consentTemplates: ConsentTpl[];
  allTreatments: Treatment[];
  onSave: (f: TreatmentForm) => void;
}) {
  const fetchConsents = useServerFn(getTreatmentConsents);
  const fetchAddons = useServerFn(getTreatmentAddons);
  const [name, setName] = useState(treatment?.name ?? "");
  const [duration, setDuration] = useState(treatment?.duration ?? 30);
  const [price, setPrice] = useState(treatment?.price ?? 0);
  const [description, setDescription] = useState(treatment?.description ?? "");
  const [active, setActive] = useState(treatment?.active ?? true);
  const [consentIds, setConsentIds] = useState<string[]>([]);
  const [addons, setAddons] = useState<AddonLink[]>([]);
  const [addonMode, setAddonMode] = useState<"off" | "optional">(
    (treatment?.addon_mode as "off" | "optional") ?? "optional",
  );
  const [discountPercent, setDiscountPercent] = useState<number | "">(
    treatment?.discount_percent ?? "",
  );
  const [discountStartsAt, setDiscountStartsAt] = useState<string>(
    treatment?.discount_starts_at ? treatment.discount_starts_at.slice(0, 16) : "",
  );
  const [discountEndsAt, setDiscountEndsAt] = useState<string>(
    treatment?.discount_ends_at ? treatment.discount_ends_at.slice(0, 16) : "",
  );
  const [discountShowWasNow, setDiscountShowWasNow] = useState<boolean>(
    treatment?.discount_show_was_now ?? true,
  );
  const [discountLabel, setDiscountLabel] = useState<string>(treatment?.discount_label ?? "");
  const [sessionCount, setSessionCount] = useState<number>(
    (treatment as { session_count?: number } | null)?.session_count ?? 1,
  );
  const [allowSplit, setAllowSplit] = useState<boolean>(
    (treatment as { allow_split_payment?: boolean } | null)?.allow_split_payment ?? false,
  );
  const [rebookDays, setRebookDays] = useState<string>(
    (treatment as { rebook_reminder_days?: number | null } | null)?.rebook_reminder_days != null
      ? String((treatment as { rebook_reminder_days?: number | null }).rebook_reminder_days)
      : "",
  );
  const [aftercareHtml, setAftercareHtml] = useState<string>(
    (treatment as { aftercare_html?: string | null } | null)?.aftercare_html ?? "",
  );
  const [aftercareDelay, setAftercareDelay] = useState<number>(
    (treatment as { aftercare_delay_hours?: number } | null)?.aftercare_delay_hours ?? 2,
  );
  const [autoSendForms, setAutoSendForms] = useState<boolean>(
    (treatment as { auto_send_medical_forms?: boolean } | null)?.auto_send_medical_forms ?? true,
  );
  const [autoSendAftercare, setAutoSendAftercare] = useState<boolean>(
    (treatment as { auto_send_aftercare?: boolean } | null)?.auto_send_aftercare ?? true,
  );

  const topLevel = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childrenOf = (parentId: string | null) =>
    parentId ? categories.filter((c) => c.parent_id === parentId) : [];

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
    setAddonMode((treatment?.addon_mode as "off" | "optional") ?? "optional");
    setDiscountPercent(treatment?.discount_percent ?? "");
    setDiscountStartsAt(treatment?.discount_starts_at ? treatment.discount_starts_at.slice(0, 16) : "");
    setDiscountEndsAt(treatment?.discount_ends_at ? treatment.discount_ends_at.slice(0, 16) : "");
    setDiscountShowWasNow(treatment?.discount_show_was_now ?? true);
    setDiscountLabel(treatment?.discount_label ?? "");
    setSessionCount((treatment as { session_count?: number } | null)?.session_count ?? 1);
    setAllowSplit((treatment as { allow_split_payment?: boolean } | null)?.allow_split_payment ?? false);
    setRebookDays(
      (treatment as { rebook_reminder_days?: number | null } | null)?.rebook_reminder_days != null
        ? String((treatment as { rebook_reminder_days?: number | null }).rebook_reminder_days)
        : "",
    );
    setAftercareHtml((treatment as { aftercare_html?: string | null } | null)?.aftercare_html ?? "");
    setAftercareDelay((treatment as { aftercare_delay_hours?: number } | null)?.aftercare_delay_hours ?? 2);
    setAutoSendForms((treatment as { auto_send_medical_forms?: boolean } | null)?.auto_send_medical_forms ?? true);
    setAutoSendAftercare((treatment as { auto_send_aftercare?: boolean } | null)?.auto_send_aftercare ?? true);
    if (treatment?.id) {
      fetchConsents({ data: { treatmentId: treatment.id } })
        .then((ids) => setConsentIds(ids as string[]))
        .catch(() => setConsentIds([]));
      fetchAddons({ data: { treatmentId: treatment.id } })
        .then((rows) => setAddons(rows as AddonLink[]))
        .catch(() => setAddons([]));
    } else {
      setConsentIds([]);
      setAddons([]);
    }
  }, [treatment, fetchConsents, fetchAddons, initial.parent, initial.sub]);

  function toggleConsent(id: string) {
    setConsentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAddon(id: string) {
    setAddons((prev) =>
      prev.some((a) => a.addon_id === id)
        ? prev.filter((a) => a.addon_id !== id)
        : [...prev, { addon_id: id, discount_percent: null, discount_amount: null }],
    );
  }
  function setAddonDiscount(id: string, percent: number | null) {
    setAddons((prev) => prev.map((a) => (a.addon_id === id ? { ...a, discount_percent: percent } : a)));
  }

  const subOptions = childrenOf(parentId);
  const addonCandidates = allTreatments.filter((t) => t.id !== treatment?.id && t.active);

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
              <Button type="button" size="icon" variant="ghost" onClick={() => { setParentId(null); setSubId(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Select onValueChange={(v) => { setParentId(v); setSubId(null); }}>
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {topLevel.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No categories yet — create one in Categories.</div>
                ) : (
                  topLevel.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
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
              <p className="text-xs text-muted-foreground">No sub-categories under this category. Add one in Categories.</p>
            ) : (
              <Select onValueChange={(v) => setSubId(v)}>
                <SelectTrigger><SelectValue placeholder="Select a sub category" /></SelectTrigger>
                <SelectContent>
                  {subOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

        {/* Sessions & split payment */}
        <div className="rounded-md border p-3 space-y-3">
          <Label className="m-0">Sessions & payment</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Number of sessions</Label>
              <Input
                type="number"
                min={1}
                value={sessionCount}
                onChange={(e) => setSessionCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rebook reminder (days, optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 28"
                value={rebookDays}
                onChange={(e) => setRebookDays(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={allowSplit}
              onCheckedChange={setAllowSplit}
              disabled={sessionCount < 2}
            />
            <span>Allow patients to split payment across each session</span>
          </label>
          {sessionCount < 2 && (
            <p className="text-xs text-muted-foreground">Set 2 or more sessions to enable split payments.</p>
          )}
        </div>


        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Label className="m-0">Discount on this treatment</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">% off</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 15"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Label (optional)</Label>
              <Input
                placeholder="e.g. Spring offer"
                value={discountLabel}
                onChange={(e) => setDiscountLabel(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Starts (optional)</Label>
              <Input type="datetime-local" value={discountStartsAt} onChange={(e) => setDiscountStartsAt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ends (optional)</Label>
              <Input type="datetime-local" value={discountEndsAt} onChange={(e) => setDiscountEndsAt(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={discountShowWasNow} onCheckedChange={setDiscountShowWasNow} />
            <span>Show was/now price (crossed-out original) on booking page</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Leave % blank to disable. Discount can also stack or compete with promo codes — set the rule in Settings.
          </p>
        </div>

        {/* Add-ons moved to dedicated page */}
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-muted-foreground" />
            <Label className="m-0">Add-ons</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Add-ons are now managed in one place. Go to <span className="font-medium">Dashboard → Add-ons</span> to create add-on items and assign them to this treatment (or a whole category) with optional discounts.
          </p>
        </div>


        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="m-0">Consent forms to send on booking</Label>
          </div>
          {consentTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No consent forms yet. Add them in Dashboard → Consent forms.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {consentTemplates.map((t) => (
                <label key={t.id} className="flex items-start gap-2 text-sm">
                  <Checkbox checked={consentIds.includes(t.id)} onCheckedChange={() => toggleConsent(t.id)} />
                  <span>
                    {t.name}
                    {t.is_system && <span className="ml-2 text-xs text-muted-foreground">(template)</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Patients receive a link to complete each selected form after they book.
          </p>
          <label className="flex items-center gap-2 text-sm pt-2 border-t">
            <Switch checked={autoSendForms} onCheckedChange={setAutoSendForms} />
            <span>Auto-send medical forms when this treatment is booked</span>
          </label>
        </div>

        {/* Aftercare */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="m-0">Aftercare instructions</Label>
          </div>
          <Textarea
            rows={5}
            value={aftercareHtml}
            onChange={(e) => setAftercareHtml(e.target.value)}
            placeholder="Aftercare instructions to send to the patient after their appointment. Plain text or basic HTML accepted."
          />
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Send after (hours)</Label>
              <Input
                type="number"
                min={0}
                value={aftercareDelay}
                onChange={(e) => setAftercareDelay(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <Switch checked={autoSendAftercare} onCheckedChange={setAutoSendAftercare} />
              <span>Auto-send aftercare</span>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Aftercare is scheduled the moment the appointment is booked and dispatched at the chosen delay after the appointment ends.</p>
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
              addons: addons,
              addon_mode: addonMode,
              discount_percent: discountPercent === "" ? null : Number(discountPercent),
              discount_starts_at: discountStartsAt ? new Date(discountStartsAt).toISOString() : null,
              discount_ends_at: discountEndsAt ? new Date(discountEndsAt).toISOString() : null,
              discount_show_was_now: discountShowWasNow,
              discount_label: discountLabel || null,
              session_count: sessionCount,
              allow_split_payment: allowSplit && sessionCount >= 2,
              rebook_reminder_days: rebookDays === "" ? null : Number(rebookDays),
              aftercare_html: aftercareHtml,
              aftercare_delay_hours: aftercareDelay,
              auto_send_medical_forms: autoSendForms,
              auto_send_aftercare: autoSendAftercare,
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



