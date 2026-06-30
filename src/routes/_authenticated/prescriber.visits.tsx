import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listMyPrescriberVisits,
  setVisitConfirmation,
  listMyConnectedPractitioners,
  requestClinicVisitAsPrescriber,
} from "@/lib/clinic-visits.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prescriber/visits")({
  ssr: false,
  component: PrescriberVisits,
});

function PrescriberVisits() {
  const fetchVisits = useServerFn(listMyPrescriberVisits);
  const fetchPracts = useServerFn(listMyConnectedPractitioners);
  const confirm = useServerFn(setVisitConfirmation);
  const requestVisit = useServerFn(requestClinicVisitAsPrescriber);

  const q = useQuery({ queryKey: ["my-prescriber-visits"], queryFn: () => fetchVisits() });
  const pq = useQuery({ queryKey: ["my-connected-practitioners"], queryFn: () => fetchPracts() });
  const list = q.data ?? [];
  const practs = pq.data ?? [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    practitioner_profile_id: "",
    location_id: "",
    visit_date: "",
    start_time: "09:00",
    end_time: "17:00",
    capacity: 8,
    notes: "",
  });

  const selectedPract = practs.find((p) => p.profile_id === form.practitioner_profile_id);

  async function submit() {
    if (!form.practitioner_profile_id || !form.visit_date) {
      toast.error("Pick a practitioner and date");
      return;
    }
    try {
      await requestVisit({
        data: {
          practitioner_profile_id: form.practitioner_profile_id,
          location_id: form.location_id || null,
          visit_date: form.visit_date,
          start_time: form.start_time,
          end_time: form.end_time,
          capacity: Number(form.capacity) || 1,
          notes: form.notes || null,
        },
      });
      toast.success("Request sent to practitioner for approval");
      setOpen(false);
      setForm({ ...form, visit_date: "", notes: "" });
      q.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">Clinic visits</h2>
          <p className="text-sm text-muted-foreground">
            Upcoming days at connected clinics, plus any requests awaiting approval.
          </p>
        </div>
        <Button onClick={() => setOpen((o) => !o)} disabled={practs.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Request a clinic day
        </Button>
      </div>

      {practs.length === 0 && (
        <Card className="border-amber-300/60 bg-amber-50/40">
          <CardContent className="p-4 text-sm">
            Connect with a practitioner first via the Prescriber Hub Connections page.
          </CardContent>
        </Card>
      )}

      {open && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">Request a clinic day</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Practitioner / clinic</Label>
                <Select
                  value={form.practitioner_profile_id}
                  onValueChange={(v) =>
                    setForm({ ...form, practitioner_profile_id: v, location_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {practs.map((p) => (
                      <SelectItem key={p.profile_id} value={p.profile_id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPract && selectedPract.locations.length > 0 && (
                <div>
                  <Label className="text-xs">Location (optional)</Label>
                  <Select
                    value={form.location_id}
                    onValueChange={(v) => setForm({ ...form, location_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedPract.locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={form.visit_date}
                  onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Capacity (max patients)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Notes for the practitioner</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit}>
                Send request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!q.isLoading && list.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-60" />
            No clinic visits scheduled.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {list.map((v) => {
          const booked = v.bookings.filter((b) => b.status !== "declined").length;
          const addr = [v.address_line1, v.city, v.postcode].filter(Boolean).join(", ");
          const pending = v.status === "pending_approval";
          return (
            <Card key={v.visit_id} className={v.status === "cancelled" ? "opacity-60" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {formatDate(v.visit_date)} · {v.start_time.slice(0, 5)}–
                        {v.end_time.slice(0, 5)}
                      </p>
                      {pending ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          Awaiting practitioner approval
                        </Badge>
                      ) : v.confirmed_by_prescriber ? (
                        <Badge className="bg-emerald-600">Confirmed</Badge>
                      ) : (
                        <Badge variant="outline">Not confirmed</Badge>
                      )}
                      {v.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                    </div>
                    <p className="mt-1 text-sm">
                      <span className="font-medium">{v.clinic_name ?? "Clinic"}</span>
                      {v.location_name ? ` · ${v.location_name}` : ""}
                    </p>
                    {addr && (
                      <p className="text-xs text-muted-foreground">
                        <MapPin className="mr-1 inline h-3 w-3" />
                        {addr}
                      </p>
                    )}
                    {v.notes && <p className="mt-1 text-xs italic">{v.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-4 w-4 opacity-60" />
                      <span className="font-medium">
                        {booked}/{v.capacity}
                      </span>
                      <span className="text-muted-foreground">booked</span>
                    </div>
                    {!pending && v.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant={v.confirmed_by_prescriber ? "ghost" : "default"}
                        onClick={async () => {
                          await confirm({
                            data: { id: v.visit_id, confirmed: !v.confirmed_by_prescriber },
                          });
                          toast.success(
                            v.confirmed_by_prescriber ? "Marked unconfirmed" : "Visit confirmed",
                          );
                          q.refetch();
                        }}
                      >
                        {v.confirmed_by_prescriber ? "Unconfirm" : "Confirm"}
                      </Button>
                    )}
                  </div>
                </div>

                {v.bookings.length > 0 && (
                  <div className="rounded-md bg-muted/40 p-2 text-xs">
                    <p className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">
                      Patients booked in
                    </p>
                    <ul className="space-y-0.5">
                      {v.bookings.map((b) => (
                        <li
                          key={b.referral_id}
                          className="flex items-center justify-between"
                        >
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
