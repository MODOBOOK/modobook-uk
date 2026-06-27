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
  slot_date: string; start_time: string; end_time: string;
  price_mode: "fixed" | "percent"; price_value: number;
  notes: string | null; booked_appointment_id: string | null; active: boolean;
  category: string | null;
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard/menu"><ArrowLeft className="mr-1 h-4 w-4" />Menu</Link></Button>
      </div>
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


      <div className="space-y-2">
        {slots.map((s) => {
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
                    {new Date(s.slot_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}{" "}
                    · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    {s.location_id && lById.get(s.location_id) ? ` · ${lById.get(s.location_id)!.name}` : ""}
                  </p>
                  {s.category && (
                    <p className="mt-0.5 inline-block rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-700">{s.category}</p>
                  )}
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
        {slots.length === 0 && <p className="text-sm text-muted-foreground">No model slots yet.</p>}
      </div>

      {editing && (
        <SlotEditor
          existing={editing === "new" ? null : editing}
          treatments={treats}
          locations={locs}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function SlotEditor({ existing, treatments, locations, onClose, onSaved }: {
  existing: Slot | null;
  treatments: Treat[]; locations: Loc[];
  onClose: () => void; onSaved: () => void;
}) {
  const save = useServerFn(upsertModelSlot);
  const [treatmentId, setTreatmentId] = useState(existing?.treatment_id ?? treatments[0]?.id ?? "");
  const [locationId, setLocationId] = useState<string>(existing?.location_id ?? "");
  const [date, setDate] = useState(existing?.slot_date ?? "");
  const [startT, setStartT] = useState(existing?.start_time?.slice(0, 5) ?? "10:00");
  const [endT, setEndT] = useState(existing?.end_time?.slice(0, 5) ?? "11:00");
  const [mode, setMode] = useState<"fixed" | "percent">(existing?.price_mode ?? "fixed");
  const [value, setValue] = useState<string>(existing?.price_value?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [category, setCategory] = useState(existing?.category ?? "");


  const t = treatments.find((x) => x.id === treatmentId);

  async function submit() {
    if (!treatmentId || !date || !startT || !endT) { toast.error("Fill all fields"); return; }
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) { toast.error("Enter a valid price"); return; }
    if (mode === "percent" && v > 100) { toast.error("Percent must be ≤ 100"); return; }
    try {
      await save({ data: {
        id: existing?.id,
        treatment_id: treatmentId,
        location_id: locationId || null,
        slot_date: date,
        start_time: startT,
        end_time: endT,
        price_mode: mode,
        price_value: v,
        notes: notes || null,
        active,
        category: category.trim() || null,
      }});
      toast.success("Saved");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Edit model slot" : "New model slot"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Treatment</Label>
            <Select value={treatmentId} onValueChange={setTreatmentId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {treatments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · £{Number(t.price).toFixed(2)}</SelectItem>)}
              </SelectContent>
            </Select>
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
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Start</Label><Input type="time" value={startT} onChange={(e) => setStartT(e.target.value)} /></div>
            <div><Label>End</Label><Input type="time" value={endT} onChange={(e) => setEndT(e.target.value)} /></div>
          </div>
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
              {t && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Normal £{Number(t.price).toFixed(2)} →{" "}
                  <span className="font-semibold text-emerald-600">
                    £{(mode === "fixed" ? Number(value || 0) : Math.max(0, Number(t.price) * (1 - Number(value || 0) / 100))).toFixed(2)}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div>
            <Label>Category (optional)</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Lip filler, Botox, Skin" />
            <p className="mt-1 text-xs text-muted-foreground">Slots with the same category are grouped together on your booking page.</p>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Photos required, etc." />
          </div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><span className="text-sm">Active</span></div>
        </div>
        <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
