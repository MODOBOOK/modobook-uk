import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listMyClinicVisits,
  upsertClinicVisit,
  cancelClinicVisit,
  approveClinicVisitRequest,
  declineClinicVisitRequest,
} from "@/lib/clinic-visits.functions";
import { listMyConnectedPrescribers } from "@/lib/prescriber.functions";
import { listMyLocations } from "@/lib/locations.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Plus, X, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hub/visits")({
  ssr: false,
  component: HubVisits,
});

type Visit = Awaited<ReturnType<typeof listMyClinicVisits>>[number];

function HubVisits() {
  const fetchVisits = useServerFn(listMyClinicVisits);
  const fetchPrescribers = useServerFn(listMyConnectedPrescribers);
  const fetchLocations = useServerFn(listMyLocations);
  const save = useServerFn(upsertClinicVisit);
  const cancel = useServerFn(cancelClinicVisit);
  const approve = useServerFn(approveClinicVisitRequest);
  const decline = useServerFn(declineClinicVisitRequest);

  const visits = useQuery({ queryKey: ["hub-visits"], queryFn: () => fetchVisits() });
  const prescribers = useQuery({ queryKey: ["hub-prescribers"], queryFn: () => fetchPrescribers() });
  const locations = useQuery({ queryKey: ["hub-locations"], queryFn: () => fetchLocations() });

  const [editing, setEditing] = useState<Visit | "new" | null>(null);

  const list = visits.data ?? [];
  const presList = prescribers.data ?? [];
  const locList = locations.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-serif text-xl">Prescriber clinic days</h2>
          <p className="text-sm text-muted-foreground">
            Request the dates you'd like a prescriber at your clinic. They'll confirm from their end,
            and patients booking POM treatments can then pick one of these slots.
          </p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          disabled={presList.length === 0}
          className="shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" /> Request a day
        </Button>
      </div>

      {presList.length === 0 && (
        <Card className="border-amber-300/60 bg-amber-50/40">
          <CardContent className="p-4 text-sm">
            Connect with an approved prescriber first.{" "}
            <Link to="/hub/connections" className="font-medium underline">
              Go to Connections
            </Link>
          </CardContent>
        </Card>
      )}

      {visits.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!visits.isLoading && list.length === 0 && presList.length > 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-60" />
            No clinic visits scheduled yet.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {list.map((v) => {
          const booked = v.bookings.filter((b) => b.status !== "declined").length;
          const isCancelled = v.status === "cancelled";
          return (
            <Card key={v.id} className={isCancelled ? "opacity-60" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {formatDate(v.visit_date)} · {formatTime(v.start_time)}–{formatTime(v.end_time)}
                      </p>
                      {v.status === "pending_approval" ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          Requested by prescriber — needs your approval
                        </Badge>
                      ) : v.confirmed_by_prescriber ? (
                        <Badge variant="default" className="bg-emerald-600">Confirmed</Badge>
                      ) : (
                        <Badge variant="outline">Awaiting confirmation</Badge>
                      )}
                      {isCancelled && <Badge variant="destructive">Cancelled</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Prescriber:{" "}
                      <span className="font-medium text-foreground">{v.prescriber_name}</span>
                      {v.prescriber_regulatory_body ? ` · ${v.prescriber_regulatory_body}` : ""}
                    </p>
                    {v.location_name && (
                      <p className="text-xs text-muted-foreground">
                        <MapPin className="mr-1 inline h-3 w-3" />
                        {v.location_name}
                      </p>
                    )}
                    {v.notes && <p className="mt-1 text-xs italic">{v.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-4 w-4 opacity-60" />
                      <span className="font-medium">
                        {booked}/{v.capacity}
                      </span>
                      <span className="text-muted-foreground">booked</span>
                    </div>
                    {v.status === "pending_approval" ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={async () => {
                            await approve({ data: { id: v.id } });
                            toast.success("Visit approved — patients can now book");
                            visits.refetch();
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm("Decline this request?")) return;
                            await decline({ data: { id: v.id } });
                            toast.success("Request declined");
                            visits.refetch();
                          }}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : !isCancelled && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm("Cancel this visit? Booked patients will be flagged.")) return;
                            await cancel({ data: { id: v.id } });
                            toast.success("Visit cancelled");
                            visits.refetch();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>


                {v.bookings.length > 0 && (
                  <div className="rounded-md bg-muted/40 p-2 text-xs">
                    <p className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">
                      Booked patients
                    </p>
                    <ul className="space-y-0.5">
                      {v.bookings.map((b) => (
                        <li key={b.id} className="flex items-center justify-between">
                          <span>{b.patient_name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {b.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing !== null && (
        <VisitEditor
          visit={editing === "new" ? null : editing}
          prescribers={presList}
          locations={locList.map((l) => ({ id: l.id, name: l.name }))}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await save({ data: payload });
            toast.success("Visit saved");
            setEditing(null);
            visits.refetch();
          }}
        />
      )}
    </div>
  );
}

function VisitEditor({
  visit,
  prescribers,
  locations,
  onClose,
  onSave,
}: {
  visit: Visit | null;
  prescribers: { user_id: string; name: string; regulatory_body: string | null }[];
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSave: (p: {
    id: string | null;
    prescriber_user_id: string;
    location_id: string | null;
    visit_date: string;
    start_time: string;
    end_time: string;
    capacity: number;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [prescriberId, setPrescriberId] = useState(visit?.prescriber_user_id ?? prescribers[0]?.user_id ?? "");
  const [locationId, setLocationId] = useState(visit?.location_id ?? "");
  const [date, setDate] = useState(visit?.visit_date ?? new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState((visit?.start_time ?? "09:00").slice(0, 5));
  const [end, setEnd] = useState((visit?.end_time ?? "17:00").slice(0, 5));
  const [capacity, setCapacity] = useState(visit?.capacity ?? 8);
  const [notes, setNotes] = useState(visit?.notes ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg">{visit ? "Edit visit" : "Schedule a visit"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Prescriber</Label>
            <Select value={prescriberId} onValueChange={setPrescriberId}>
              <SelectTrigger><SelectValue placeholder="Pick a prescriber" /></SelectTrigger>
              <SelectContent>
                {prescribers.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.name}
                    {p.regulatory_body ? ` · ${p.regulatory_body}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {locations.length > 0 && (
            <div>
              <Label>Location (optional)</Label>
              <Select value={locationId || "_none"} onValueChange={(v) => setLocationId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No specific location</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Capacity (patients)</Label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the prescriber should know about this visit."
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!prescriberId || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  id: visit?.id ?? null,
                  prescriber_user_id: prescriberId,
                  location_id: locationId || null,
                  visit_date: date,
                  start_time: start,
                  end_time: end,
                  capacity,
                  notes: notes.trim() || null,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function formatTime(t: string) {
  return t.slice(0, 5);
}
