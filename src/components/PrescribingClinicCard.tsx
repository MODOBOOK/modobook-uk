import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listMyClinicVisits,
  upsertClinicVisit,
  cancelClinicVisit,
} from "@/lib/clinic-visits.functions";
import { listMyConnectedPrescribers } from "@/lib/prescriber.functions";
import { listMyLocations } from "@/lib/locations.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, MapPin, Plus, Stethoscope, Users, X } from "lucide-react";

type Visit = Awaited<ReturnType<typeof listMyClinicVisits>>[number];

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function PrescribingClinicCard() {
  const fetchVisits = useServerFn(listMyClinicVisits);
  const fetchPrescribers = useServerFn(listMyConnectedPrescribers);
  const fetchLocations = useServerFn(listMyLocations);
  const save = useServerFn(upsertClinicVisit);
  const cancel = useServerFn(cancelClinicVisit);

  const visits = useQuery({ queryKey: ["services-clinic-visits"], queryFn: () => fetchVisits() });
  const prescribers = useQuery({
    queryKey: ["services-prescribers"],
    queryFn: () => fetchPrescribers(),
  });
  const locations = useQuery({ queryKey: ["services-locations"], queryFn: () => fetchLocations() });

  const [editing, setEditing] = useState<Visit | "new" | null>(null);

  const list = (visits.data ?? []).filter((v) => v.status !== "cancelled");
  const presList = prescribers.data ?? [];
  const locList = (locations.data ?? []) as { id: string; name: string }[];

  return (
    <Card className="min-w-0 max-w-full overflow-hidden rounded-2xl sm:rounded-3xl">
      <CardContent className="min-w-0 space-y-3 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <h2 className="flex min-w-0 items-center gap-2 font-semibold">
              <Stethoscope className="h-4 w-4 shrink-0" /> <span className="truncate">Prescribing clinic</span>
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Dates and times your prescriber is in clinic. These show as their own category on your
              booking page.
            </p>
          </div>
          <Button
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setEditing("new")}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add date
          </Button>
        </div>

        {list.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No prescribing clinic dates yet.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((v) => {
              const booked = v.bookings.filter((b) => b.status !== "declined").length;
              return (
                <div
                  key={v.id}
                  className="grid min-w-0 grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                >
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
                      <span className="truncate">{fmtDate(v.visit_date)} · {v.start_time.slice(0, 5)}–{v.end_time.slice(0, 5)}</span>
                      {v.status === "pending_approval" && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          Needs approval
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.prescriber_name}
                      {(v as { price?: number | null }).price != null && (
                        <> · £{Number((v as { price?: number | null }).price).toFixed(2)}</>
                      )}
                      {v.location_name ? ` · ` : ""}
                      {v.location_name && (
                        <>
                          <MapPin className="inline h-3 w-3" /> {v.location_name}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1 sm:gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {booked}/{v.capacity}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const series = (v as { recurrence_group?: string | null }).recurrence_group;
                        if (!confirm("Cancel this prescribing clinic date?")) return;
                        const whole =
                          !!series &&
                          confirm("This date repeats. Cancel the whole repeating series? (Cancel = this date only)");
                        await cancel({ data: { id: v.id, whole_series: whole } });
                        toast.success("Date cancelled");
                        visits.refetch();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="break-words text-xs leading-relaxed text-muted-foreground">
          Manage bookings and prescriber confirmations in{" "}
          <Link to="/hub/visits" className="underline">
            Prescriber clinic days
          </Link>
          .
        </p>
      </CardContent>

      {editing !== null && (
        <VisitDialog
          visit={editing === "new" ? null : editing}
          prescribers={presList}
          locations={locList}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            try {
              await save({ data: payload });
              toast.success("Prescribing clinic date saved");
              setEditing(null);
              visits.refetch();
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </Card>
  );
}

function VisitDialog({
  visit,
  prescribers,
  locations,
  onClose,
  onSave,
}: {
  visit: Visit | null;
  prescribers: { user_id: string; name: string }[];
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSave: (payload: {
    id?: string | null;
    prescriber_user_id: string | null;
    prescriber_label: string | null;
    location_id: string | null;
    visit_date: string;
    start_time: string;
    end_time: string;
    capacity: number;
    notes: string | null;
    price: number | null;
    payment_mode: "full" | "pay_in_clinic";
    repeat_every_days: number;
    repeat_until: string | null;
  }) => Promise<void>;
}) {
  const [prescriberId, setPrescriberId] = useState<string>(
    visit?.prescriber_user_id ?? "none",
  );
  const [prescriberLabel, setPrescriberLabel] = useState(
    (visit as { prescriber_label?: string | null } | null)?.prescriber_label ?? "",
  );
  const [locationId, setLocationId] = useState<string>(visit?.location_id ?? "none");
  const [date, setDate] = useState(visit?.visit_date ?? "");
  const [start, setStart] = useState((visit?.start_time ?? "10:00").slice(0, 5));
  const [end, setEnd] = useState((visit?.end_time ?? "16:00").slice(0, 5));
  const [capacity, setCapacity] = useState(String(visit?.capacity ?? 8));
  const [notes, setNotes] = useState(visit?.notes ?? "");
  const [price, setPrice] = useState(
    (visit as { price?: number | null } | null)?.price != null
      ? String((visit as { price?: number | null }).price)
      : "",
  );
  const [paymentMode, setPaymentMode] = useState<"full" | "pay_in_clinic">("full");
  const [repeat, setRepeat] = useState("0");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{visit ? "Edit" : "Add"} prescribing clinic date</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Prescriber</Label>
            <Select value={prescriberId} onValueChange={setPrescriberId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose prescriber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked prescriber</SelectItem>
                {prescribers.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {prescriberId === "none" && (
              <>
                <Input
                  value={prescriberLabel}
                  onChange={(e) => setPrescriberLabel(e.target.value)}
                  placeholder="Prescriber name (optional, shown to patients)"
                />
                <p className="text-xs text-muted-foreground">
                  This date is set by you — no prescriber account needed or confirmation required.
                </p>
              </>
            )}
          </div>

          {locations.length > 0 && (
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All locations</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label>Start</Label>
              <Input className="w-full" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label>End</Label>
              <Input className="w-full" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5 min-w-0 col-span-2 sm:col-span-1">
              <Label>Spaces</Label>
              <Input
                className="w-full"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Price (£)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 25.00"
            />
            <p className="text-xs text-muted-foreground">
              Setting a price creates a bookable “Prescribing clinic” treatment in its own category
              on your booking page. Patients pick their clinic day at checkout.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Payment</Label>
            <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as "full" | "pay_in_clinic")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Pay in full at booking</SelectItem>
                <SelectItem value="pay_in_clinic">Pay on the day (in clinic)</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {!visit && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Repeat</Label>
                <Select value={repeat} onValueChange={setRepeat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Does not repeat</SelectItem>
                    <SelectItem value="7">Every week</SelectItem>
                    <SelectItem value="14">Every 2 weeks</SelectItem>
                    <SelectItem value="21">Every 3 weeks</SelectItem>
                    <SelectItem value="28">Every 4 weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Repeat until</Label>
                <Input
                  type="date"
                  value={repeatUntil}
                  disabled={repeat === "0"}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                />
              </div>
            </div>
          )}


          <div className="space-y-1.5">
            <Label>Notes (shown to patients)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Prescriber on site for POM treatments"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || !date}
            onClick={async () => {
              setSaving(true);
              await onSave({
                id: visit?.id ?? null,
                prescriber_user_id: prescriberId === "none" ? null : prescriberId,
                prescriber_label: prescriberLabel.trim() || null,
                location_id: locationId === "none" ? null : locationId,
                visit_date: date,
                start_time: start,
                end_time: end,
                capacity: Math.max(1, Number(capacity) || 1),
                notes: notes.trim() || null,
                price: price.trim() === "" ? null : Math.max(0, Number(price) || 0),
                payment_mode: paymentMode,
                repeat_every_days: Number(repeat) || 0,
                repeat_until: Number(repeat) > 0 && repeatUntil ? repeatUntil : null,
              });
              setSaving(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
