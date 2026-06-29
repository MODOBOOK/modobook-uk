import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBookingContext, getDayAvailability, getMonthAvailability, requestBooking } from "@/lib/public-booking.functions";
import { listAddonsForBooking, type PublicAddon } from "@/lib/addons.functions";
import { ensurePatient, getMyPatient } from "@/lib/patient.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Clock, MapPin, CheckCircle2, LogIn, UserPlus, UserCheck } from "lucide-react";
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
  const redirectPath = `/m/${slug}/book/${treatment.id}`;
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

  const modelSlotsAll = (ctx as { modelSlots?: Array<{ id: string; location_id: string | null; slot_date: string; start_time: string; end_time: string; price_mode: "fixed" | "percent"; price_value: number }> }).modelSlots ?? [];
  const modelMode = modelSlotsAll.length > 0;
  const modelSlotsForLoc = useMemo(
    () => modelSlotsAll.filter((s) => !locationId || !s.location_id || s.location_id === locationId),
    [modelSlotsAll, locationId],
  );
  const bookableFrom = (ctx as { bookableFrom?: string | null }).bookableFrom ?? null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = bookableFrom && bookableFrom > todayIso ? bookableFrom : todayIso;
  const firstModelDate = modelSlotsForLoc[0]?.slot_date ?? today;
  const [date, setDate] = useState<string>(modelMode ? firstModelDate : today);
  const [month, setMonth] = useState<Date>(modelMode ? fromIsoDate(firstModelDate) : fromIsoDate(today));

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
  const submitLockRef = useRef(false);
  const sessionCount = Math.max(1, Number((treatment as { session_count?: number }).session_count ?? 1));
  const splitAllowed = Boolean((treatment as { allow_split_payment?: boolean }).allow_split_payment) && sessionCount > 1;
  const [paymentPlan, setPaymentPlan] = useState<"full" | "split">("full");

  // Patient auth gate: 'pending' until they pick a path
  const [authChoice, setAuthChoice] = useState<"pending" | "guest" | "signed-in">("pending");
  const [patientUserId, setPatientUserId] = useState<string | null>(null);
  const ensure = useServerFn(ensurePatient);
  const fetchPatient = useServerFn(getMyPatient);

  // If the user is already signed in when arriving here, auto-skip the gate.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPatientUserId(data.session.user.id);
        setAuthChoice("signed-in");
        try {
          await ensure({ data: { fullName: data.session.user.email?.split("@")[0] ?? "Patient", linkSlug: slug } });
          const p = await fetchPatient();
          const pp = p.patient;
          if (pp) {
            setForm((f) => ({
              ...f,
              name: f.name || pp.full_name || "",
              email: f.email || pp.email || data.session.user.email || "",
              phone: f.phone || pp.phone || "",
            }));
          }

        } catch {/* non-fatal */}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayFn = useServerFn(getDayAvailability);
  const monthFn = useServerFn(getMonthAvailability);
  const reqFn = useServerFn(requestBooking);

  // Add-ons for this treatment
  const addonsQuery = useQuery({
    queryKey: ["addonsForBooking", slug, treatment.id],
    queryFn: () => listAddonsForBooking({ data: { slug, treatment_ids: [treatment.id] } }),
  });
  const availableAddons: PublicAddon[] = addonsQuery.data ?? [];
  const [addonPicks, setAddonPicks] = useState<Set<string>>(new Set());
  const toggleAddon = (id: string) =>
    setAddonPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const addonNet = (a: PublicAddon) =>
    (a.price_cents / 100) * (1 - (a.discount_percent ?? 0) / 100);




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

  const modelDates = useMemo(
    () => new Set(modelSlotsForLoc.map((s) => s.slot_date)),
    [modelSlotsForLoc],
  );

  const isDateUnavailable = (d: Date) => {
    const iso = toIsoDate(d);
    if (modelMode) return !modelDates.has(iso);
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
    if (modelMode) {
      const out: string[] = [];
      for (const s of modelSlotsForLoc.filter((s) => s.slot_date === date)) {
        const start = toMinutes(s.start_time);
        const end = toMinutes(s.end_time);
        for (let t = start; t + duration <= end; t += duration) {
          out.push(fromMinutes(t));
        }
      }
      return Array.from(new Set(out)).sort();
    }

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
  }, [dayQuery.data, dayRules, duration, locationId, modelMode, modelSlotsForLoc, date]);



  async function submit() {
    if (submitLockRef.current) return;
    if (!slot || !form.name || !form.email) {
      toast.error("Please fill name, email and pick a time slot");
      return;
    }
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const endMin = toMinutes(slot) + duration;
      let endTimeStr = fromMinutes(endMin);
      let effectivePrice = price;
      if (modelMode) {
        const slotMin = toMinutes(slot);
        const ms = modelSlotsForLoc.find((s) => {
          if (s.slot_date !== date) return false;
          const a = toMinutes(s.start_time);
          const b = toMinutes(s.end_time);
          return slotMin >= a && slotMin + duration <= b;
        });
        if (ms) {
          endTimeStr = fromMinutes(slotMin + duration);
          effectivePrice = ms.price_mode === "fixed"
            ? Number(ms.price_value)
            : Math.max(0, price * (1 - Number(ms.price_value) / 100));
        }
      }

      const res = await reqFn({
        data: {
          profileId: ctx.profileId,
          treatmentId: treatment.id,
          locationId,
          date,
          startTime: slot,
          endTime: endTimeStr,

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
          notes: (() => {
            const picked = availableAddons.filter((a) => addonPicks.has(a.id));
            const lines: string[] = [];
            if (form.notes) lines.push(form.notes);
            if (picked.length) lines.push("Add-ons: " + picked.map((a) => `${a.name} (£${addonNet(a).toFixed(2)})`).join(", "));
            if (splitAllowed && paymentPlan === "split") {
              const per = (effectivePrice / sessionCount).toFixed(2);
              lines.push(`Payment plan: Split into ${sessionCount} sessions (£${per} per session)`);
            } else if (sessionCount > 1) {
              lines.push(`Payment plan: Pay in full for ${sessionCount} sessions`);
            }
            return lines.length ? lines.join("\n") : undefined;
          })(),
          basePrice: effectivePrice,
          patientUserId: patientUserId,
          practitionerId: (typeof window !== "undefined" ? window.sessionStorage.getItem(`modo:practitionerId:${slug}`) : null) || null,


        },
      });
      setConfirmed({ id: res.id, consents: res.consents ?? [] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
      submitLockRef.current = false;
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
          {bookableFrom && (
            <p className="text-xs text-muted-foreground mt-1">
              Bookable from {fromIsoDate(bookableFrom).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
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
                if (bookableFrom && toIsoDate(d) < bookableFrom) return true;
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
                {slots.map((s) => {
                  const selected = slot === s;
                  return (
                    <Button
                      key={s}
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSlot(s)}
                      style={selected ? { backgroundColor: brand, borderColor: brand, color: "#fff" } : { color: brand, borderColor: `${brand}55` }}
                    >
                      {fmt(s)}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {authChoice === "pending" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base" style={headingStyle}>Sign in to continue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm opacity-70">
              Create an account or sign in to track your appointments, leave reviews and view your notes after each visit.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link
                to="/m/$slug/auth"
                params={{ slug }}
                search={{ redirect: redirectPath }}
              >
                <Button className="w-full" style={{ backgroundColor: brand, color: "#fff" }}>
                  <LogIn className="mr-2 h-4 w-4" /> Sign in
                </Button>
              </Link>
              <Link
                to="/m/$slug/auth"
                params={{ slug }}
                search={{ tab: "signup", redirect: redirectPath }}
              >
                <Button variant="outline" className="w-full" style={{ color: brand, borderColor: `${brand}55` }}>
                  <UserPlus className="mr-2 h-4 w-4" /> Sign up
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full"
                style={{ color: brand }}
                onClick={() => setAuthChoice("guest")}
              >
                Continue as guest
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
      <>
      {authChoice === "signed-in" && (
        <div className="mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm" style={{ borderColor: `${brand}33`, color: brand }}>
          <UserCheck className="h-4 w-4" /> Signed in — this booking will be saved to your account.
        </div>
      )}
      {availableAddons.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base" style={headingStyle}>
              Add-ons <span className="text-xs font-normal opacity-60">(optional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {availableAddons.map((a) => {
              const checked = addonPicks.has(a.id);
              const base = a.price_cents / 100;
              const net = addonNet(a);
              const hasDiscount = (a.discount_percent ?? 0) > 0;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAddon(a.id)}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition"
                  style={{
                    borderColor: checked ? brand : `${brand}33`,
                    backgroundColor: checked ? `${brand}10` : "transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" readOnly checked={checked} className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">{a.name}</div>
                      {a.duration_min > 0 && (
                        <div className="text-xs opacity-60">+{a.duration_min} min</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {hasDiscount ? (
                      <>
                        <span className="opacity-50 line-through mr-2">£{base.toFixed(2)}</span>
                        <span className="font-semibold" style={{ color: brand }}>£{net.toFixed(2)}</span>
                        <div className="text-[10px] font-semibold text-emerald-600">
                          {a.discount_percent}% off
                        </div>
                      </>
                    ) : (
                      <span className="font-semibold" style={{ color: brand }}>+£{base.toFixed(2)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
      {splitAllowed && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base" style={headingStyle}>
              Payment plan <span className="text-xs font-normal opacity-60">({sessionCount} sessions)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {(["full", "split"] as const).map((opt) => {
              const selected = paymentPlan === opt;
              const per = (price / sessionCount).toFixed(2);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPaymentPlan(opt)}
                  className="flex flex-col items-start gap-1 rounded-md border px-3 py-3 text-left transition"
                  style={{
                    borderColor: selected ? brand : `${brand}33`,
                    backgroundColor: selected ? `${brand}10` : "transparent",
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: brand }}>
                    {opt === "full" ? "Pay in full" : `Split into ${sessionCount} payments`}
                  </div>
                  <div className="text-xs opacity-70">
                    {opt === "full"
                      ? `£${price.toFixed(2)} total`
                      : `£${per} per session · charged at each visit`}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
      <Card className="mb-6">


        <CardHeader>
          <CardTitle className="text-base" style={headingStyle}>Your details</CardTitle>
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
        style={{ backgroundColor: brand, color: "#fff" }}
      >
        {submitting ? "Booking…" : "Confirm booking"}
      </Button>
      </>
      )}
      </div>

    </main>
  );
}

