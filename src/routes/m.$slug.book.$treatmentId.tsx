import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBookingContext, getDayAvailability, getMonthAvailability, requestBooking, type PaymentChoice } from "@/lib/public-booking.functions";
import { redeemGiftCardCode } from "@/lib/gift-cards.functions";
import { previewMembershipCredit, redeemMembershipCredit } from "@/lib/memberships.functions";
import { ruleAppliesOnDate } from "@/lib/rota";

import { BookingPaymentPicker } from "@/components/BookingPaymentPicker";
import { BookingProgress, type BookingStep } from "@/components/BookingProgress";

import { listAddonsForBooking, type PublicAddon } from "@/lib/addons.functions";
import { ensurePatient, getMyPatient, updateMyPatient } from "@/lib/patient.functions";
import { linkReferralToAppointment, consumePointsRedemption } from "@/lib/rewards.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Clock, MapPin, CheckCircle2, LogIn, UserPlus, UserCheck } from "lucide-react";
import { DiscountCodeBox, type AppliedDiscount } from "@/components/DiscountCodeBox";
import { ReferralCodeInput } from "@/components/ReferralCodeInput";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { treatmentPricing } from "@/lib/price-display";
type Rule = Database["public"]["Tables"]["availability_rules"]["Row"];
type LocOptional = "is_public" | "notes" | "phone" | "coming_soon" | "coming_soon_label";
type Loc = Omit<Database["public"]["Tables"]["locations"]["Row"], LocOptional> &
  Partial<Pick<Database["public"]["Tables"]["locations"]["Row"], LocOptional>>;


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
  validateSearch: (search: Record<string, unknown>): { locationId?: string; model?: string } => ({
    locationId: typeof search.locationId === "string" ? search.locationId : undefined,
    model: typeof search.model === "string" ? search.model : undefined,
  }),
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

