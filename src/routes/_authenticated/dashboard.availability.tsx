import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
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
} from "@/lib/availability.functions";
import { listMyLocations } from "@/lib/locations.functions";

export const Route = createFileRoute("/_authenticated/dashboard/availability")({
  ssr: false,
  component: AvailabilityPage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Rule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_interval: number;
  location_id: string | null;
};

type Location = { id: string; name: string };

type Override = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  slot_interval: number;
  location_id: string | null;
};
type Blocked = { id: string; date: string; reason: string | null; location_id: string | null };

function AvailabilityPage() {
  const list = useServerFn(listAvailabilityRules);
  const upsert = useServerFn(upsertAvailabilityRule);
  const del = useServerFn(deleteAvailabilityRule);
  const listLocs = useServerFn(listMyLocations);
  const listOv = useServerFn(listAvailabilityOverrides);
  const addOv = useServerFn(addAvailabilityOverride);
  const delOv = useServerFn(deleteAvailabilityOverride);
  const listBl = useServerFn(listBlockedDates);
  const addBl = useServerFn(addBlockedDate);
  const delBl = useServerFn(deleteBlockedDate);

  const [rules, setRules] = useState<Rule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [interval, setInterval] = useState("30");
  const [locationId, setLocationId] = useState<string>("none");

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
    setLoading(true);
    try {
      const [r, l, o, b] = await Promise.all([list(), listLocs(), listOv(), listBl()]);
      setRules(r as Rule[]);
      setLocations(l as Location[]);
      setOverrides(o as Override[]);
      setBlocked(b as Blocked[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);


  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (start >= end) {
      toast.error("End time must be after start");
      return;
    }
    try {
      await upsert({
        data: {
          day_of_week: Number(day),
          start_time: start,
          end_time: end,
          slot_interval: Number(interval),
          location_id: locationId === "none" ? null : locationId,
        },
      });
      toast.success("Slot added");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  async function removeRule(id: string) {
    try {
      await del({ data: { id } });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  const grouped = DAYS.map((label, i) => ({
    label,
    day: i,
    rules: rules.filter((r) => r.day_of_week === i),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Availability</h1>
        <p className="text-muted-foreground">Set the weekly hours patients can book.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a slot</CardTitle>
          <CardDescription>Repeat weekly on the chosen day.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addRule} className="grid gap-3 sm:grid-cols-2 md:grid-cols-6 md:items-end">
            <div className="md:col-span-1">
              <Label>Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <Label>Slot (min)</Label>
              <Input type="number" min={5} step={5} value={interval} onChange={(e) => setInterval(e.target.value)} />
            </div>
            <div className="md:col-span-1">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any location</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="md:col-span-1"><Plus className="h-4 w-4 mr-1" />Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>{loading ? "Loading…" : `${rules.length} slot${rules.length === 1 ? "" : "s"}`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {grouped.map((g) => (
            <div key={g.day} className="border-b pb-3 last:border-0">
              <div className="font-medium mb-2">{g.label}</div>
              {g.rules.length === 0 ? (
                <div className="text-sm text-muted-foreground">No slots</div>
              ) : (
                <div className="space-y-2">
                  {g.rules.map((r) => {
                    const loc = locations.find((l) => l.id === r.location_id);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm">
                        <div>
                          <span className="font-mono">{r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</span>
                          <span className="text-muted-foreground ml-3">every {r.slot_interval} min</span>
                          {loc && <span className="ml-3 text-xs rounded bg-muted px-2 py-0.5">{loc.name}</span>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeRule(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
