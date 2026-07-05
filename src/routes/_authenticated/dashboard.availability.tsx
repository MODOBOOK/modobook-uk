import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, Plus, Repeat } from "lucide-react";
import {
  listAvailabilityRules,
  upsertAvailabilityRule,
  deleteAvailabilityRule,
  listAvailabilityOverrides,
  addAvailabilityOverride,
  deleteAvailabilityOverride,
  listBlockedDates,
  addBlockedDate,
  deleteBlockedDate,
  getRotaSettings,
  setRotaAnchor,
  listPractitioners,
} from "@/lib/availability.functions";
import { listMyLocations } from "@/lib/locations.functions";
import { WEEK_LETTERS, weekLetterFor, toMondayIso } from "@/lib/rota";

export const Route = createFileRoute("/_authenticated/dashboard/availability")({
  ssr: false,
  component: AvailabilityPage,
});

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun mapped to JS DOW

type Rule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_interval: number;
  location_id: string | null;
  cycle_length?: number | null;
  weeks_mask?: number | null;
  practitioner_id?: string | null;
};
type Location = { id: string; name: string };
type Practitioner = { id: string; name: string };
type Override = {
  id: string; date: string; start_time: string; end_time: string;
  slot_interval: number; location_id: string | null;
};
type Blocked = { id: string; date: string; reason: string | null; location_id: string | null };