function formatSessionSpacing(days?: number | null) {
  if (!days || days <= 0) return null;
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `every ${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  return `every ${days} day${days === 1 ? "" : "s"}`;
}

function BookTreatmentPage() {
  const { slug } = useParams({ from: "/m/$slug/book/$treatmentId" });
  const search = Route.useSearch();
  const ctx = Route.useLoaderData();
  const treatment = ctx.treatment;
  const settings = (ctx as { settings?: import("@/lib/public-booking.functions").PublicBookingSettings }).settings;
  const showPrices = settings?.show_prices_on_booking !== false;
  const reqPhone = settings?.require_phone !== false;
  const reqDob = settings?.require_dob !== false;
  const reqAddress = settings?.require_address !== false;
  const maxLeadDays = settings?.booking_max_lead_days ?? 90;
  const minNoticeHours = settings?.booking_min_notice_hours ?? 0;
  const smartTimes = settings?.booking_smart_times_enabled === true;
  const redirectPath = `/m/${slug}/book/${treatment.id}`;
  const duration = treatment.duration ?? 30;
  const basePrice = Number(treatment.price ?? 0);
  const pricing = treatmentPricing(treatment as never, basePrice);
  const listPrice = pricing.price;

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
    // Theme shadcn tokens with the practitioner's brand so calendar, buttons, rings etc. all match
    ["--primary" as string]: brand,
    ["--primary-foreground" as string]: "#ffffff",
    ["--accent" as string]: `${brand}1a`,
    ["--accent-foreground" as string]: brand,
    ["--ring" as string]: brand,
  };
  const headingStyle: React.CSSProperties = {
    fontFamily: `${headingFont}, ${bodyFont}, system-ui, sans-serif`,
    color: brand,
  };

  const [locationId, setLocationId] = useState<string | null>(() => {
    const preselected = search.locationId;
    if (preselected && ctx.locations.some((l: Loc) => l.id === preselected)) return preselected;
    return ctx.locations[0]?.id ?? null;
  });

  const modelSlotsAll = (ctx as { modelSlots?: Array<{ id: string; location_id: string | null; slot_date: string; start_time: string; end_time: string; price_mode: "fixed" | "percent"; price_value: number }> }).modelSlots ?? [];
  const modelMode = modelSlotsAll.length > 0;
  const modelSlotsForLoc = useMemo(
    () => modelSlotsAll.filter((s) => !locationId || !s.location_id || s.location_id === locationId),
    [modelSlotsAll, locationId],
  );
  const bookableFrom = (ctx as { bookableFrom?: string | null }).bookableFrom ?? null;
  const todayIso = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
  const today = bookableFrom && bookableFrom > todayIso ? bookableFrom : todayIso;
  const firstModelDate = modelSlotsForLoc[0]?.slot_date ?? today;
  const [date, setDate] = useState<string>(modelMode ? firstModelDate : today);
  const [month, setMonth] = useState<Date>(modelMode ? fromIsoDate(firstModelDate) : fromIsoDate(today));

  const [slot, setSlot] = useState<string | null>(null);

  // Model slots can be priced differently to the standard treatment price
  // (fixed £ or % off). Resolve the slot the patient is actually booking so the
  // model price is what we show *and* what we charge at checkout.
  const activeModelSlot = useMemo(() => {
    if (!modelMode) return null;
    const onDate = modelSlotsForLoc.filter((s) => s.slot_date === date);
    if (onDate.length === 0) return null;
    if (!slot) return onDate[0];
    const m = toMinutes(slot);
    return onDate.find((s) => m >= toMinutes(s.start_time) && m < toMinutes(s.end_time)) ?? onDate[0];
  }, [modelMode, modelSlotsForLoc, date, slot]);

  const price = useMemo(() => {
    if (!activeModelSlot) return listPrice;
    return activeModelSlot.price_mode === "fixed"
      ? Math.max(0, Number(activeModelSlot.price_value))
      : Math.max(0, listPrice * (1 - Number(activeModelSlot.price_value) / 100));
  }, [activeModelSlot, listPrice]);
  const [confirmed, setConfirmed] = useState<
    {
      id: string;
      consents: { token: string; consent_template_id: string }[];
      medicalForms: { token: string; appointment_id: string; template_name: string | null }[];
    } | null
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
  const sessionSpacing = formatSessionSpacing((treatment as { session_interval_days?: number | null }).session_interval_days);
  const splitAllowed = Boolean((treatment as { allow_split_payment?: boolean }).allow_split_payment) && sessionCount > 1;
  const [paymentPlan, setPaymentPlan] = useState<"full" | "split">("full");
  const [splitAgreed, setSplitAgreed] = useState(false);
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice | null>(null);
  const [useCredit, setUseCredit] = useState(false);



  // Patient auth gate: 'pending' until they pick a path
  const [authChoice, setAuthChoice] = useState<"pending" | "guest" | "signed-in">("pending");
  const [patientUserId, setPatientUserId] = useState<string | null>(null);
  const ensure = useServerFn(ensurePatient);
  const fetchPatient = useServerFn(getMyPatient);
  const saveMyPatient = useServerFn(updateMyPatient);
  const [rememberMe, setRememberMe] = useState(true);

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
          const pp = p.patient as Record<string, string | null> | null;
          if (pp) {
            setForm((f) => ({
              ...f,
              name: f.name || pp.full_name || "",
              email: f.email || pp.email || data.session.user.email || "",
              phone: f.phone || pp.phone || "",
              dob: f.dob || pp.date_of_birth || "",
              addressLine1: f.addressLine1 || pp.address_line1 || "",
              addressLine2: f.addressLine2 || pp.address_line2 || "",
              city: f.city || pp.city || "",
              postcode: f.postcode || pp.postcode || "",
              country: f.country || pp.country || "",
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
  const linkReferral = useServerFn(linkReferralToAppointment);
  const redeemGc = useServerFn(redeemGiftCardCode);
  const consumePts = useServerFn(consumePointsRedemption);
  const previewCreditFn = useServerFn(previewMembershipCredit);
  const redeemCreditFn = useServerFn(redeemMembershipCredit);

  // Membership savings-pot credit available to the signed-in patient here.
  const creditQ = useQuery({
    queryKey: ["membership-credit", slug, treatment?.id, price],
    queryFn: () =>
      previewCreditFn({
        data: { slug, treatmentIds: [treatment.id], totalCents: Math.round(price * 100) },
      }),
    enabled: !!patientUserId && !!treatment?.id,
    staleTime: 30_000,
  });
  const creditPreview = creditQ.data;
  const creditAvailable = (creditPreview?.applicableCents ?? 0) > 0;



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
  const addonNet = (a: PublicAddon) => {
    const base = a.price_cents / 100;
    if (a.discount_amount != null) return Math.max(0, base - a.discount_amount);
    return base * (1 - (a.discount_percent ?? 0) / 100);
  };
  const pickedAddons = availableAddons.filter((a) => addonPicks.has(a.id));
  const addonsExtraPrice = pickedAddons.reduce((s, a) => s + addonNet(a), 0);
  const totalBeforeDiscount = price + addonsExtraPrice;
  const discountTotal = useMemo(() => {
    if (!discount || !discount.applies_to_treatment_ids.includes(treatment.id)) return 0;
    const off = discount.kind === "percent"
      ? price * (discount.amount / 100)
      : discount.amount;
    return Math.min(off, price);
  }, [discount, price, treatment.id]);
  const totalAfterDiscount = Math.max(0, totalBeforeDiscount - discountTotal);
  const dueTodayAmount = splitAllowed && paymentPlan === "split"
    ? totalAfterDiscount / sessionCount
    : totalAfterDiscount;




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
    // An ad-hoc open slot is an explicit "I'm working this day" and wins
    // over a closed/blocked day for the same date.
    if (data.overrideDates.includes(iso)) return false;
    if (data.blockedDates.includes(iso)) return true;
    // Fully booked days have nothing left to offer — grey them out.
    if ((data as { fullDates?: string[] }).fullDates?.includes(iso)) return true;
    if (Array.isArray((data as { openDates?: string[] }).openDates)) {
      return !(data as { openDates: string[] }).openDates.includes(iso);
    }
    return !data.activeDays.includes(d.getDay());
  };



  const dow = useMemo(() => {
    // Convert YYYY-MM-DD to weekday (0=Sun..6=Sat) without timezone drift
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }, [date]);

  const dayRules = useMemo(
    () => {
      const anchor = (ctx as { rotaAnchor?: string | null }).rotaAnchor ?? null;
      return ctx.rules.filter(
        (r: Rule) =>
          r.day_of_week === dow &&
          (!locationId || !r.location_id || r.location_id === locationId) &&
          ruleAppliesOnDate(r as unknown as { cycle_length?: number; weeks_mask?: number; effective_from?: string | null; effective_to?: string | null }, date, anchor),
      );
    },
    [ctx.rules, dow, locationId, date, (ctx as { rotaAnchor?: string | null }).rotaAnchor],
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
    const buildOut = (useSmart: boolean) => {
      const local: string[] = [];
      for (const r of allRules) {
        const step = r.slot_interval ?? duration;
        const start = toMinutes(r.start_time);
        const end = toMinutes(r.end_time);
        const candidates = new Set<number>();
        if (useSmart && busy.length > 0) {
          const WINDOW = 60;
          for (const b of busy) {
            for (let t = b.start - duration; t >= b.start - duration - WINDOW && t >= start; t -= step) {
              if (t + duration <= end) candidates.add(t);
            }
            for (let t = b.end; t <= b.end + WINDOW && t + duration <= end; t += step) {
              if (t >= start) candidates.add(t);
            }
          }
        } else {
          for (let t = start; t + duration <= end; t += step) candidates.add(t);
        }
        for (const t of Array.from(candidates).sort((a, z) => a - z)) {
          const slotEnd = t + duration;
          const overlap = busy.some(
            (b) =>
              (!locationId || !b.locId || b.locId === locationId) &&
              t < b.end &&
              slotEnd > b.start,
          );
          if (!overlap) local.push(fromMinutes(t));
        }
      }
      return local;
    };
    const applyNotice = (arr: string[]) => {
      const todayLocalIso = (() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
      })();
      if (date !== todayLocalIso) return arr;
      const now = new Date();
      const cutoff = now.getHours() * 60 + now.getMinutes() + Math.max(0, minNoticeHours) * 60;
      return arr.filter((s) => toMinutes(s) >= cutoff);
    };
    let out2 = applyNotice(Array.from(new Set(buildOut(smartTimes))).sort());
    // Smart-times fallback: if clustering left no bookable times, widen to the
    // full standard grid so the day isn't falsely shown as fully booked.
    if (smartTimes && out2.length === 0) {
      out2 = applyNotice(Array.from(new Set(buildOut(false))).sort());
    }
    return out2;

  }, [dayQuery.data, dayRules, duration, locationId, modelMode, modelSlotsForLoc, date, minNoticeHours, smartTimes]);



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
      const endTimeStr = fromMinutes(endMin);
      // `price` already reflects the selected model slot's pricing.
      let effectivePrice = price;

      // Apply promo code (only if it covers this treatment)
      let discountOff = 0;
      if (discount && discount.applies_to_treatment_ids.includes(treatment.id)) {
        discountOff = discount.kind === "percent"
          ? effectivePrice * (discount.amount / 100)
          : discount.amount;
        discountOff = Math.min(discountOff, effectivePrice);
        effectivePrice = Math.max(0, effectivePrice - discountOff);
      }
      const picked = availableAddons.filter((a) => addonPicks.has(a.id));
      effectivePrice += picked.reduce((sum, a) => sum + addonNet(a), 0);

      // Membership savings-pot credit (signed-in patients with a pot).
      let creditOff = 0;
      if (useCredit && creditAvailable) {
        creditOff = Math.min(creditPreview!.applicableCents / 100, effectivePrice);
        effectivePrice = Math.max(0, effectivePrice - creditOff);
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
            const lines: string[] = [];
            if (form.notes) lines.push(form.notes);
            if (picked.length) lines.push("Add-ons: " + picked.map((a) => `${a.name} (£${addonNet(a).toFixed(2)})`).join(", "));
            if (discount && discountOff > 0) {
              lines.push(`Promo code ${discount.code} applied (-£${discountOff.toFixed(2)})`);
            }
            if (splitAllowed && paymentPlan === "split") {
              const per = (effectivePrice / sessionCount).toFixed(2);
              lines.push(`Payment plan: Pay over ${sessionCount} appointments (£${per} per appointment)`);
            } else if (sessionCount > 1) {
              lines.push(`Payment plan: Pay in full for ${sessionCount} sessions`);
            }
            return lines.length ? lines.join("\n") : undefined;
          })(),
          basePrice: splitAllowed && paymentPlan === "split" ? effectivePrice / sessionCount : effectivePrice,
          patientUserId: patientUserId,
          practitionerId: (typeof window !== "undefined" ? window.sessionStorage.getItem(`modo:practitionerId:${slug}`) : null) || null,
          paymentChoice,
          modelSlotId: activeModelSlot?.id ?? null,



        },
      });
      if (patientUserId && rememberMe) {
        try {
          await saveMyPatient({ data: {
            full_name: form.name,
            phone: form.phone,
            date_of_birth: form.dob || null,
            address_line1: form.addressLine1,
            address_line2: form.addressLine2,
            city: form.city,
            postcode: form.postcode,
            country: form.country,
          }});
        } catch { /* non-fatal */ }
      }
      // If this booking came from a referral share link, register it now so
      // the reward can pay out automatically when the appointment completes.
      try {
        const refCode = typeof window !== "undefined"
          ? sessionStorage.getItem("modo_ref_code")
          : null;
        if (refCode && res.id) {
          await linkReferral({ data: { appointmentId: res.id, code: refCode } });
          sessionStorage.removeItem("modo_ref_code");
        }
      } catch { /* non-fatal */ }
      // Redeem gift card credit against this appointment (idempotent server-side).
      try {
        if (discount?.isGiftCard && discount.giftCardPurchaseId && discountOff > 0 && res.id) {
          await redeemGc({ data: { slug, code: discount.code, amount: discountOff, appointment_id: res.id } });
        }
      } catch { /* non-fatal */ }
      // Deduct redeemed loyalty points (idempotent per appointment).
      try {
        if (discount?.isPointsRedemption && discount.pointsToUse && discount.pointsToUse > 0 && res.id) {
          await consumePts({ data: { slug, code: discount.code, appointmentId: res.id, pointsToUse: discount.pointsToUse } });
        }
      } catch { /* non-fatal */ }
      // Deduct membership savings-pot credit (idempotent per appointment).
      try {
        if (creditOff > 0 && res.id) {
          await redeemCreditFn({ data: { slug, appointmentId: res.id, amountCents: Math.round(creditOff * 100) } });
        }
      } catch { /* non-fatal */ }

      const emb = (res as { embeddedPayment?: {
        clientSecret: string;
        paymentIntentId: string;
        publishableKey: string;
        connectedAccountId: string;
        amountCents: number;
        currency: string;
        returnUrl: string;
      } | null }).embeddedPayment;
      if (emb) {
        // Stash the embedded PI details in sessionStorage so the pay page
        // can read them without exposing them in the URL.
        try {
          sessionStorage.setItem(`modo:pay:${emb.paymentIntentId}`, JSON.stringify(emb));
        } catch { /* non-fatal */ }
        window.location.href = `/m/${slug}/pay?pi=${encodeURIComponent(emb.paymentIntentId)}`;
        return;
      }
      if ((res as { checkoutUrl?: string | null }).checkoutUrl) {
        window.location.href = (res as { checkoutUrl: string }).checkoutUrl;
        return;
      }
      setConfirmed({ id: res.id, consents: res.consents ?? [], medicalForms: res.medicalForms ?? [] });

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
          {confirmed.medicalForms.length > 0 && (
            <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-left">
              <p className="text-sm font-semibold">Please complete your medical form(s) before your appointment:</p>
              <ul className="mt-2 space-y-2 text-sm">
                {confirmed.medicalForms.map((f) => (
                  <li key={f.token}>
                    <a href={`${origin}/f/${f.token}`} className="underline" style={{ color: brand }}>
                      {f.template_name ? `Complete: ${f.template_name}` : "Complete medical form"}
                    </a>
                  </li>
                ))}
              </ul>
              {patientUserId && (
                <p className="mt-3 text-xs opacity-70">
                  These are also available anytime in your <Link to="/m/$slug/account" params={{ slug }} className="underline">patient account</Link>.
                </p>
              )}
            </div>
          )}
          {confirmed.consents.length > 0 && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-left">
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




      {(() => {
        const detailsDone = Boolean(
          form.name && form.email &&
          (!reqPhone || form.phone) &&
          (!reqDob || form.dob) &&
          (!reqAddress || form.addressLine1),
        );
        const steps: BookingStep[] = [
          { key: "treatment", label: "Treatment", done: true },
          { key: "location", label: "Location", done: ctx.locations.length <= 1 ? true : !!locationId },
          { key: "datetime", label: "Date & Time", done: !!slot },
          { key: "details", label: "Your Details", done: detailsDone },
          { key: "payment", label: "Payment", done: !!paymentChoice },
        ];
        return <BookingProgress steps={steps} accent={brand} />;
      })()}

      <Card className="mb-6 animate-fade-in transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader>
          <CardTitle style={headingStyle}>{treatment.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 opacity-70">
            <Clock className="h-4 w-4" /> {duration} min
          </span>
          {showPrices && (
            sessionCount > 1 ? (
              <span className="text-sm">
                <span className="font-semibold" style={{ color: brand }}>From £{(price / sessionCount).toFixed(2)} per appointment</span>
                <span className="opacity-60"> or £{price.toFixed(2)} paid upfront</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: brand }}>
                {pricing.hasDiscount && pricing.showWasNow && (
                  <span className="font-normal text-muted-foreground line-through">£{pricing.base.toFixed(2)}</span>
                )}
                <span>£{price.toFixed(2)}</span>
                {pricing.hasDiscount && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {pricing.label || `−${pricing.percent}%`}
                  </span>
                )}
              </span>
            )
          )}
          {sessionCount > 1 && (
            <Badge variant="outline" className="font-semibold">
              {sessionCount} sessions{sessionSpacing ? ` · ${sessionSpacing}` : ""}
            </Badge>
          )}
          {ctx.locations.length === 1 && (
            <span className="inline-flex items-center gap-1 opacity-70">
              <MapPin className="h-4 w-4" /> {(ctx.locations[0] as Loc).name}
            </span>
          )}
        </CardContent>
      </Card>



      {ctx.locations.length === 1 && (() => {
        const l = ctx.locations[0] as Loc;
        const addressParts = [l.address_line1, l.address_line2, l.city, l.postcode, l.country]
          .filter(Boolean)
          .join(", ");
        const mapsUrl = addressParts
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name}, ${addressParts}`)}`
          : null;
        return (
          <Card className="mb-6 border-l-4" style={{ borderLeftColor: brand }}>
            <CardContent className="flex flex-wrap items-start gap-3 py-4 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: brand }} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold" style={headingStyle}>Booking at {l.name}</p>
                {addressParts && (
                  <p className="mt-0.5 text-muted-foreground">{addressParts}</p>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs underline underline-offset-2"
                    style={{ color: brand }}
                  >
                    View on Google Maps
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
                if (maxLeadDays > 0) {
                  const maxDate = new Date(startOfToday);
                  maxDate.setDate(maxDate.getDate() + maxLeadDays);
                  if (d > maxDate) return true;
                }
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
              const hasDiscount = (a.discount_percent ?? 0) > 0 || (a.discount_amount ?? 0) > 0;
              const discountLabel =
                a.discount_amount != null && a.discount_amount > 0
                  ? `£${a.discount_amount.toFixed(2)} off`
                  : `${a.discount_percent}% off`;
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
                          {discountLabel}
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
              const per = (totalAfterDiscount / sessionCount).toFixed(2);
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
                    {opt === "full" ? "Pay in full" : `Pay over ${sessionCount} appointments`}
                  </div>
                  <div className="text-xs opacity-70">
                    {opt === "full"
                      ? `£${totalAfterDiscount.toFixed(2)} total`
                      : `£${per} per appointment · charged at each visit`}
                  </div>
                </button>
              );
            })}
          </CardContent>
          {paymentPlan === "split" && (
            <div className="border-t px-6 py-4" style={{ borderColor: `${brand}22`, backgroundColor: `${brand}08` }}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-current"
                  style={{ accentColor: brand }}
                  checked={splitAgreed}
                  onChange={(e) => setSplitAgreed(e.target.checked)}
                />
                <span>
                  I agree to pay <strong>£{(totalAfterDiscount / sessionCount).toFixed(2)}</strong> per appointment,
                  across <strong>{sessionCount} appointments</strong> (total £{totalAfterDiscount.toFixed(2)}), charged at each visit to complete this treatment plan.
                  <span className="text-destructive"> *</span>
                </span>
              </label>
            </div>
          )}
        </Card>
      )}
      <Card className="mb-6">


        <CardHeader>
          <CardTitle className="text-base" style={headingStyle}>Your details</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Full name <span className="text-destructive">*</span></Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">Phone {reqPhone ? <span className="text-destructive">*</span> : <span className="text-xs opacity-50">(optional)</span>}</Label>
            <Input id="phone" required={reqPhone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dob">Date of birth {reqDob ? <span className="text-destructive">*</span> : <span className="text-xs opacity-50">(optional)</span>}</Label>
            <Input id="dob" type="date" required={reqDob} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </div>
          {reqAddress && (
            <>
              <div className="sm:col-span-2 pt-2 border-t mt-2">
                <Label className="text-sm font-semibold">Address</Label>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="line1">Address line 1 <span className="text-destructive">*</span></Label>
                <AddressAutocomplete
                  id="line1"
                  value={form.addressLine1}
                  country="gb"
                  onChange={(v) => setForm({ ...form, addressLine1: v })}
                  onSelect={(a) =>
                    setForm({
                      ...form,
                      addressLine1: a.line1,
                      city: a.city || form.city,
                      postcode: a.postcode || form.postcode,
                      country: a.country || form.country,
                    })
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="line2">Address line 2 (optional)</Label>
                <Input id="line2" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="postcode">Postcode <span className="text-destructive">*</span></Label>
                <Input id="postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {authChoice === "signed-in" && (
            <div className="sm:col-span-2 flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="remember-me" className="cursor-pointer font-normal">
                Save these details to my account for faster booking next time
              </Label>
            </div>
          )}
          {showPrices && (
            <div className="sm:col-span-2">
              <DiscountCodeBox
                slug={slug}
                treatmentIds={[treatment.id]}
                total={price}
                brand={brand}
                value={discount}
                onChange={setDiscount}
              />
            </div>
          )}
          {showPrices && patientUserId && creditAvailable && (
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={useCredit}
                  onChange={(e) => setUseCredit(e.target.checked)}
                />
                <span>
                  Use my membership credit — pot balance £{((creditPreview?.balanceCents ?? 0) / 100).toFixed(2)}
                  {" "}(−£{(Math.min(creditPreview!.applicableCents, Math.round(price * 100)) / 100).toFixed(2)} on this booking)
                </span>
              </label>
            </div>
          )}
          <div className="sm:col-span-2">
            <ReferralCodeInput clinicSlug={slug} brand={brand} />
          </div>
        </CardContent>
      </Card>

      <BookingPaymentPicker
        slug={slug}
        totalAmount={dueTodayAmount}
        value={paymentChoice}
        onChange={setPaymentChoice}
        accent={brand}
        depositOverrideCents={
          Number((treatment as { deposit_amount?: number | null }).deposit_amount ?? 0) > 0
            ? Math.round(Number((treatment as { deposit_amount?: number | null }).deposit_amount) * 100)
            : null
        }
        splitInfo={splitAllowed && paymentPlan === "split" ? { sessionCount } : null}
      />


      {(() => {
        const missingRequirement =
          !slot ? "Please pick a time slot above"
          : !form.name ? "Please enter your name above"
          : !form.email ? "Please enter your email above"
          : (reqPhone && !form.phone) ? "Please enter your phone number above"
          : (reqDob && !form.dob) ? "Please enter your date of birth above"
          : (splitAllowed && paymentPlan === "split" && !splitAgreed) ? "Tick the payment-plan agreement to continue"
          : (totalAfterDiscount > 0 && !paymentChoice) ? "Please choose how you'd like to pay above"
          : null;

        return <Button

        className="w-full"
        size="lg"
        disabled={
          !slot || submitting || !form.name || !form.email ||
          (reqPhone && !form.phone) || (reqDob && !form.dob) ||
          (splitAllowed && paymentPlan === "split" && !splitAgreed) ||
          (totalAfterDiscount > 0 && !paymentChoice)
        }
        onClick={submit}
        style={{ backgroundColor: brand, color: "#fff" }}
      >
        {submitting
          ? "Booking…"
          : missingRequirement
            ? missingRequirement
          : splitAllowed && paymentPlan === "split"
            ? `Book & pay £${dueTodayAmount.toFixed(2)} today (${sessionCount} × £${(totalAfterDiscount / sessionCount).toFixed(2)})`
            : showPrices && totalAfterDiscount > 0
              ? `Book & pay £${totalAfterDiscount.toFixed(2)}`
              : "Confirm booking"}
        </Button>;
      })()}
      </>
      )}
      </div>

    </main>
  );
}

