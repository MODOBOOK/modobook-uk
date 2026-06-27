import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBookingContext, getDayAvailability, getMonthAvailability, requestBooking } from "@/lib/public-booking.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Clock, MapPin, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
type Rule = Database["public"]["Tables"]["availability_rules"]["Row"];
type Loc = Database["public"]["Tables"]["locations"]["Row"];

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

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

  const theme = ctx.theme;
  const brand = theme?.primary_color || ctx.brandColor || "#1f2a44";
  const accent = theme?.accent_color || brand;
  const bgColor = theme?.background_color || "#ffffff";
  const textColor = theme?.text_color || "#0f172a";
  const headingFont = theme?.heading_font || "Inter";
  const bodyFont = theme?.body_font || "Inter";
  const pageStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: textColor,
    fontFamily: `${bodyFont}, system-ui, sans-serif`,
  };
  const headingStyle: React.CSSProperties = {
    fontFamily: `${headingFont}, ${bodyFont}, system-ui, sans-serif`,
    color: brand,
  };

  const [locationId, setLocationId] = useState<string | null>(
    ctx.locations[0]?.id ?? null,
  );

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);
  const [month, setMonth] = useState<Date>(new Date());
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<
    { id: string; consents: { token: string; consent_template_id: string }[] } | null
  >(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    country: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const dayFn = useServerFn(getDayAvailability);
  const monthFn = useServerFn(getMonthAvailability);
  const reqFn = useServerFn(requestBooking);

  const monthQuery = useQuery({
    queryKey: ["monthAvail", ctx.profileId, month.getFullYear(), month.getMonth() + 1, locationId],
    queryFn: () =>
      monthFn({
        data: {
          profileId: ctx.profileId,
          year: month.getFullYear(),
          month: month.getMonth() + 1,
          locationId,
        },
      }),
  });

  const isDateUnavailable = (d: Date) => {
    const iso = toIsoDate(d);
    const data = monthQuery.data;
    if (!data) return false;
    if (data.blockedDates.includes(iso)) return true;
    if (data.overrideDates.includes(iso)) return false;
    return !data.activeDays.includes(d.getDay());
  };


  const dow = useMemo(() => {
    // Convert YYYY-MM-DD to weekday (0=Sun..6=Sat) without timezone drift
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }, [date]);

  const dayRules = useMemo(
    () =>
      ctx.rules.filter(
        (r: Rule) =>
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
    const overrideRules = (dayQuery.data.overrides ?? []).filter(
      (o) => !locationId || !o.location_id || o.location_id === locationId,
    );
    const allRules: { start_time: string; end_time: string; slot_interval: number }[] = [
      ...dayRules.map((r: Rule) => ({ start_time: r.start_time, end_time: r.end_time, slot_interval: r.slot_interval })),
      ...overrideRules.map((o) => ({ start_time: o.start_time, end_time: o.end_time, slot_interval: o.slot_interval })),
    ];
    const out: string[] = [];
    for (const r of allRules) {
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
          patientDob: form.dob || null,
          patientAddress: {
            line1: form.addressLine1,
            line2: form.addressLine2,
            city: form.city,
            postcode: form.postcode,
            country: form.country,
          },
          notes: form.notes || undefined,
          basePrice: price,
        },
      });
      setConfirmed({ id: res.id, consents: res.consents ?? [] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <main className="min-h-screen" style={pageStyle}>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12" style={{ color: accent }} />
          <h1 className="text-2xl font-bold" style={headingStyle}>Booking confirmed</h1>
          <p className="mt-2 opacity-70">
            Your appointment with {ctx.clinicName} is confirmed. A confirmation
            email has been sent to {form.email}.
          </p>
          {confirmed.consents.length > 0 && (
            <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-left">
              <p className="text-sm font-semibold">Please complete your consent form(s):</p>
              <ul className="mt-2 space-y-2 text-sm">
                {confirmed.consents.map((c) => (
                  <li key={c.token}>
                    <a href={`${origin}/c/${c.token}`} className="underline" style={{ color: brand }}>
                      Complete consent form
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs opacity-70">
                We've also emailed these links to {form.email}.
              </p>
            </div>
          )}
          <div className="mt-6">
            <Link to="/m/$slug" params={{ slug }}>
              <Button variant="outline">Back to clinic</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen" style={pageStyle}>
      <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link to="/m/$slug" params={{ slug }} className="text-sm opacity-70 hover:underline">
          ← Back to {ctx.clinicName}
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle style={headingStyle}>{treatment.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 opacity-70">
            <Clock className="h-4 w-4" /> {duration} min
          </span>
          <Badge variant="secondary">£{price.toFixed(2)}</Badge>
        </CardContent>
      </Card>

      {ctx.locations.length > 1 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base" style={headingStyle}>Location</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ctx.locations.map((l: Loc) => {
              const selected = locationId === l.id;
              return (
                <Button
                  key={l.id}
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocationId(l.id)}
                  style={selected ? { backgroundColor: brand, borderColor: brand, color: "#fff" } : { color: brand, borderColor: `${brand}55` }}
                >
                  <MapPin className="mr-1 h-4 w-4" />
                  {l.name}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base" style={headingStyle}>Pick a date & time</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={fromIsoDate(date)}
              month={month}
              onMonthChange={setMonth}
              onSelect={(d) => {
                if (!d) return;
                setDate(toIsoDate(d));
                setSlot(null);
              }}
              disabled={(d) => {
                const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
                if (d < startOfToday) return true;
                return isDateUnavailable(d);
              }}
              weekStartsOn={1}
              className="pointer-events-auto rounded-md border p-3"
            />

          </div>

          <div>
            <Label className="mb-2 block text-sm font-semibold">Available times</Label>
            {dayQuery.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : dayQuery.data?.isBlocked ? (
              <p className="mt-2 text-sm text-muted-foreground">This date is unavailable.</p>
            ) : slots.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No slots available. Try another date.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
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
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" required value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </div>
          <div className="sm:col-span-2 pt-2 border-t mt-2">
            <Label className="text-sm font-semibold">Address</Label>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="line1">Address line 1</Label>
            <Input id="line1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="line2">Address line 2 (optional)</Label>
            <Input id="line2" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="postcode">Postcode</Label>
            <Input id="postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        size="lg"
        disabled={!slot || submitting || !form.name || !form.email || !form.phone || !form.dob}
        onClick={submit}
      >
        {submitting ? "Booking…" : "Confirm booking"}
      </Button>
    </main>
  );
}