function AvailabilityPage() {
  const list = useServerFn(listAvailabilityRules);
  const upsert = useServerFn(upsertAvailabilityRule);
  const del = useServerFn(deleteAvailabilityRule);
  const listLocs = useServerFn(listMyLocations);
  const listPracts = useServerFn(listPractitioners);
  const listOv = useServerFn(listAvailabilityOverrides);
  const addOv = useServerFn(addAvailabilityOverride);
  const delOv = useServerFn(deleteAvailabilityOverride);
  const listBl = useServerFn(listBlockedDates);
  const addBl = useServerFn(addBlockedDate);
  const delBl = useServerFn(deleteBlockedDate);
  const getRota = useServerFn(getRotaSettings);
  const setAnchor = useServerFn(setRotaAnchor);

  const [rules, setRules] = useState<Rule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [anchorDate, setAnchorDate] = useState<string | null>(null);

  const [cycleLength, setCycleLength] = useState<number>(1);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    day_of_week: 1,
    start: "09:00",
    end: "17:00",
    interval: "30",
    location_id: "none",
    practitioner_id: "none",
    weeks: [true, false, false, false] as boolean[], // A,B,C,D
  });

  const today = new Date().toISOString().slice(0, 10);
  const [ovDate, setOvDate] = useState(today);
  const [ovStart, setOvStart] = useState("09:00");
  const [ovEnd, setOvEnd] = useState("13:00");
  const [ovInterval, setOvInterval] = useState("30");
  const [ovLoc, setOvLoc] = useState<string>("none");

  const [blDate, setBlDate] = useState(today);
  const [blReason, setBlReason] = useState("");
  const [blLoc, setBlLoc] = useState<string>("none");

  async function refresh() {
    const [r, l, p, o, b, rota] = await Promise.all([list(), listLocs(), listPracts(), listOv(), listBl(), getRota()]);
    setRules(r as Rule[]);
    setLocations(l as Location[]);
    setPractitioners(p as Practitioner[]);
    setOverrides(o as Override[]);
    setBlocked(b as Blocked[]);
    setAnchorDate((rota as { rota_anchor_date: string | null })?.rota_anchor_date ?? null);
    // Derive cycle length from existing rules (max seen)
    const maxCycle = Math.max(1, ...((r as Rule[]).map((x) => x.cycle_length ?? 1)));
    setCycleLength(maxCycle);
  }
  useEffect(() => { refresh(); }, []);

  const thisWeekLetter = useMemo(() => {
    if (cycleLength <= 1) return 0;
    return weekLetterFor(today, anchorDate, cycleLength);
  }, [cycleLength, anchorDate, today]);

  async function updateCycle(newCycle: number) {
    setCycleLength(newCycle);
    if (newCycle > 1 && !anchorDate) {
      // Anchor = Monday of current week
      const monday = toMondayIso(today);
      try {
        await setAnchor({ data: { date: monday } });
        setAnchorDate(monday);
        toast.success("Rota started this Monday");
      } catch (err: any) { toast.error(err?.message ?? "Failed"); }
    }
  }

  function openAdd(day: number, weekIdx: number) {
    setEditing(null);
    const weeks = Array.from({ length: 4 }, (_, i) => i === weekIdx);
    setForm({
      day_of_week: day, start: "09:00", end: "17:00", interval: "30",
      location_id: "none", practitioner_id: "none", weeks,
    });
    setDlgOpen(true);
  }
  function openEdit(r: Rule) {
    setEditing(r);
    const mask = r.weeks_mask ?? 1;
    const weeks = Array.from({ length: 4 }, (_, i) => (mask & (1 << i)) !== 0);
    setForm({
      day_of_week: r.day_of_week,
      start: r.start_time.slice(0, 5),
      end: r.end_time.slice(0, 5),
      interval: String(r.slot_interval),
      location_id: r.location_id ?? "none",
      practitioner_id: r.practitioner_id ?? "none",
      weeks,
    });
    setDlgOpen(true);
  }

  async function saveShift() {
    if (form.start >= form.end) { toast.error("End time must be after start"); return; }
    let mask = 0;
    for (let i = 0; i < cycleLength; i++) if (form.weeks[i]) mask |= (1 << i);
    if (mask === 0) { toast.error("Pick at least one week"); return; }
    try {
      await upsert({
        data: {
          id: editing?.id,
          day_of_week: form.day_of_week,
          start_time: form.start,
          end_time: form.end,
          slot_interval: Number(form.interval),
          location_id: form.location_id === "none" ? null : form.location_id,
          practitioner_id: form.practitioner_id === "none" ? null : form.practitioner_id,
          cycle_length: cycleLength,
          weeks_mask: mask,
        },
      });
      toast.success(editing ? "Shift updated" : "Shift added");
      setDlgOpen(false);
      await refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }

  async function removeRule(id: string) {
    try { await del({ data: { id } }); await refresh(); }
    catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }

  async function addOverride(e: React.FormEvent) {
    e.preventDefault();
    if (ovStart >= ovEnd) { toast.error("End time must be after start"); return; }
    try {
      await addOv({ data: { date: ovDate, start_time: ovStart, end_time: ovEnd, slot_interval: Number(ovInterval), location_id: ovLoc === "none" ? null : ovLoc } });
      toast.success("One-off slot added");
      await refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }
  async function removeOverride(id: string) {
    try { await delOv({ data: { id } }); await refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }
  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addBl({ data: { date: blDate, reason: blReason || undefined, location_id: blLoc === "none" ? null : blLoc } });
      toast.success("Day closed");
      setBlReason("");
      await refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }
  async function removeBlock(id: string) {
    try { await delBl({ data: { id } }); await refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }

  // Group rules for grid rendering: [weekIdx][dow] -> Rule[]
  function rulesFor(day: number, weekIdx: number): Rule[] {
    return rules.filter((r) => {
      if (r.day_of_week !== day) return false;
      const cycle = r.cycle_length ?? 1;
      const mask = r.weeks_mask ?? 1;
      if (cycle === 1) return true; // applies every week → show in every row
      return (mask & (1 << weekIdx)) !== 0;
    });
  }

  function locName(id: string | null | undefined) {
    return locations.find((l) => l.id === id)?.name;
  }
  function pracName(id: string | null | undefined) {
    return practitioners.find((p) => p.id === id)?.name;
  }

  function weeksLabel(r: Rule): string {
    const cycle = r.cycle_length ?? 1;
    if (cycle === 1) return "Every week";
    const mask = r.weeks_mask ?? 1;
    const letters: string[] = [];
    for (let i = 0; i < cycle; i++) if (mask & (1 << i)) letters.push(WEEK_LETTERS[i]);
    return `Week ${letters.join(", ")}`;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Availability</h1>
        <p className="text-muted-foreground">Set the hours patients can book — with an optional rotating schedule.</p>
      </div>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList>
          <TabsTrigger value="weekly">Weekly hours</TabsTrigger>
          <TabsTrigger value="oneoff">One-off dates</TabsTrigger>
          <TabsTrigger value="timeoff">Time off</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Repeat className="h-4 w-4" /> Rota cycle</CardTitle>
                  <CardDescription>Repeat weekly, fortnightly, or on a 4-week rota.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(cycleLength)} onValueChange={(v) => updateCycle(Number(v))}>
                    <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every week</SelectItem>
                      <SelectItem value="2">Every 2 weeks (A / B)</SelectItem>
                      <SelectItem value="4">4-week rota (A / B / C / D)</SelectItem>
                    </SelectContent>
                  </Select>
                  {cycleLength > 1 && (
                    <Badge variant="secondary">This week: {WEEK_LETTERS[thisWeekLetter]}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly grid</CardTitle>
              <CardDescription>Tap a cell to add a shift. Existing shifts show location and practitioner.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid" style={{ gridTemplateColumns: `70px repeat(7, minmax(90px, 1fr))` }}>
                  <div></div>
                  {DAYS_SHORT.map((d) => (
                    <div key={d} className="text-xs font-medium text-muted-foreground px-2 py-2 text-center">{d}</div>
                  ))}
                  {Array.from({ length: cycleLength }).map((_, weekIdx) => (
                    <FragmentRow
                      key={weekIdx}
                      weekLetter={WEEK_LETTERS[weekIdx]}
                      isCurrent={cycleLength > 1 && weekIdx === thisWeekLetter}
                      renderCell={(dow) => {
                        const cell = rulesFor(dow, weekIdx);
                        return (
                          <button
                            type="button"
                            onClick={() => (cell.length === 0 ? openAdd(dow, weekIdx) : openEdit(cell[0]))}
                            className="min-h-[72px] border rounded-md m-1 p-1.5 text-left hover:bg-muted/60 transition flex flex-col gap-1"
                          >
                            {cell.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Plus className="h-3 w-3" /> Add</span>
                            ) : (
                              cell.slice(0, 2).map((r) => (
                                <div key={r.id} className="text-[11px] leading-tight rounded bg-primary/10 text-foreground px-1.5 py-1">
                                  <div className="font-mono">{r.start_time.slice(0,5)}–{r.end_time.slice(0,5)}</div>
                                  {locName(r.location_id) && <div className="truncate text-muted-foreground">{locName(r.location_id)}</div>}
                                </div>
                              ))
                            )}
                            {cell.length > 2 && <div className="text-[10px] text-muted-foreground">+{cell.length - 2} more</div>}
                          </button>
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All shifts</CardTitle>
              <CardDescription>{rules.length} shift{rules.length === 1 ? "" : "s"} configured</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rules.length === 0 && <div className="text-sm text-muted-foreground">No shifts yet. Tap a cell above to add one.</div>}
              {rules
                .slice()
                .sort((a, b) => (DOW_ORDER.indexOf(a.day_of_week) - DOW_ORDER.indexOf(b.day_of_week)) || a.start_time.localeCompare(b.start_time))
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm">
                    <button className="text-left flex-1" onClick={() => openEdit(r)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{DAYS_SHORT[DOW_ORDER.indexOf(r.day_of_week)] ?? DAYS_SHORT[r.day_of_week]}</span>
                        <span className="font-mono">{r.start_time.slice(0,5)}–{r.end_time.slice(0,5)}</span>
                        <span className="text-muted-foreground">· every {r.slot_interval} min</span>
                        <Badge variant="outline">{weeksLabel(r)}</Badge>
                        {locName(r.location_id) && <Badge variant="secondary">{locName(r.location_id)}</Badge>}
                        {pracName(r.practitioner_id) && <Badge>{pracName(r.practitioner_id)}</Badge>}
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => removeRule(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oneoff">
          <Card>
            <CardHeader>
              <CardTitle>One-off dates</CardTitle>
              <CardDescription>Open extra slots on a specific date, on top of the weekly rota.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addOverride} className="grid gap-3 sm:grid-cols-2 md:grid-cols-6 md:items-end">
                <div><Label>Date</Label><Input type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} /></div>
                <div><Label>Start</Label><Input type="time" value={ovStart} onChange={(e) => setOvStart(e.target.value)} /></div>
                <div><Label>End</Label><Input type="time" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} /></div>
                <div><Label>Slot (min)</Label><Input type="number" min={5} step={5} value={ovInterval} onChange={(e) => setOvInterval(e.target.value)} /></div>
                <div>
                  <Label>Location</Label>
                  <Select value={ovLoc} onValueChange={setOvLoc}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any location</SelectItem>
                      {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit"><Plus className="h-4 w-4 mr-1" />Add</Button>
              </form>
              {overrides.length === 0 ? (
                <div className="text-sm text-muted-foreground">No one-off dates.</div>
              ) : (
                <div className="space-y-2">
                  {overrides.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{o.date}</span>
                        <span className="font-mono ml-3">{o.start_time.slice(0,5)}–{o.end_time.slice(0,5)}</span>
                        <span className="text-muted-foreground ml-3">every {o.slot_interval} min</span>
                        {locName(o.location_id) && <span className="ml-3 text-xs rounded bg-muted px-2 py-0.5">{locName(o.location_id)}</span>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeOverride(o.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeoff">
          <Card>
            <CardHeader>
              <CardTitle>Close a day</CardTitle>
              <CardDescription>Block a date so patients cannot book that day.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addBlock} className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 md:items-end">
                <div><Label>Date</Label><Input type="date" value={blDate} onChange={(e) => setBlDate(e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Reason (optional)</Label><Input value={blReason} onChange={(e) => setBlReason(e.target.value)} placeholder="Holiday, training…" /></div>
                <div>
                  <Label>Location</Label>
                  <Select value={blLoc} onValueChange={setBlLoc}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All locations</SelectItem>
                      {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" variant="destructive"><Plus className="h-4 w-4 mr-1" />Close</Button>
              </form>
              {blocked.length === 0 ? (
                <div className="text-sm text-muted-foreground">No closed dates.</div>
              ) : (
                <div className="space-y-2">
                  {blocked.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{b.date}</span>
                        {b.reason && <span className="text-muted-foreground ml-3">{b.reason}</span>}
                        <span className="ml-3 text-xs rounded bg-muted px-2 py-0.5">{locName(b.location_id) ?? "All locations"}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeBlock(b.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit shift" : "Add shift"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Day</Label>
                <Select value={String(form.day_of_week)} onValueChange={(v) => setForm({ ...form, day_of_week: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOW_ORDER.map((dow, i) => (
                      <SelectItem key={dow} value={String(dow)}>{DAYS_SHORT[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Slot length (min)</Label>
                <Input type="number" min={5} step={5} value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} />
              </div>
              <div>
                <Label>Start</Label>
                <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any location</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {practitioners.length > 0 && (
              <div>
                <Label>Practitioner</Label>
                <Select value={form.practitioner_id} onValueChange={(v) => setForm({ ...form, practitioner_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any practitioner</SelectItem>
                    {practitioners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {cycleLength > 1 && (
              <div>
                <Label>Applies on weeks</Label>
                <div className="flex gap-3 mt-1">
                  {Array.from({ length: cycleLength }).map((_, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.weeks[i]}
                        onCheckedChange={(v) => {
                          const w = [...form.weeks]; w[i] = !!v; setForm({ ...form, weeks: w });
                        }}
                      />
                      Week {WEEK_LETTERS[i]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={saveShift}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FragmentRow({ weekLetter, isCurrent, renderCell }: {
  weekLetter: string; isCurrent: boolean;
  renderCell: (dow: number) => React.ReactNode;
}) {
  return (
    <>
      <div className={"text-xs font-medium px-2 py-2 flex items-center " + (isCurrent ? "text-primary" : "text-muted-foreground")}>
        {weekLetter}{isCurrent && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
      </div>
      {DOW_ORDER.map((dow) => (
        <div key={dow}>{renderCell(dow)}</div>
      ))}
    </>
  );
}
