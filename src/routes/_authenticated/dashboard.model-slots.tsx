import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyModelSlots, upsertModelSlot, deleteModelSlot } from "@/lib/discounts.functions";
import { getMyTreatments, createTreatment } from "@/lib/treatments.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { listMyLocations } from "@/lib/locations.functions";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles, ArrowLeft, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/model-slots")({
  ssr: false,
  component: ModelSlotsPage,
});

type Slot = {
  id: string; treatment_id: string; location_id: string | null;
  slot_date: string | null; start_time: string | null; end_time: string | null;
  price_mode: "fixed" | "percent"; price_value: number;
  notes: string | null; booked_appointment_id: string | null; active: boolean;
  category: string | null;
  is_flexible?: boolean | null;
};

type Treat = { id: string; name: string; price: number; duration: number };
type Loc = { id: string; name: string };

function ModelSlotsPage() {
  const list = useServerFn(listMyModelSlots);
  const lTreats = useServerFn(getMyTreatments);
  const lLocs = useServerFn(listMyLocations);
  const del = useServerFn(deleteModelSlot);
  const lProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateProfile);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [treats, setTreats] = useState<Treat[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [editing, setEditing] = useState<Slot | "new" | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [position, setPosition] = useState<"top" | "bottom">("top");

  async function refresh() {
    const [s, t, l, p] = await Promise.all([list(), lTreats(), lLocs(), lProfile()]);
    setSlots((s as any) ?? []);
    setTreats((t as any) ?? []);
    setLocs((l as any) ?? []);
    if (p) {
      setProfileId((p as any).id);
      setPosition(((p as any).model_slots_position ?? "top") as "top" | "bottom");
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function changePosition(next: "top" | "bottom") {
    if (!profileId) return;
    setPosition(next);
    try {
      await saveProfile({ data: { id: profileId, model_slots_position: next } });
      toast.success(`Model slots will show at the ${next} of the booking menu`);
    } catch (e) { toast.error((e as Error).message); }
  }

  const tById = new Map(treats.map((t) => [t.id, t]));
  const lById = new Map(locs.map((l) => [l.id, l]));

  const existingCategories = Array.from(
    new Set(slots.map((s) => (s.category ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const groupedSlots: { category: string; items: Slot[] }[] = (() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = (s.category && s.category.trim()) || "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries())
      .sort((a, b) =>
        a[0] === "Uncategorised" ? 1 : b[0] === "Uncategorised" ? -1 : a[0].localeCompare(b[0]),
      )
      .map(([category, items]) => ({ category, items }));
  })();


  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Sparkles className="h-6 w-6 text-fuchsia-600" />Model slots</h1>
          <p className="text-sm text-muted-foreground">Open specific dates and times at a model price. These appear on your booking page in a dedicated section and as a tag on the treatment.</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus className="mr-1.5 h-4 w-4" />New model slot</Button>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-semibold">Position on booking menu</p>
            <p className="text-xs text-muted-foreground">Choose whether the Model slots section sits above or below your treatment categories.</p>
          </div>
          <Select value={position} onValueChange={(v) => changePosition(v as "top" | "bottom")}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top of menu</SelectItem>
              <SelectItem value="bottom">Bottom of menu</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>


      <div className="space-y-6">
        {groupedSlots.map((group) => (
          <div key={group.category} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-fuchsia-700">{group.category}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{group.items.length}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {group.items.map((s) => {
              const t = tById.get(s.treatment_id);
              const finalPrice = s.price_mode === "fixed"
                ? Number(s.price_value)
                : Math.max(0, Number(t?.price ?? 0) * (1 - Number(s.price_value) / 100));
              return (
                <Card key={s.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t?.name ?? "(deleted)"}</p>
                      <p className="text-xs text-muted-foreground">
                        <Calendar className="-mt-0.5 mr-1 inline h-3 w-3" />
                        {s.is_flexible ? (
                          <span className="font-medium text-fuchsia-700">Any date &amp; time — patient picks</span>
                        ) : (
                          <>
                            {new Date((s.slot_date ?? "") + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}{" "}
                            · {(s.start_time ?? "").slice(0, 5)}–{(s.end_time ?? "").slice(0, 5)}
                          </>
                        )}
                        {s.location_id && lById.get(s.location_id) ? ` · ${lById.get(s.location_id)!.name}` : ""}
                      </p>
                      <p className="text-xs">
                        {t && <span className="line-through text-muted-foreground">£{Number(t.price).toFixed(2)}</span>}{" "}
                        <span className="font-semibold text-emerald-600">£{finalPrice.toFixed(2)}</span>{" "}
                        <span className="text-muted-foreground">({s.price_mode === "percent" ? `${s.price_value}% off` : "model price"})</span>
                      </p>
                      {s.booked_appointment_id && <p className="text-xs font-medium text-amber-600">Booked</p>}
                      {!s.active && <p className="text-xs uppercase text-muted-foreground">Inactive</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm("Delete this slot?")) return;
                      try { await del({ data: { id: s.id } }); toast.success("Deleted"); refresh(); }
                      catch (e) { toast.error((e as Error).message); }
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
        {slots.length === 0 && <p className="text-sm text-muted-foreground">No model slots yet.</p>}
      </div>

      {editing && (
        <SlotEditor
          existing={editing === "new" ? null : editing}
          treatments={treats}
          locations={locs}
          existingCategories={existingCategories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

    </div>
  );
}

function SlotEditor({ existing, treatments, locations, existingCategories, onClose, onSaved }: {
  existing: Slot | null;
  treatments: Treat[]; locations: Loc[];
  existingCategories: string[];
  onClose: () => void; onSaved: () => void;
}) {
  const save = useServerFn(upsertModelSlot);
  const createT = useServerFn(createTreatment);
  const [allTreatments, setAllTreatments] = useState<Treat[]>(treatments);
  const [selectedIds, setSelectedIds] = useState<string[]>(existing ? [existing.treatment_id] : []);
  const [locationId, setLocationId] = useState<string>(existing?.location_id ?? "");
  const [date, setDate] = useState(existing?.slot_date ?? "");
  const [startT, setStartT] = useState(existing?.start_time?.slice(0, 5) ?? "10:00");
  const [endT, setEndT] = useState(existing?.end_time?.slice(0, 5) ?? "11:00");
  const [extraWindows, setExtraWindows] = useState<{ date: string; start: string; end: string }[]>([]);
  const [mode, setMode] = useState<"fixed" | "percent">(existing?.price_mode ?? "fixed");
  const [value, setValue] = useState<string>(existing?.price_value?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [category, setCategory] = useState(existing?.category ?? "");
  const [isFlexible, setIsFlexible] = useState<boolean>(!!existing?.is_flexible);




  // Inline "create new treatment" state
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [creating, setCreating] = useState(false);

  const isEdit = !!existing;

  function toggle(id: string) {
    setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  async function addNewTreatment() {
    if (!newName.trim()) { toast.error("Treatment name required"); return; }
    const p = Number(newPrice); const d = Number(newDuration);
    if (!Number.isFinite(p) || p < 0) { toast.error("Valid price required"); return; }
    if (!Number.isFinite(d) || d <= 0) { toast.error("Valid duration required"); return; }
    setCreating(true);
    try {
      const t = await createT({ data: { name: newName.trim(), price: p, duration: d } }) as any;
      const newT: Treat = { id: t.id, name: t.name, price: Number(t.price), duration: t.duration };
      setAllTreatments((cur) => [...cur, newT]);
      setSelectedIds((cur) => isEdit ? [newT.id] : [...cur, newT.id]);
      setNewName(""); setNewPrice(""); setNewDuration("30"); setShowNew(false);
      toast.success("Treatment added");
    } catch (e) { toast.error((e as Error).message); }
    finally { setCreating(false); }
  }

  async function submit() {
    if (selectedIds.length === 0) { toast.error("Select at least one treatment"); return; }
    if (!isFlexible && (!date || !startT || !endT)) { toast.error("Fill date and times, or turn on 'Any date/time'"); return; }
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) { toast.error("Enter a valid price"); return; }
    if (mode === "percent" && v > 100) { toast.error("Percent must be ≤ 100"); return; }
    try {
      if (isEdit) {
        await save({ data: {
          id: existing!.id,
          treatment_id: selectedIds[0],
          location_id: locationId || null,
          is_flexible: isFlexible,
          slot_date: isFlexible ? null : date,
          start_time: isFlexible ? null : startT,
          end_time: isFlexible ? null : endT,
          price_mode: mode, price_value: v,
          notes: notes || null, active, category: category.trim() || null,
        }});
      } else {
        const windows = isFlexible
          ? [{ date: null, start: null, end: null }]
          : [
              { date, start: startT, end: endT },
              ...extraWindows.filter((w) => w.date && w.start && w.end),
            ];
        let count = 0;
        for (const w of windows) {
          for (const tid of selectedIds) {
            await save({ data: {
              treatment_id: tid,
              location_id: locationId || null,
              is_flexible: isFlexible,
              slot_date: w.date, start_time: w.start, end_time: w.end,
              price_mode: mode, price_value: v,
              notes: notes || null, active, category: category.trim() || null,
            }});
            count++;
          }
        }
        toast.success(`Created ${count} model slot${count === 1 ? "" : "s"}`);
        onSaved();
        return;
      }
      toast.success("Saved");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
  }




  const previewT = allTreatments.find((x) => x.id === selectedIds[0]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit model slot" : "New model slot"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>{isEdit ? "Treatment" : "Treatments"}</Label>
              {!showNew && <Button type="button" size="sm" variant="outline" onClick={() => setShowNew(true)}><Plus className="mr-1 h-3.5 w-3.5" />New treatment</Button>}
            </div>
            {!isEdit && <p className="mb-2 text-xs text-muted-foreground">Select one or more — a slot will be created for each.</p>}
            {showNew && (
              <Card className="mb-2 border-dashed">
                <CardContent className="space-y-2 p-3">
                  <Input placeholder="Treatment name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Price (£)" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                    <Input type="number" placeholder="Duration (min)" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                    <Button type="button" size="sm" onClick={addNewTreatment} disabled={creating}>{creating ? "Adding…" : "Add"}</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {isEdit ? (
              <Select value={selectedIds[0] ?? ""} onValueChange={(v) => setSelectedIds([v])}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {allTreatments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · £{Number(t.price).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                {allTreatments.length === 0 && <p className="p-2 text-xs text-muted-foreground">No treatments yet — add one above.</p>}
                {allTreatments.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted">
                    <Checkbox checked={selectedIds.includes(t.id)} onCheckedChange={() => toggle(t.id)} />
                    <span className="flex-1 text-sm">{t.name}</span>
                    <span className="text-xs text-muted-foreground">£{Number(t.price).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {locations.length > 0 && (
            <div>
              <Label>Location (optional)</Label>
              <Select value={locationId || "any"} onValueChange={(v) => setLocationId(v === "any" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any location</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-start justify-between gap-3 rounded-md border border-dashed p-3">
            <div className="min-w-0">
              <Label className="m-0">Any date &amp; time</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Patient picks any time in your normal availability at the model price — no fixed window.</p>
            </div>
            <Switch checked={isFlexible} onCheckedChange={setIsFlexible} />
          </div>

          {!isFlexible && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div><Label>Start</Label><Input type="time" value={startT} onChange={(e) => setStartT(e.target.value)} /></div>
                <div><Label>End</Label><Input type="time" value={endT} onChange={(e) => setEndT(e.target.value)} /></div>
              </div>
              {!isEdit && (
                <div className="space-y-2">
                  {extraWindows.map((w, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                      <div><Label className="text-xs">Date</Label><Input type="date" value={w.date} onChange={(e) => setExtraWindows((c) => c.map((x, ix) => ix === i ? { ...x, date: e.target.value } : x))} /></div>
                      <div><Label className="text-xs">Start</Label><Input type="time" value={w.start} onChange={(e) => setExtraWindows((c) => c.map((x, ix) => ix === i ? { ...x, start: e.target.value } : x))} /></div>
                      <div><Label className="text-xs">End</Label><Input type="time" value={w.end} onChange={(e) => setExtraWindows((c) => c.map((x, ix) => ix === i ? { ...x, end: e.target.value } : x))} /></div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setExtraWindows((c) => c.filter((_, ix) => ix !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={() => setExtraWindows((c) => [...c, { date: "", start: "10:00", end: "11:00" }])}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Add another date/time
                  </Button>
                  <p className="text-xs text-muted-foreground">Each window will create its own model slot for each selected treatment. Patients can book any back-to-back time within the window.</p>
                </div>
              )}
            </>
          )}


          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price type</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "fixed" | "percent")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed £ price</SelectItem>
                  <SelectItem value="percent">% off normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{mode === "fixed" ? "Model price (£)" : "% off"}</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              {previewT && selectedIds.length === 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Normal £{Number(previewT.price).toFixed(2)} →{" "}
                  <span className="font-semibold text-emerald-600">
                    £{(mode === "fixed" ? Number(value || 0) : Math.max(0, Number(previewT.price) * (1 - Number(value || 0) / 100))).toFixed(2)}
                  </span>
                </p>
              )}
              {selectedIds.length > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">{mode === "fixed" ? "Same fixed price applied to all selected." : "Same % off applied to each treatment."}</p>
              )}
            </div>
          </div>
          <div>
            <Label>Category (optional)</Label>
            {existingCategories.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {existingCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(category.trim() === c ? "" : c)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      category.trim() === c
                        ? "border-fuchsia-600 bg-fuchsia-600 text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Lip filler, Botox, Skin" />
            <p className="mt-1 text-xs text-muted-foreground">Pick an existing category or type a new one. Slots with the same category are grouped together on your booking page.</p>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Photos required, etc." />
          </div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><span className="text-sm">Active</span></div>
        </div>
        <DialogFooter><Button onClick={submit}>{isEdit ? "Save" : `Create ${selectedIds.length || ""} slot${selectedIds.length === 1 ? "" : "s"}`.trim()}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
