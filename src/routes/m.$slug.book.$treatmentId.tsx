import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBookingContext, getDayAvailability, requestBooking } from "@/lib/public-booking.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
type Rule = Database["public"]["Tables"]["availability_rules"]["Row"];
type Loc = Database["public"]["Tables"]["locations"]["Row"];

export const Route = createFileRoute("/m/$slug/book/$treatmentId")({
  loader: ({ params }) => getBookingContext({ data: { slug: params.slug, treatmentId: params.treatmentId } }),
  component: BookTreatmentPage,
});

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(min: number) {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
}
function fmt(t: string) {
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

function BookTreatmentPage() {
  const { slug } = useParams({ from: "/m/$slug/book/$treatmentId" });
  const ctx = Route.useLoaderData();
  const treatment = ctx.treatment;
  const duration = treatment.duration ?? 30;
  const price = Number(treatment.price ?? 0);

  const [locationId, setLocationId] = useState<string | null>(
    ctx.locations[0]?.id ?? null,
  );
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const dayFn = useServerFn(getDayAvailability);
  const reqFn = useServerFn(requestBooking);

  const dow = useMemo(() => {
    // Convert YYYY-MM-DD to weekday (0=Sun..6=Sat) without timezone drift
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }, [date]);

  const dayRules = useMemo(
    () =>
      ctx.rules.filter(
        (r) =>
          r.day_of_week === dow &&
          (!locationId || !r.location_id || r.location_id === locationId),
      ),
    [ctx.rules, dow, locationId],
  );

  const dayQuery = useQuery({
    queryKey: ["dayAvail", ctx.profileId, date, locationId],
    queryFn: () => dayFn({ data: { profileId: ctx.profileId, date, locationId } }),
  });

  const slots = useMemo(() => {
    if (!dayQuery.data || dayQuery.data.isBlocked) return [];
    const busy = dayQuery.data.busy.map((b) => ({
      start: toMinutes(b.start_time),
      end: toMinutes(b.end_time),
      locId: b.location_id,
    }));
    const out: string[] = [];
    for (const r of dayRules) {
      const step = r.slot_interval ?? duration;
      const start = toMinutes(r.start_time);
      const end = toMinutes(r.end_time);
      for (let t = start; t + duration <= end; t += step) {
        const slotEnd = t + duration;
        const overlap = busy.some(
          (b) =>
            (!locationId || !b.locId || b.locId === locationId) &&
            t < b.end &&
            slotEnd > b.start,
        );
        if (!overlap) out.push(fromMinutes(t));
      }
    }
    return Array.from(new Set(out)).sort();
  }, [dayQuery.data, dayRules, duration, locationId]);

  async function submit() {
    if (!slot || !form.name || !form.email) {
      toast.error("Please fill name, email and pick a time slot");
      return;
    }
    setSubmitting(true);
    try {
      const endMin = toMinutes(slot) + duration;
      const res = await reqFn({
        data: {
          profileId: ctx.profileId,
          treatmentId: treatment.id,
          locationId,
          date,
          startTime: slot,
          endTime: fromMinutes(endMin),
          patientName: form.name,
          patientEmail: form.email,
          patientPhone: form.phone || undefined,
          notes: form.notes || undefined,
          basePrice: price,
        },
      });
      setConfirmed({ id: res.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
        <h1 className="text-2xl font-bold">Booking requested</h1>
        <p className="mt-2 text-muted-foreground">
          {ctx.clinicName} will confirm your appointment by email shortly.
        </p>
        <div className="mt-6">
          <Link to="/m/$slug" params={{ slug }}>
            <Button variant="outline">Back to clinic</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link to="/m/$slug" params={{ slug }} className="text-sm text-muted-foreground hover:underline">
          ← Back to {ctx.clinicName}
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{treatment.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" /> {duration} min
          </span>
          <Badge variant="secondary">£{price.toFixed(2)}</Badge>
        </CardContent>
      </Card>

      {ctx.locations.length > 1 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ctx.locations.map((l) => (
              <Button
                key={l.id}
                variant={locationId === l.id ? "default" : "outline"}
                size="sm"
                onClick={() => setLocationId(l.id)}
              >
                <MapPin className="mr-1 h-4 w-4" />
                {l.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Pick a date & time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlot(null);
              }}
            />
          </div>

          <div>
            <Label>Available times</Label>
            {dayQuery.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : dayQuery.data?.isBlocked ? (
              <p className="mt-2 text-sm text-muted-foreground">This date is unavailable.</p>
            ) : slots.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No slots available. The practitioner hasn't set hours for this day, or all times are booked.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <Button
                    key={s}
                    variant={slot === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSlot(s)}
                  >
                    {fmt(s)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" disabled={!slot || submitting} onClick={submit}>
        {submitting ? "Requesting…" : "Request booking"}
      </Button>
    </main>
  );
}
