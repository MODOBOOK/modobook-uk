import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/profiles.functions";
import { createAppointmentForPatient } from "@/lib/appointments.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrPostcode, setAddrPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Start time *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
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
