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
import { Trash2, Plus, Repeat, CalendarDays, CalendarRange, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
  listBlockedTimes,
  addBlockedTime,
  deleteBlockedTime,
  getRotaSettings,
  setRotaAnchor,
  listPractitioners,
  endCurrentRota,
  deletePreviousRota,
} from "@/lib/availability.functions";
import { listMyLocations } from "@/lib/locations.functions";
import { WEEK_LETTERS, weekLetterFor, toMondayIso } from "@/lib/rota";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/availability")({
  ssr: false,
  component: AvailabilityPage,
});

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun mapped to JS DOW

/** Pick one, several, or all locations. Empty selection = applies to every location. */
function LocationPicker({
  locations,
  value,
  onChange,
  allLabel = "All locations",
}: {
  locations: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  allLabel?: string;
}) {
  if (locations.length === 0) return null;
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          "rounded-full border px-3 py-1 text-xs",
          value.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-background",
        )}
      >
        {allLabel}
      </button>
      {locations.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => toggle(l.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            value.includes(l.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background",
          )}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}


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
  effective_from?: string | null;
  effective_to?: string | null;
};
type Location = { id: string; name: string };
type Practitioner = { id: string; name: string };
type Override = {
  id: string; date: string; start_time: string; end_time: string;
  slot_interval: number; location_id: string | null;
};
type Blocked = { id: string; date: string; reason: string | null; location_id: string | null };
type BlockedTime = { id: string; date: string; start_time: string; end_time: string; reason: string | null; location_id: string | null };

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
  const listBlT = useServerFn(listBlockedTimes);
  const addBlT = useServerFn(addBlockedTime);
  const delBlT = useServerFn(deleteBlockedTime);
  const getRota = useServerFn(getRotaSettings);
  const setAnchor = useServerFn(setRotaAnchor);
  const endRota = useServerFn(endCurrentRota);
  const delPrevRota = useServerFn(deletePreviousRota);

  const [rules, setRules] = useState<Rule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [anchorDate, setAnchorDate] = useState<string | null>(null);

  const [cycleLength, setCycleLength] = useState<number>(1);

  // End-rota flow
  const [endOpen, setEndOpen] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [copyForward, setCopyForward] = useState(true);
  const [endingRota, setEndingRota] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    day_of_week: 1,
    start: "09:00",
    end: "17:00",
    interval: "30",
    location_ids: [] as string[],

    practitioner_id: "none",
    weeks: [true, false, false, false] as boolean[], // A,B,C,D
    effective_from: "",
    effective_to: "",
  });

  const today = new Date().toISOString().slice(0, 10);
  const [ovDate, setOvDate] = useState(today);
  const [ovStart, setOvStart] = useState("09:00");
  const [ovEnd, setOvEnd] = useState("13:00");
  const [ovInterval, setOvInterval] = useState("30");
  const [ovLocs, setOvLocs] = useState<string[]>([]);

  
  const [blReason, setBlReason] = useState("");
  const [blLocs, setBlLocs] = useState<string[]>([]);

  const [blMode, setBlMode] = useState<"days" | "range" | "weeks" | "time">("days");
  const [blDays, setBlDays] = useState<Date[]>([]);
  const [blRange, setBlRange] = useState<{ from?: Date; to?: Date }>({});
  const [blWeekDates, setBlWeekDates] = useState<Date[]>([]);
  const [blTimeDate, setBlTimeDate] = useState<Date | undefined>(new Date());
  const [blTimeStart, setBlTimeStart] = useState("09:00");
  const [blTimeEnd, setBlTimeEnd] = useState("12:00");
  const [savingBl, setSavingBl] = useState(false);

  async function refresh() {
    const [r, l, p, o, b, bt, rota] = await Promise.all([list(), listLocs(), listPracts(), listOv(), listBl(), listBlT(), getRota()]);
    setRules(r as Rule[]);
    setLocations(l as Location[]);
    setPractitioners(p as Practitioner[]);
    setOverrides(o as Override[]);
    setBlocked(b as Blocked[]);
    setBlockedTimes(bt as BlockedTime[]);
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

  function openEndRota() {
    const d = new Date();
    const iso = (dt: Date) => dt.toISOString().slice(0, 10);
    setEndDate(iso(d));
    const next = new Date(d); next.setDate(next.getDate() + 1);
    setNewStart(iso(next));
    setCopyForward(true);
    setEndOpen(true);
  }

  async function confirmEndRota() {
    if (!endDate) { toast.error("Pick an end date"); return; }
    if (newStart && newStart <= endDate) { toast.error("The new rota must start after the end date"); return; }
    setEndingRota(true);
    try {
      const res: any = await endRota({
        data: { end_date: endDate, new_start_date: newStart || null, copy: copyForward && !!newStart },
      });
      toast.success(
        res?.created
          ? `Rota ended — ${res.created} shift${res.created === 1 ? "" : "s"} copied into the new rota`
          : "Rota ended — add the shifts for your new rota",
      );
      setEndOpen(false);
      await refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
    finally { setEndingRota(false); }
  }

  async function removePreviousRota(endedOn: string) {
    if (!confirm("Delete this previous rota permanently?")) return;
    try { await delPrevRota({ data: { effective_to: endedOn } }); await refresh(); toast.success("Previous rota deleted"); }
    catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }



  function openAdd(day: number, weekIdx: number) {
    setEditing(null);
    const weeks = Array.from({ length: 4 }, (_, i) => i === weekIdx);
    setForm({
      day_of_week: day, start: "09:00", end: "17:00", interval: "30",
      location_ids: [], practitioner_id: "none", weeks,
      effective_from: "", effective_to: "",
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
      location_ids: r.location_id ? [r.location_id] : [],
      practitioner_id: r.practitioner_id ?? "none",
      weeks,
      effective_from: r.effective_from ?? "",
      effective_to: r.effective_to ?? "",
    });
    setDlgOpen(true);
  }

  async function saveShift() {
    if (form.start >= form.end) { toast.error("End time must be after start"); return; }
    if (form.effective_from && form.effective_to && form.effective_from > form.effective_to) {
      toast.error("Rota end date must be after the start date"); return;
    }
    let mask = 0;
    for (let i = 0; i < cycleLength; i++) if (form.weeks[i]) mask |= (1 << i);
    if (mask === 0) { toast.error("Pick at least one week"); return; }
    // Empty selection = every location (single row with location_id null).
    const targets: (string | null)[] = form.location_ids.length ? form.location_ids : [null];
    try {
      for (let i = 0; i < targets.length; i++) {
        await upsert({
          data: {
            // Only the first target reuses the row being edited; extra
            // locations become their own shift rows.
            id: i === 0 ? editing?.id : undefined,
            day_of_week: form.day_of_week,
            start_time: form.start,
            end_time: form.end,
            slot_interval: Number(form.interval),
            location_id: targets[i],
            practitioner_id: form.practitioner_id === "none" ? null : form.practitioner_id,
            cycle_length: cycleLength,
            weeks_mask: mask,
            effective_from: form.effective_from || null,
            effective_to: form.effective_to || null,
          },
        });
      }
      toast.success(editing ? "Shift updated" : "Shift added");
      setDlgOpen(false);
      await refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }


  async function removeRule(id: string) {
    if (!confirm("Delete this shift? Patients will no longer be able to book these hours.")) return;
    try { await del({ data: { id } }); await refresh(); toast.success("Shift deleted"); }
    catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }

  async function deleteEditing() {
    if (!editing) return;
    await removeRule(editing.id);
    setDlgOpen(false);
    setEditing(null);
  }

  async function addOverride(e: React.FormEvent) {
    e.preventDefault();
    if (ovStart >= ovEnd) { toast.error("End time must be after start"); return; }
    const targets: (string | null)[] = ovLocs.length ? ovLocs : [null];
    try {
      for (const loc of targets) {
        await addOv({ data: { date: ovDate, start_time: ovStart, end_time: ovEnd, slot_interval: Number(ovInterval), location_id: loc } });
      }
      toast.success("One-off slot added");
      await refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }

  async function removeOverride(id: string) {
    try { await delOv({ data: { id } }); await refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }
  function fmtISO(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  function expandRange(from: Date, to: Date): string[] {
    const out: string[] = [];
    const cur = new Date(from);
    while (cur <= to) { out.push(fmtISO(cur)); cur.setDate(cur.getDate() + 1); }
    return out;
  }
  function weekOf(d: Date): string[] {
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d); mon.setDate(mon.getDate() + diff);
    return expandRange(mon, new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6));
  }

  async function submitTimeOff() {
    // Empty selection = close every location; otherwise one row per chosen location.
    const targets: (string | null)[] = blLocs.length ? blLocs : [null];
    const reason = blReason || undefined;
    setSavingBl(true);
    try {
      if (blMode === "time") {
        if (!blTimeDate) { toast.error("Pick a date"); return; }
        if (blTimeStart >= blTimeEnd) { toast.error("End time must be after start"); return; }
        for (const locId of targets) {
          await addBlT({ data: { date: fmtISO(blTimeDate), start_time: blTimeStart, end_time: blTimeEnd, reason, location_id: locId } });
        }
        toast.success("Time block added");
      } else {
        let dates: string[] = [];
        if (blMode === "days") dates = blDays.map(fmtISO);
        else if (blMode === "range" && blRange.from && blRange.to) dates = expandRange(blRange.from, blRange.to);
        else if (blMode === "weeks") dates = Array.from(new Set(blWeekDates.flatMap(weekOf)));
        dates = Array.from(new Set(dates));
        if (dates.length === 0) { toast.error("Pick at least one date"); return; }
        let added = 0;
        for (const locId of targets) {
          const existing = new Set(blocked.filter((b) => (b.location_id ?? null) === (locId ?? null)).map((b) => b.date));
          const toAdd = dates.filter((d) => !existing.has(d));
          await Promise.all(toAdd.map((date) => addBl({ data: { date, reason, location_id: locId } })));
          added += toAdd.length;
        }
        if (added === 0) { toast.info("Those dates are already closed"); return; }
        toast.success(`${added} ${added === 1 ? "closure" : "closures"} added`);
      }
      setBlReason("");
      setBlDays([]); setBlRange({}); setBlWeekDates([]);
      await refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
    finally { setSavingBl(false); }
  }

  async function removeBlock(id: string) {
    try { await delBl({ data: { id } }); await refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }
  async function removeBlockTime(id: string) {
    try { await delBlT({ data: { id } }); await refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }

  // Only shifts that are still running (or start in the future) belong to the
  // live rota; anything with an end date in the past is a previous rota.
  const activeRules = useMemo(
    () => rules.filter((r) => !r.effective_to || r.effective_to >= today),
    [rules, today],
  );
  const previousRotas = useMemo(() => {
    const groups = new Map<string, Rule[]>();
    for (const r of rules) {
      if (r.effective_to && r.effective_to < today) {
        groups.set(r.effective_to, [...(groups.get(r.effective_to) ?? []), r]);
      }
    }
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rules, today]);

  // Group rules for grid rendering: [weekIdx][dow] -> Rule[]
  function rulesFor(day: number, weekIdx: number): Rule[] {
    return activeRules.filter((r) => {
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
          <Card className="border-primary/10 bg-gradient-to-br from-background to-muted/40">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" /> Rota cycle</CardTitle>
                  <CardDescription>Repeat weekly, fortnightly, or on a 4-week rota.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(cycleLength)} onValueChange={(v) => updateCycle(Number(v))}>
                    <SelectTrigger className="w-[220px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every week</SelectItem>
                      <SelectItem value="2">Every 2 weeks (A / B)</SelectItem>
                      <SelectItem value="4">4-week rota (A / B / C / D)</SelectItem>
                    </SelectContent>
                  </Select>
                  {cycleLength > 1 && (
                    <Badge variant="secondary" className="rounded-full">This week · {WEEK_LETTERS[thisWeekLetter]}</Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={openEndRota}>
                  <CalendarRange className="mr-2 h-4 w-4" /> End rota & start a new one
                </Button>
                {previousRotas.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setShowPrevious((v) => !v)}>
                    {showPrevious ? "Hide" : "Show"} previous rotas ({previousRotas.length})
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>

          {showPrevious && previousRotas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Previous rotas</CardTitle>
                <CardDescription>Archived shift patterns — kept for your records, not bookable.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {previousRotas.map(([endedOn, rs]) => (
                  <div key={endedOn} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        Ended {format(new Date(endedOn + "T00:00:00"), "d MMM yyyy")}
                        <span className="ml-2 text-xs text-muted-foreground">{rs.length} shift{rs.length === 1 ? "" : "s"}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removePreviousRota(endedOn)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {rs.map((r) => (
                        <div key={r.id} className="text-xs text-muted-foreground">
                          {DAYS_SHORT[DOW_ORDER.indexOf(r.day_of_week)]} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                          {locName(r.location_id) ? ` · ${locName(r.location_id)}` : ""}
                          {pracName(r.practitioner_id) ? ` · ${pracName(r.practitioner_id)}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Weekly schedule</CardTitle>
                  <CardDescription>Tap a cell to add or edit a shift.</CardDescription>
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {activeRules.length} shift{activeRules.length === 1 ? "" : "s"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-6">
              <div className="min-w-[720px]">
                <div className="grid gap-1" style={{ gridTemplateColumns: `56px repeat(7, minmax(90px, 1fr))` }}>
                  <div></div>
                  {DAYS_SHORT.map((d, i) => {
                    const isToday = new Date().getDay() === DOW_ORDER[i];
                    return (
                      <div key={d} className={"text-[11px] uppercase tracking-wider font-semibold px-2 py-2 text-center " + (isToday ? "text-primary" : "text-muted-foreground")}>
                        {d}
                      </div>
                    );
                  })}
                  {Array.from({ length: cycleLength }).map((_, weekIdx) => (
                    <FragmentRow
                      key={weekIdx}
                      weekLetter={WEEK_LETTERS[weekIdx]}
                      isCurrent={cycleLength > 1 && weekIdx === thisWeekLetter}
                      renderCell={(dow) => {
                        const cell = rulesFor(dow, weekIdx);
                        const isToday = new Date().getDay() === dow;
                        return (
                          <button
                            type="button"
                            onClick={() => (cell.length === 0 ? openAdd(dow, weekIdx) : openEdit(cell[0]))}
                            className={
                              "group relative min-h-[80px] w-full rounded-xl p-1.5 text-left transition-all flex flex-col gap-1 " +
                              (cell.length === 0
                                ? "border border-dashed border-border/70 hover:border-primary/50 hover:bg-primary/5"
                                : "border border-transparent bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-md hover:from-primary/15") +
                              (isToday ? " ring-1 ring-primary/30" : "")
                            }
                          >
                            {cell.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1 m-auto opacity-0 group-hover:opacity-100 transition">
                                <Plus className="h-3 w-3" /> Add
                              </span>
                            ) : (
                              cell.slice(0, 2).map((r) => (
                                <div key={r.id} className="text-[11px] leading-tight rounded-lg bg-background/80 backdrop-blur px-2 py-1.5 shadow-sm">
                                  <div className="font-mono font-medium tabular-nums">{r.start_time.slice(0,5)}–{r.end_time.slice(0,5)}</div>
                                  {locName(r.location_id) && (
                                    <div className="flex items-center gap-1 mt-0.5 text-muted-foreground truncate">
                                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                      <span className="truncate">{locName(r.location_id)}</span>
                                    </div>
                                  )}
                                  {(r.effective_from || r.effective_to) && (
                                    <div className="truncate text-[10px] text-muted-foreground/80">
                                      {r.effective_from ? `from ${r.effective_from.slice(5)}` : ""}
                                      {r.effective_to ? ` to ${r.effective_to.slice(5)}` : ""}
                                    </div>
                                  )}
                                  {pracName(r.practitioner_id) && (
                                    <div className="truncate text-[10px] text-muted-foreground/80">{pracName(r.practitioner_id)}</div>
                                  )}
                                </div>
                              ))
                            )}
                            {cell.length > 2 && <div className="text-[10px] text-muted-foreground pl-1">+{cell.length - 2} more</div>}
                            {cell.length > 0 && (
                              <span
                                role="button"
                                aria-label="Delete shift"
                                onClick={(e) => { e.stopPropagation(); removeRule(cell[0].id); }}
                                className="absolute top-1 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition p-1 rounded-md bg-background/70 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"

                              >
                                <Trash2 className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
              {activeRules.length === 0 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">No shifts yet — tap any cell to add your first.</div>
              )}
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
                {locations.length > 0 && (
                  <div className="md:col-span-2">
                    <Label>Locations</Label>
                    <LocationPicker
                      locations={locations}
                      value={ovLocs}
                      onChange={setOvLocs}
                      allLabel="Every location"
                    />
                  </div>
                )}

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

        <TabsContent value="timeoff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add time off</CardTitle>
              <CardDescription>Block days, ranges, whole weeks, or a portion of a single day.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { k: "days", label: "Days", icon: CalendarDays },
                  { k: "range", label: "Range", icon: CalendarRange },
                  { k: "weeks", label: "Weeks", icon: Repeat },
                  { k: "time", label: "Time block", icon: Clock },
                ] as const).map(({ k, label, icon: Icon }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBlMode(k)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      blMode === k
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border p-3 flex flex-col items-center bg-muted/20">
                {blMode === "days" && (
                  <>
                    <Calendar
                      mode="multiple"
                      selected={blDays}
                      onSelect={(dates) => setBlDays(dates ?? [])}
                      disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
                      className="pointer-events-auto"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {blDays.length === 0 ? "Tap days to select" : `${blDays.length} day${blDays.length === 1 ? "" : "s"} selected`}
                    </p>
                  </>
                )}
                {blMode === "range" && (
                  <>
                    <Calendar
                      mode="range"
                      selected={blRange as any}
                      onSelect={(r: any) => setBlRange(r ?? {})}
                      numberOfMonths={2}
                      disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
                      className="pointer-events-auto"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {blRange.from && blRange.to
                        ? `${format(blRange.from, "PP")} → ${format(blRange.to, "PP")}`
                        : "Pick a start and end date"}
                    </p>
                  </>
                )}
                {blMode === "weeks" && (
                  <>
                    <Calendar
                      mode="multiple"
                      selected={blWeekDates}
                      onSelect={(dates) => setBlWeekDates(dates ?? [])}
                      disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
                      showWeekNumber
                      className="pointer-events-auto"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Click any day to select its whole week (Mon–Sun). {blWeekDates.length > 0 && `${Array.from(new Set(blWeekDates.flatMap(weekOf))).length} days`}
                    </p>
                  </>
                )}
                {blMode === "time" && (
                  <div className="w-full grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-3 flex justify-center">
                      <Calendar
                        mode="single"
                        selected={blTimeDate}
                        onSelect={setBlTimeDate}
                        disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
                        className="pointer-events-auto"
                      />
                    </div>
                    <div><Label>Start</Label><Input type="time" value={blTimeStart} onChange={(e) => setBlTimeStart(e.target.value)} /></div>
                    <div><Label>End</Label><Input type="time" value={blTimeEnd} onChange={(e) => setBlTimeEnd(e.target.value)} /></div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Reason (optional)</Label>
                  <Input value={blReason} onChange={(e) => setBlReason(e.target.value)} placeholder="Holiday, training…" />
                </div>
                {locations.length > 0 && (
                  <div>
                    <Label>Locations</Label>
                    <LocationPicker
                      locations={locations}
                      value={blLocs}
                      onChange={setBlLocs}
                      allLabel="All locations"
                    />
                  </div>
                )}

              </div>
              <div className="flex justify-end">
                <Button onClick={submitTimeOff} disabled={savingBl} variant="destructive">
                  <Plus className="h-4 w-4 mr-1" />
                  {savingBl ? "Saving…" : "Add time off"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled time off</CardTitle>
              <CardDescription>Upcoming closures and time blocks.</CardDescription>
            </CardHeader>
            <CardContent>
              {blocked.length === 0 && blockedTimes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No time off scheduled.</div>
              ) : (
                <div className="space-y-2">
                  {blocked.map((b) => (
                    <div key={`d-${b.id}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm bg-gradient-to-br from-destructive/5 to-transparent">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CalendarDays className="h-4 w-4 text-destructive" />
                        <span className="font-medium">{format(new Date(b.date + "T00:00:00"), "EEE d MMM yyyy")}</span>
                        <Badge variant="outline" className="text-xs">All day</Badge>
                        {b.reason && <span className="text-muted-foreground">· {b.reason}</span>}
                        <span className="text-xs rounded-full bg-muted px-2 py-0.5">{locName(b.location_id) ?? "All locations"}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeBlock(b.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {blockedTimes.map((b) => (
                    <div key={`t-${b.id}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm bg-gradient-to-br from-destructive/5 to-transparent">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Clock className="h-4 w-4 text-destructive" />
                        <span className="font-medium">{format(new Date(b.date + "T00:00:00"), "EEE d MMM yyyy")}</span>
                        <Badge variant="outline" className="text-xs">{b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}</Badge>
                        {b.reason && <span className="text-muted-foreground">· {b.reason}</span>}
                        <span className="text-xs rounded-full bg-muted px-2 py-0.5">{locName(b.location_id) ?? "All locations"}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeBlockTime(b.id)}><Trash2 className="h-4 w-4" /></Button>
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
            {locations.length > 0 && (
              <div>
                <Label>Locations</Label>
                <p className="mb-1 text-xs text-muted-foreground">Pick one or several — this shift only opens at the locations you select.</p>
                <LocationPicker
                  locations={locations}
                  value={form.location_ids}
                  onChange={(v) => setForm({ ...form, location_ids: v })}
                  allLabel="Every location"
                />
              </div>
            )}

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rota starts</Label>
                <Input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                />
              </div>
              <div>
                <Label>Rota ends</Label>
                <Input
                  type="date"
                  value={form.effective_to}
                  onChange={(e) => setForm({ ...form, effective_to: e.target.value })}
                />
              </div>
              <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                Leave blank for no limit. Set an end date to finish a rota, then add a new shift starting the next day.
              </p>
            </div>
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
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={deleteEditing}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancel</Button>
              <Button onClick={saveShift}>Save</Button>
            </div>
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
