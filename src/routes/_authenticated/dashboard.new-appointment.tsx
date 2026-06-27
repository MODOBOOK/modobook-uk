import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profiles.functions";
import { createAppointmentForPatient } from "@/lib/appointments.functions";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/dashboard/new-appointment")({
  ssr: false,
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: NewAppointmentPage,
});

type Treatment = { id: string; name: string; price: number | null; duration: number | null };
type Location = { id: string; name: string };

function NewAppointmentPage() {
  const { profile } = Route.useLoaderData();
  const navigate = useNavigate();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [treatmentId, setTreatmentId] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrPostcode, setAddrPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendDeposit, setSendDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositHours, setDepositHours] = useState("24");
  const createLink = useServerFn(createPaymentLink);


  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from("treatments")
        .select("id,name,price,duration")
        .eq("profile_id", profile.id)
        .eq("active", true)
        .order("name");
      setTreatments(t ?? []);
      const { data: l } = await supabase
        .from("locations")
        .select("id,name")
        .eq("profile_id", profile.id)
        .eq("active", true);
      setLocations(l ?? []);
    })();
  }, [profile.id]);

  const treatment = treatments.find((t) => t.id === treatmentId);
  const duration = treatment?.duration ?? 30;

  // Recompute available slots when date/location/treatment changes
  useEffect(() => {
    if (!date) { setSlots([]); return; }
    (async () => {
      setLoadingSlots(true);
      try {
        const dow = new Date(date + "T00:00:00").getDay();
        const matchLoc = (rowLoc: string | null) => !locationId || !rowLoc || rowLoc === locationId;

        const [{ data: rules }, { data: overrides }, { data: blocked }, { data: blockedT }, { data: appts }] = await Promise.all([
          supabase.from("availability_rules").select("start_time,end_time,slot_interval,location_id,day_of_week").eq("profile_id", profile.id).eq("day_of_week", dow),
          supabase.from("availability_overrides").select("start_time,end_time,slot_interval,location_id").eq("profile_id", profile.id).eq("date", date),
          supabase.from("blocked_dates").select("location_id").eq("profile_id", profile.id).eq("date", date),
          supabase.from("blocked_times").select("start_time,end_time,location_id").eq("profile_id", profile.id).eq("date", date),
          supabase.from("appointments").select("start_time,end_time,location_id,status").eq("profile_id", profile.id).eq("scheduled_date", date).neq("status", "cancelled"),
        ]);

        const isBlocked = (blocked ?? []).some((b) => matchLoc(b.location_id));
        if (isBlocked) { setSlots([]); return; }

        const windows = [
          ...(rules ?? []).filter((r) => matchLoc(r.location_id)),
          ...(overrides ?? []).filter((o) => matchLoc(o.location_id)),
        ];
        const busy = [
          ...(appts ?? []).filter((a) => matchLoc(a.location_id)),
          ...(blockedT ?? []).filter((b) => matchLoc(b.location_id)).map((b) => ({ start_time: b.start_time, end_time: b.end_time, location_id: b.location_id })),
        ];


        const toMin = (t: string) => {
          const [h, m] = t.split(":").map(Number); return h * 60 + m;
        };
        const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

        const candidates = new Set<string>();
        for (const w of windows) {
          const interval = w.slot_interval ?? 30;
          const s = toMin(w.start_time); const e = toMin(w.end_time);
          for (let x = s; x + duration <= e; x += interval) candidates.add(fromMin(x));
        }

        const free = [...candidates].sort().filter((time) => {
          const s = toMin(time); const e = s + duration;
          return !busy.some((b) => {
            const bs = toMin(b.start_time); const be = toMin(b.end_time);
            return s < be && e > bs;
          });
        });
        setSlots(free);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [date, locationId, duration, profile.id]);

  function computeEnd(time: string, mins: number): string {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
  }


  async function submit() {
    if (!treatment || !date || !startTime || !patientName || !patientEmail) {
      toast.error("Fill in treatment, date, time, patient name and email");
      return;
    }
    setSaving(true);
    try {
      const result = await createAppointmentForPatient({
        data: {
          treatmentId,
          locationId: locationId || null,
          date,
          startTime: `${startTime}:00`,
          endTime: computeEnd(startTime, treatment.duration ?? 30),
          patientName,
          patientEmail,
          patientPhone: patientPhone || undefined,
          patientDob: patientDob || null,
          patientAddress: addrLine1 || addrCity || addrPostcode
            ? { line1: addrLine1, city: addrCity, postcode: addrPostcode }
            : null,
          notes: notes || undefined,
          basePrice: Number(treatment.price ?? 0),
        },
      });
      const manageUrl = result.manageToken
        ? `${window.location.origin}/m/${profile.slug}/manage/${result.manageToken}`
        : null;
      toast.success("Appointment created", {
        description: manageUrl
          ? "Patient can manage via the link copied to your clipboard."
          : "Confirmed.",
      });
      if (manageUrl && navigator.clipboard) {
        await navigator.clipboard.writeText(manageUrl);
      }
      navigate({ to: "/dashboard/bookings" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Book appointment for a patient</h1>
        <p className="text-sm text-muted-foreground">
          The patient will receive a confirmation email with consent forms and a link to manage their booking.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Treatment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Treatment *</Label>
            <Select value={treatmentId} onValueChange={setTreatmentId}>
              <SelectTrigger><SelectValue placeholder="Select treatment" /></SelectTrigger>
              <SelectContent>
                {treatments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — £{Number(t.price ?? 0).toFixed(2)} · {t.duration}min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {locations.length > 0 && (
            <div>
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setStartTime(""); }} />
          </div>
          {date && (
            <div>
              <Label>Available start times *</Label>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No available slots for this date{treatment ? "" : " (pick a treatment to filter by duration)"}.
                  You can still type a time manually below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={startTime === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStartTime(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Or set manually</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Patient details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Full name *</Label>
            <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input type="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Date of birth</Label>
            <Input type="date" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} />
          </div>
          <div>
            <Label>Address line 1</Label>
            <Input value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={addrPostcode} onChange={(e) => setAddrPostcode(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={saving} size="lg" className="w-full">
        {saving ? "Creating…" : "Create appointment"}
      </Button>
    </div>
  );
}
