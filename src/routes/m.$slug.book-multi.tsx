import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMultiBookingContext,
  getDayAvailability,
  getMonthAvailability,
  requestMultiBooking,
  type PaymentChoice,
} from "@/lib/public-booking.functions";
import { ruleAppliesOnDate } from "@/lib/rota";

import { BookingPaymentPicker } from "@/components/BookingPaymentPicker";
import { BookingProgress, type BookingStep } from "@/components/BookingProgress";

import { listAddonsForBooking, type PublicAddon } from "@/lib/addons.functions";
import { ensurePatient, getMyPatient, updateMyPatient } from "@/lib/patient.functions";
import { getPrescriberInfoForTreatments } from "@/lib/prescriber.functions";
import { listAvailableVisitsForBooking } from "@/lib/clinic-visits.functions";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Clock, MapPin, CheckCircle2, LogIn, UserPlus, UserCheck, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { DiscountCodeBox, type AppliedDiscount } from "@/components/DiscountCodeBox";
import { ReferralCodeInput } from "@/components/ReferralCodeInput";
import { linkReferralToAppointment, consumePointsRedemption } from "@/lib/rewards.functions";
import { redeemGiftCardCode } from "@/lib/gift-cards.functions";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { SafeHtml } from "@/components/SafeHtml";
import { treatmentPricing } from "@/lib/price-display";

type Rule = Database["public"]["Tables"]["availability_rules"]["Row"];
type LocOptional = "is_public" | "notes" | "phone" | "coming_soon" | "coming_soon_label";
type Loc = Omit<Database["public"]["Tables"]["locations"]["Row"], LocOptional> &
  Partial<Pick<Database["public"]["Tables"]["locations"]["Row"], LocOptional>>;
type Treatment = Database["public"]["Tables"]["treatments"]["Row"];
type Pricing = Database["public"]["Tables"]["treatment_location_pricing"]["Row"];

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

const searchSchema = z.object({ ids: z.string().optional(), pkgs: z.string().optional(), locationId: z.string().optional() });

export const Route = createFileRoute("/m/$slug/book-multi")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ ids: search.ids ?? "", pkgs: search.pkgs ?? "" }),
  loader: ({ params, deps }) => {
    const ids = deps.ids.split(",").filter(Boolean);
    const packageIds = deps.pkgs.split(",").filter(Boolean);
    return getMultiBookingContext({ data: { slug: params.slug, treatmentIds: ids, packageIds } });
  },
  component: MultiBookPage,
});

function MultiBookPage() {
  const { slug } = useParams({ from: "/m/$slug/book-multi" });
  const ctx = Route.useLoaderData();
  const search = Route.useSearch();
  const ids = (search.ids ?? "").split(",").filter(Boolean);
  const packageIds = (search.pkgs ?? "").split(",").filter(Boolean);
  const selectedPackages = ((ctx as { selectedPackages?: Array<{ id: string; name: string; price: number; session_count: number; allow_split_payment?: boolean; firstTreatmentId: string | null }> }).selectedPackages ?? [])
    .filter((p) => packageIds.includes(p.id));
  const redirectPath = `/m/${slug}/book-multi?ids=${encodeURIComponent(ids.join(","))}${packageIds.length ? `&pkgs=${encodeURIComponent(packageIds.join(","))}` : ""}`;

  // Combine explicit treatment ids with each package's first treatment (auto-included, deduped)
  const combinedIds = useMemo(() => {
    const out: string[] = [...ids];
    for (const p of selectedPackages) {
      if (p.firstTreatmentId && !out.includes(p.firstTreatmentId)) out.push(p.firstTreatmentId);
    }
    return out;
  }, [ids, selectedPackages]);

  // Preserve user-selected order
  const treatments = useMemo<Treatment[]>(() => {
    const map = new Map<string, Treatment>(ctx.treatments.map((t: Treatment) => [t.id, t]));
    return combinedIds.map((id: string) => map.get(id)).filter(Boolean) as Treatment[];
  }, [ctx.treatments, combinedIds]);

  const settings = (ctx as { settings?: import("@/lib/public-booking.functions").PublicBookingSettings }).settings;
  const showPrices = settings?.show_prices_on_booking !== false;
  const reqPhone = settings?.require_phone !== false;
  const reqDob = settings?.require_dob !== false;
  const reqAddress = settings?.require_address !== false;
  const maxLeadDays = settings?.booking_max_lead_days ?? 90;
  const minNoticeHours = settings?.booking_min_notice_hours ?? 0;
  const smartTimes = settings?.booking_smart_times_enabled === true;


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

  const initialLocationId =
    (search.locationId && ctx.locations.some((l: Loc) => l.id === search.locationId))
      ? search.locationId
      : (ctx.locations[0]?.id ?? null);
  const [locationId, setLocationId] = useState<string | null>(initialLocationId);

  const priceFor = (t: Treatment) => {
    let base = Number(t.price ?? 0);
    if (locationId) {
      const o = ctx.pricing.find((p: Pricing) => p.treatment_id === t.id && p.location_id === locationId);
      if (o?.price_cents != null) base = o.price_cents / 100;
    }
    return treatmentPricing(t as never, base).price;
  };
  const basePriceFor = (t: Treatment) => {
    if (locationId) {
      const o = ctx.pricing.find((p: Pricing) => p.treatment_id === t.id && p.location_id === locationId);
      if (o?.price_cents != null) return o.price_cents / 100;
    }
    return Number(t.price ?? 0);
  };
  const durationFor = (t: Treatment) => {
    if (locationId) {
      const o = ctx.pricing.find((p: Pricing) => p.treatment_id === t.id && p.location_id === locationId);
      if (o?.duration_minutes != null) return o.duration_minutes;
    }
    return t.duration ?? 30;
  };

  const totalDurationBase = treatments.reduce((s, t) => s + durationFor(t), 0);
  const totalPriceBase = treatments.reduce((s, t) => s + priceFor(t), 0);

  // Add-ons (new system) — fetched after treatment selection
  const addonsQuery = useQuery({
    queryKey: ["addonsForBooking", slug, ids.join(",")],
    queryFn: () => listAddonsForBooking({ data: { slug, treatment_ids: ids } }),
    enabled: ids.length > 0,
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
    const d = a.discount_percent ?? 0;
    return base * (1 - d / 100);
  };
  const addonsExtraPrice = availableAddons
    .filter((a) => addonPicks.has(a.id))
    .reduce((s, a) => s + addonNet(a), 0);
  const addonsExtraDuration = availableAddons
    .filter((a) => addonPicks.has(a.id))
    .reduce((s, a) => s + (a.duration_min || 0), 0);
  const totalDuration = totalDurationBase + addonsExtraDuration;
  const totalPrice = totalPriceBase + addonsExtraPrice;
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const discountTotal = useMemo(() => {
    if (!discount) return 0;
    const ids = new Set(discount.applies_to_treatment_ids);
    const eligibleSum = treatments
      .filter((t) => ids.has(t.id))
      .reduce((s, t) => s + priceFor(t), 0);
    if (eligibleSum <= 0) return 0;
    const off = discount.kind === "percent"
      ? eligibleSum * (discount.amount / 100)
      : discount.amount;
    return Math.min(off, eligibleSum);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount, treatments]);
  const totalAfterDiscount = Math.max(0, totalPrice - discountTotal);
  const splitEligibleTreatments = useMemo(
    () =>
      treatments.filter((t) => {
        const sessions = Math.max(1, Number((t as { session_count?: number }).session_count ?? 1));
        return Boolean((t as { allow_split_payment?: boolean }).allow_split_payment) && sessions > 1;
      }),
    [treatments],
  );
  const splitEligiblePackages = selectedPackages.filter(
    (p) => Boolean(p.allow_split_payment) && Math.max(1, Number(p.session_count ?? 1)) > 1,
  );
  const [packagePaymentPlans, setPackagePaymentPlans] = useState<Record<string, "full" | "split">>({});
  const selectedPackagePlan = (id: string) => packagePaymentPlans[id] ?? "full";
  const [paymentPlans, setPaymentPlans] = useState<Record<string, "full" | "split">>({});
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice | null>(null);
  const [step, setStep] = useState<"selection" | "datetime" | "details">("selection");

  const selectedPaymentPlan = (t: Treatment) => paymentPlans[t.id] ?? "full";
  const setTreatmentPaymentPlan = (treatmentId: string, plan: "full" | "split") =>
    setPaymentPlans((prev) => ({ ...prev, [treatmentId]: plan }));

  const bookableFrom = (ctx as { bookableFrom?: string | null }).bookableFrom ?? null;
  const todayIso = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
  const today = bookableFrom && bookableFrom > todayIso ? bookableFrom : todayIso;
  const [date, setDate] = useState<string>(today);
  const [month, setMonth] = useState<Date>(fromIsoDate(today));
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<
    | {
        appointments: { id: string; treatmentId: string }[];
        consents: { token: string; consent_template_id: string }[];
        medicalForms?: { token: string; appointment_id: string; template_name: string | null }[];
      }
    | null
  >(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", dob: "",
    addressLine1: "", addressLine2: "", city: "", postcode: "", country: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [splitAgreed, setSplitAgreed] = useState(false);
  const [prescriberConsents, setPrescriberConsents] = useState<Record<string, boolean>>({});
  const [visitSelections, setVisitSelections] = useState<Record<string, string>>({});

  // Prescriber requirements for the selected treatments
  const prescriberFn = useServerFn(getPrescriberInfoForTreatments);
  const prescriberInfoQuery = useQuery({
    queryKey: ["prescriberInfo", slug, ids.join(",")],
    queryFn: () => prescriberFn({ data: { slug, treatment_ids: ids } }),
    enabled: ids.length > 0,
  });
  type PrescInfo = NonNullable<typeof prescriberInfoQuery.data>[number];
  const prescriberItems: PrescInfo[] = prescriberInfoQuery.data ?? [];
  const sameAddressItems = prescriberItems.filter((p) => p.routing === "same_address");
  const clinicVisitItems = prescriberItems.filter((p) => p.routing === "clinic_visit");
  const inPersonItems = prescriberItems.filter((p) => p.routing === "in_person_consult");

  const visitsFn = useServerFn(listAvailableVisitsForBooking);
  const clinicVisitIds = clinicVisitItems.map((p) => p.treatment_id);
  const availableVisitsQuery = useQuery({
    queryKey: ["clinicVisits", slug, clinicVisitIds.join(",")],
    queryFn: () => visitsFn({ data: { slug, treatment_ids: clinicVisitIds } }),
    enabled: clinicVisitIds.length > 0,
  });
  const availableVisits = availableVisitsQuery.data ?? [];

  const allConsented = sameAddressItems.every((p) => prescriberConsents[p.treatment_id]);
  const allVisitsPicked = clinicVisitItems.every((p) => visitSelections[p.treatment_id]);
  const allClinicVisitsConsented = clinicVisitItems.every(
    (p) => prescriberConsents[p.treatment_id],
  );
  const prescriberBlocks =
    !allConsented || !allVisitsPicked || !allClinicVisitsConsented || inPersonItems.length > 0;

  
  const termsHtml = (ctx as { termsHtml?: string | null }).termsHtml ?? null;
  // Only enforce the tick when the practitioner actually has terms text to show —
  // otherwise there is no checkbox on the page and checkout would be blocked forever.
  const termsRequired =
    Boolean((ctx as { termsRequired?: boolean }).termsRequired) && Boolean(termsHtml && termsHtml.trim());
  const [authChoice, setAuthChoice] = useState<"pending" | "guest" | "signed-in">("pending");
  const [patientUserId, setPatientUserId] = useState<string | null>(null);
  const ensure = useServerFn(ensurePatient);
  const fetchPatient = useServerFn(getMyPatient);
  const saveMyPatient = useServerFn(updateMyPatient);
  const [rememberMe, setRememberMe] = useState(true);

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
  const reqFn = useServerFn(requestMultiBooking);
  const redeemGc = useServerFn(redeemGiftCardCode);
  const consumePts = useServerFn(consumePointsRedemption);
  

  const monthQuery = useQuery({
    queryKey: ["monthAvail", ctx.profileId, month.getFullYear(), month.getMonth() + 1, locationId],
    queryFn: () => monthFn({ data: { profileId: ctx.profileId, year: month.getFullYear(), month: month.getMonth() + 1, locationId } }),
  });

  const isDateUnavailable = (d: Date) => {
    const iso = toIsoDate(d);
    const data = monthQuery.data;
    if (!data) return false;
    // Ad-hoc open slots win over a closed day.
    if (data.overrideDates.includes(iso)) return false;
    if (data.blockedDates.includes(iso)) return true;
    if (Array.isArray((data as { openDates?: string[] }).openDates)) {
      return !(data as { openDates: string[] }).openDates.includes(iso);
    }
    return !data.activeDays.includes(d.getDay());
  };

  const dow = useMemo(() => {
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
    if (!dayQuery.data || dayQuery.data.isBlocked || totalDuration === 0) return [];
    const busy = dayQuery.data.busy.map((b) => ({ start: toMinutes(b.start_time), end: toMinutes(b.end_time), locId: b.location_id }));
    const overrideRules = (dayQuery.data.overrides ?? []).filter((o) => !locationId || !o.location_id || o.location_id === locationId);
    const allRules: { start_time: string; end_time: string; slot_interval: number }[] = [
      ...dayRules.map((r: Rule) => ({ start_time: r.start_time, end_time: r.end_time, slot_interval: r.slot_interval })),
      ...overrideRules.map((o) => ({ start_time: o.start_time, end_time: o.end_time, slot_interval: o.slot_interval })),
    ];
    const out: string[] = [];
    for (const r of allRules) {
      const step = r.slot_interval ?? 15;
      const start = toMinutes(r.start_time);
      const end = toMinutes(r.end_time);
      const candidates = new Set<number>();
      if (smartTimes && busy.length > 0) {
        const WINDOW = 60;
        for (const b of busy) {
          for (let t = b.start - totalDuration; t >= b.start - totalDuration - WINDOW && t >= start; t -= step) {
            if (t + totalDuration <= end) candidates.add(t);
          }
          for (let t = b.end; t <= b.end + WINDOW && t + totalDuration <= end; t += step) {
            if (t >= start) candidates.add(t);
          }
        }
      } else {
        for (let t = start; t + totalDuration <= end; t += step) candidates.add(t);
      }
      for (const t of Array.from(candidates).sort((a, z) => a - z)) {
        const slotEnd = t + totalDuration;
        const overlap = busy.some((b) => (!locationId || !b.locId || b.locId === locationId) && t < b.end && slotEnd > b.start);
        if (!overlap) out.push(fromMinutes(t));
      }
    }
    let out2 = Array.from(new Set(out)).sort();
    {
      const n = new Date();
      const todayLocalIso = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
      if (date === todayLocalIso) {
        const cutoff = n.getHours() * 60 + n.getMinutes() + Math.max(0, minNoticeHours) * 60;
        out2 = out2.filter((s) => toMinutes(s) >= cutoff);
      }
    }
    return out2;

  }, [dayQuery.data, dayRules, totalDuration, locationId, minNoticeHours, date, smartTimes]);

  async function submit() {
    if (submitLockRef.current) return;
    if (!slot || !form.name || !form.email) {
      toast.error("Please fill name, email and pick a time slot");
      return;
    }
    if (termsRequired && !agreedToTerms) {
      toast.error("Please agree to the terms & conditions to continue");
      return;
    }
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const applicableIds = new Set(discount?.applies_to_treatment_ids ?? []);
      const depositOverridesSplit = paymentChoice?.mode === "deposit";
      const pickedAddonTotalCents = Math.round(
        availableAddons
          .filter((a) => addonPicks.has(a.id))
          .reduce((sum, a) => sum + addonNet(a), 0) * 100,
      );
      const bookings = treatments.map((t, index) => {
        let price = priceFor(t);
        if (discount && applicableIds.has(t.id)) {
          const off = discount.kind === "percent"
            ? price * (discount.amount / 100)
            : discount.amount;
          price = Math.max(0, price - Math.min(off, price));
        }
        const priceCents = Math.round(price * 100) + (index === 0 ? pickedAddonTotalCents : 0);
        return {
          treatmentId: t.id,
          durationMin: durationFor(t),
          priceCents,
          sessionCount: Math.max(1, Number((t as { session_count?: number }).session_count ?? 1)),
          paymentPlan: depositOverridesSplit ? ("full" as const) : selectedPaymentPlan(t),
          clinicVisitId: visitSelections[t.id] ?? null,
        };
      });

      const res = await reqFn({
        data: {
          profileId: ctx.profileId,
          bookings,
          locationId,
          date,
          startTime: slot,
          patientName: form.name,
          patientEmail: form.email,
          patientPhone: form.phone || undefined,
          patientDob: form.dob || null,
          patientAddress: {
            line1: form.addressLine1, line2: form.addressLine2,
            city: form.city, postcode: form.postcode, country: form.country,
          },
          notes: (() => {
            const picked = availableAddons.filter((a) => addonPicks.has(a.id));
            const lines = [form.notes].filter(Boolean) as string[];
            if (picked.length) {
              lines.push("Add-ons: " + picked.map((a) => `${a.name} (£${addonNet(a).toFixed(2)})`).join(", "));
            }
            if (discount) {
              lines.push(`Promo code ${discount.code} applied (${discount.kind === "percent" ? `${discount.amount}% off` : `£${discount.amount.toFixed(2)} off`})`);
            }
            for (const t of splitEligibleTreatments) {
              const sessions = Math.max(1, Number((t as { session_count?: number }).session_count ?? 1));
              if (selectedPaymentPlan(t) === "split") {
                lines.push(`${t.name}: pay over ${sessions} appointments (£${(priceFor(t) / sessions).toFixed(2)} per appointment)`);
              } else {
                lines.push(`${t.name}: pay in full for ${sessions} sessions`);
              }
            }
            for (const p of splitEligiblePackages) {
              const sessions = Math.max(1, Number(p.session_count ?? 1));
              if (selectedPackagePlan(p.id) === "split") {
                lines.push(`${p.name} (package): pay per session — £${(p.price / sessions).toFixed(2)} × ${sessions} sessions`);
              } else {
                lines.push(`${p.name} (package): paid in full (£${p.price.toFixed(2)})`);
              }
            }
            return lines.length ? lines.join("\n") : undefined;
          })(),
          patientUserId,
          practitionerId: (typeof window !== "undefined" ? window.sessionStorage.getItem(`modo:practitionerId:${slug}`) : null) || null,
          packagePurchases: selectedPackages.map((p) => ({ packageId: p.id })),
          paymentChoice,

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
      setConfirmed(res);

      // Link a referral code (entered on this page) to the new appointments so
      // the reward pays out automatically. Idempotent per appointment.
      try {
        const refCode = typeof window !== "undefined"
          ? sessionStorage.getItem("modo_ref_code")
          : null;
        if (refCode && res.appointments?.length) {
          for (const a of res.appointments) {
            try { await linkReferralToAppointment({ data: { appointmentId: a.id, code: refCode } }); } catch { /* ignore */ }
          }
          sessionStorage.removeItem("modo_ref_code");
        }
      } catch { /* non-fatal */ }

      // Redeem gift card credit against the first appointment (idempotent).
      try {
        const firstId = res.appointments?.[0]?.id;
        if (discount?.isGiftCard && discount.giftCardPurchaseId && discountTotal > 0 && firstId) {
          await redeemGc({ data: { slug, code: discount.code, amount: discountTotal, appointment_id: firstId } });
        }
      } catch { /* non-fatal */ }

      // Deduct redeemed loyalty points against the first appointment.
      try {
        const firstId = res.appointments?.[0]?.id;
        if (discount?.isPointsRedemption && discount.pointsToUse && discount.pointsToUse > 0 && firstId) {
          await consumePts({ data: { slug, code: discount.code, appointmentId: firstId, pointsToUse: discount.pointsToUse } });
        }
      } catch { /* non-fatal */ }




    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
      submitLockRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  if (treatments.length === 0) {
    return (
      <main className="min-h-screen" style={pageStyle}>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="opacity-70">No treatments selected.</p>
          <Link to="/m/$slug" params={{ slug }} className="mt-4 inline-block">
            <Button variant="outline">Back to clinic</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (confirmed) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <main className="min-h-screen" style={pageStyle}>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12" style={{ color: accent }} />
          <h1 className="text-2xl font-bold" style={headingStyle}>Booking confirmed</h1>
          <p className="mt-2 opacity-70">
            Your {confirmed.appointments.length} appointment{confirmed.appointments.length === 1 ? "" : "s"} with {ctx.clinicName} are confirmed. A confirmation email has been sent to {form.email}.
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
            </div>
          )}
          {confirmed.medicalForms && confirmed.medicalForms.length > 0 && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-left">
              <p className="text-sm font-semibold">Please complete your medical form(s) before your appointment:</p>
              <ul className="mt-2 space-y-2 text-sm">
                {confirmed.medicalForms.map((f) => (
                  <li key={f.token}>
                    <a href={`${origin}/f/${f.token}`} className="underline" style={{ color: brand }}>
                      Complete {f.template_name ?? "medical form"}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs opacity-70">
                A link has also been emailed to you and is available in your patient account.
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

  const detailsDone = Boolean(
    form.name && form.email &&
    (!reqPhone || form.phone) &&
    (!reqDob || form.dob) &&
    (!reqAddress || form.addressLine1),
  );
  const selectionValid = treatments.length > 0 || selectedPackages.length > 0;
  const locationValid = ctx.locations.length <= 1 || !!locationId;
  const datetimeValid = !!slot && locationValid;

  const stepsMeta: BookingStep[] = [
    { key: "treatment", label: "Treatment", done: treatments.length > 0 || selectedPackages.length > 0, active: step === "selection" && !(treatments.length > 0 || selectedPackages.length > 0) },
    { key: "datetime", label: "Location & Time", done: !!slot && locationValid, active: step === "datetime" && !(!!slot && locationValid) },
    { key: "details", label: "Your Details", done: detailsDone, active: step === "details" && !detailsDone },
    { key: "payment", label: "Payment", done: !!paymentChoice || totalAfterDiscount <= 0, active: step === "details" && !paymentChoice && totalAfterDiscount > 0 },
  ];

  const goNext = () => {
    if (step === "selection") setStep("datetime");
    else if (step === "datetime") setStep("details");
  };
  const goBack = () => {
    if (step === "details") setStep("datetime");
    else if (step === "datetime") setStep("selection");
  };

  const dateLabel = date ? fromIsoDate(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : null;
  const chosenLoc = ctx.locations.find((l: Loc) => l.id === locationId);

  const summaryChip = (
    <div
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-xs sm:text-sm"
      style={{ borderColor: `${brand}33`, backgroundColor: `${brand}08`, color: brand }}
    >
      <span className="font-semibold">
        {treatments.length + selectedPackages.length} item{treatments.length + selectedPackages.length === 1 ? "" : "s"}
      </span>
      <span className="opacity-70">·</span>
      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{totalDuration} min</span>
      {chosenLoc && (<><span className="opacity-70">·</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{chosenLoc.name}</span></>)}
      {dateLabel && slot && (<><span className="opacity-70">·</span><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{dateLabel} · {fmt(slot)}</span></>)}
      {showPrices && (
        <span className="ml-auto font-semibold">
          {discountTotal > 0 && <span className="mr-2 text-[11px] font-normal opacity-50 line-through">£{totalPrice.toFixed(2)}</span>}
          £{totalAfterDiscount.toFixed(2)}
        </span>
      )}
    </div>
  );

  const SummarySidebar = (
    <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: `${brand}33`, backgroundColor: `${brand}06` }}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: brand }}>Order summary</div>
      <div className="space-y-2">
        {selectedPackages.map((p) => (
          <div key={p.id} className="flex justify-between gap-3 border-b pb-2 last:border-b-0">
            <div>
              <div className="font-medium" style={{ color: brand }}>{p.name}</div>
              <div className="text-[11px] opacity-70">{p.session_count} session{p.session_count === 1 ? "" : "s"}</div>
            </div>
            {showPrices && <div className="whitespace-nowrap font-semibold" style={{ color: brand }}>£{p.price.toFixed(2)}</div>}
          </div>
        ))}
        {treatments.map((t) => (
          <div key={t.id} className="flex justify-between gap-3 border-b pb-2 last:border-b-0">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-[11px] opacity-70">{durationFor(t)} min</div>
            </div>
            {showPrices && <div className="whitespace-nowrap font-semibold" style={{ color: brand }}>£{priceFor(t).toFixed(2)}</div>}
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 border-t pt-3 text-xs">
        {chosenLoc && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 opacity-60" />{chosenLoc.name}</div>}
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 opacity-60" />{totalDuration} min total</div>
        {dateLabel && slot && <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 opacity-60" />{dateLabel} at {fmt(slot)}</div>}
      </div>
      {showPrices && (
        <div className="mt-3 flex items-baseline justify-between border-t pt-3">
          <span className="text-xs opacity-70">Total</span>
          <span className="text-lg font-bold" style={{ color: brand }}>
            {discountTotal > 0 && <span className="mr-2 text-xs font-normal opacity-50 line-through">£{totalPrice.toFixed(2)}</span>}
            £{totalAfterDiscount.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen pb-28 lg:pb-10" style={pageStyle}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-10">
        <div className="min-w-0">
          <div className="mb-4">
            <Link to="/m/$slug" params={{ slug }} className="text-sm opacity-70 hover:underline">
              ← Back to {ctx.clinicName}
            </Link>
          </div>




          <BookingProgress steps={stepsMeta} accent={brand} />
          {summaryChip}

          {step === "selection" && (
            <>
              {selectedPackages.length > 0 && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle style={headingStyle}>Package{selectedPackages.length === 1 ? "" : "s"} in this booking ({selectedPackages.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedPackages.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-b-0 py-2">
                        <div>
                          <div className="font-medium" style={{ color: brand }}>{p.name}</div>
                          <div className="text-xs opacity-70">{p.session_count} session{p.session_count === 1 ? "" : "s"} · first session booked below, remaining tracked in your account</div>
                        </div>
                        {showPrices && (
                          <div className="text-right">
                            <div className="font-semibold whitespace-nowrap" style={{ color: brand }}>£{p.price.toFixed(2)}</div>
                            {Boolean(p.allow_split_payment) && Math.max(1, Number(p.session_count ?? 1)) > 1 && (
                              <div className="text-[11px] opacity-70">
                                or £{(p.price / Math.max(1, Number(p.session_count ?? 1))).toFixed(2)} per session
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle style={headingStyle}>Your selection ({treatments.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {treatments.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm border-b last:border-b-0 py-2">
                      <div className="font-medium" style={{ color: brand }}>{t.name}</div>
                      <div className="flex items-center gap-3 opacity-80">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{durationFor(t)} min</span>
                        {showPrices && <span className="font-semibold" style={{ color: brand }}>£{priceFor(t).toFixed(2)}</span>}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 text-sm font-semibold">
                    <span>Total ({totalDuration} min)</span>
                    {showPrices && (
                      discountTotal > 0 ? (
                        <span>
                          <span className="mr-2 text-xs font-normal opacity-50 line-through">£{totalPrice.toFixed(2)}</span>
                          <span style={{ color: brand }}>£{totalAfterDiscount.toFixed(2)}</span>
                        </span>
                      ) : (
                        <span style={{ color: brand }}>£{totalPrice.toFixed(2)}</span>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>


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
            </>
          )}

          {step === "datetime" && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base" style={headingStyle}>Pick a location, date & time</CardTitle>
                {bookableFrom && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Bookable from {fromIsoDate(bookableFrom).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {ctx.locations.length > 1 && (
                  <div>
                    <Label className="mb-2 block text-sm font-semibold">Location</Label>
                    <div className="flex flex-wrap gap-2">
                      {ctx.locations.map((l: Loc) => {
                        const selected = locationId === l.id;
                        return (
                          <Button
                            key={l.id}
                            variant={selected ? "default" : "outline"}
                            size="sm"
                            onClick={() => { setLocationId(l.id); setSlot(null); }}
                            style={selected ? { backgroundColor: brand, borderColor: brand, color: "#fff" } : { color: brand, borderColor: `${brand}55` }}
                          >
                            <MapPin className="mr-1 h-4 w-4" />{l.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-center">

                  <Calendar
                    mode="single"
                    selected={fromIsoDate(date)}
                    month={month}
                    onMonthChange={setMonth}
                    onSelect={(d) => { if (!d) return; setDate(toIsoDate(d)); setSlot(null); }}
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
                  <Label className="mb-2 block text-sm font-semibold">Available start times (needs {totalDuration} min)</Label>
                  {dayQuery.isLoading ? (
                    <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
                  ) : dayQuery.data?.isBlocked ? (
                    <p className="mt-2 text-sm text-muted-foreground">This date is unavailable.</p>
                  ) : slots.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No slots available. Try another date.</p>
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
          )}

          {step === "details" && (
            authChoice === "pending" ? (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base" style={headingStyle}>Sign in to continue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm opacity-70">Create an account or sign in to track your appointments.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Link to="/m/$slug/auth" params={{ slug }} search={{ redirect: redirectPath }}>
                      <Button className="w-full" style={{ backgroundColor: brand, color: "#fff" }}><LogIn className="mr-2 h-4 w-4" />Sign in</Button>
                    </Link>
                    <Link to="/m/$slug/auth" params={{ slug }} search={{ tab: "signup", redirect: redirectPath }}>
                      <Button variant="outline" className="w-full" style={{ color: brand, borderColor: `${brand}55` }}><UserPlus className="mr-2 h-4 w-4" />Sign up</Button>
                    </Link>
                    <Button variant="ghost" className="w-full" style={{ color: brand }} onClick={() => setAuthChoice("guest")}>Continue as guest</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {authChoice === "signed-in" && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm" style={{ borderColor: `${brand}33`, color: brand }}>
                    <UserCheck className="h-4 w-4" /> Signed in — saved to your account.
                  </div>
                )}
                {(splitEligibleTreatments.length > 0 || splitEligiblePackages.length > 0) && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-base" style={headingStyle}>Payment plan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {splitEligibleTreatments.map((t) => {
                        const sessions = Math.max(1, Number((t as { session_count?: number }).session_count ?? 1));
                        const spacing = formatSessionSpacing((t as { session_interval_days?: number | null }).session_interval_days);
                        const plan = selectedPaymentPlan(t);
                        const fullPrice = priceFor(t);
                        const perSession = fullPrice / sessions;
                        return (
                          <div key={t.id} className="space-y-2 rounded-md border p-3" style={{ borderColor: `${brand}33` }}>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: brand }}>{t.name}</div>
                              <div className="text-xs opacity-70">
                                {sessions} sessions available{spacing ? ` · ${spacing}` : ""}
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(["full", "split"] as const).map((opt) => {
                                const selected = plan === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setTreatmentPaymentPlan(t.id, opt)}
                                    className="flex w-full min-w-0 flex-col items-start gap-1 rounded-md border px-3 py-3 text-left transition"
                                    style={{
                                      borderColor: selected ? brand : `${brand}33`,
                                      backgroundColor: selected ? `${brand}10` : "transparent",
                                    }}
                                  >
                                    <span className="w-full break-words text-sm font-semibold" style={{ color: brand }}>
                                      {opt === "full" ? "Pay in full" : `Pay over ${sessions} appointments`}
                                    </span>
                                    <span className="w-full break-words text-xs opacity-70">
                                      {opt === "full"
                                        ? `£${fullPrice.toFixed(2)} total`
                                        : `£${perSession.toFixed(2)} per appointment · charged at each visit`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {splitEligiblePackages.map((p) => {
                        const sessions = Math.max(1, Number(p.session_count ?? 1));
                        const plan = selectedPackagePlan(p.id);
                        const perSession = p.price / sessions;
                        return (
                          <div key={p.id} className="space-y-2 rounded-md border p-3" style={{ borderColor: `${brand}33` }}>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: brand }}>{p.name}</div>
                              <div className="text-xs opacity-70">Package · {sessions} sessions</div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(["full", "split"] as const).map((opt) => {
                                const selected = plan === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setPackagePaymentPlans((prev) => ({ ...prev, [p.id]: opt }))}
                                    className="flex w-full min-w-0 flex-col items-start gap-1 rounded-md border px-3 py-3 text-left transition"
                                    style={{
                                      borderColor: selected ? brand : `${brand}33`,
                                      backgroundColor: selected ? `${brand}10` : "transparent",
                                    }}
                                  >
                                    <span className="w-full break-words text-sm font-semibold" style={{ color: brand }}>
                                      {opt === "full" ? "Pay in full" : `Pay over ${sessions} sessions`}
                                    </span>
                                    <span className="w-full break-words text-xs opacity-70">
                                      {opt === "full"
                                        ? `£${p.price.toFixed(2)} total`
                                        : `£${perSession.toFixed(2)} per session · charged at each visit`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                    {(splitEligibleTreatments.some((t) => selectedPaymentPlan(t) === "split")
                      || splitEligiblePackages.some((p) => selectedPackagePlan(p.id) === "split")) && (
                      <div className="border-t px-6 py-4" style={{ borderColor: `${brand}22`, backgroundColor: `${brand}08` }}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ accentColor: brand }}
                            checked={splitAgreed}
                            onChange={(e) => setSplitAgreed(e.target.checked)}
                          />
                          <span className="min-w-0 flex-1 break-words">
                            I agree to pay the amount at each appointment
                            {(() => {
                              const parts = splitEligibleTreatments
                                .filter((t) => selectedPaymentPlan(t) === "split")
                                .map((t) => {
                                  const sessions = Math.max(1, Number((t as { session_count?: number }).session_count ?? 1));
                                  const per = priceFor(t) / sessions;
                                  return `${sessions} × £${per.toFixed(2)} for ${t.name}`;
                                });
                              return parts.length > 0 ? ` (${parts.join(", ")})` : "";
                            })()}, until each treatment plan is complete.
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
                          id="remember-me-multi"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="remember-me-multi" className="cursor-pointer font-normal">
                          Save these details to my account for faster booking next time
                        </Label>
                      </div>
                    )}
                  </CardContent>
                </Card>
                {termsHtml && termsHtml.trim() && (
                  <Card className="mb-6">
                    <CardHeader><CardTitle style={headingStyle}>Terms & Conditions</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <SafeHtml
                        html={termsHtml}
                        className="prose prose-sm max-w-none rounded-md border bg-muted/30 p-3 max-h-56 overflow-y-auto"
                      />

                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                        />
                        <span>
                          I have read and agree to the Terms & Conditions
                          {termsRequired && <span className="text-destructive"> *</span>}
                        </span>
                      </label>
                    </CardContent>
                  </Card>
                )}
                {showPrices && (
                  <Card className="mb-6">
                    <CardContent className="p-4">
                      <DiscountCodeBox
                        slug={slug}
                        treatmentIds={treatments.map((t) => t.id)}
                        packageIds={selectedPackages.map((p) => p.id)}
                        total={totalPrice}
                        brand={brand}
                        value={discount}
                        onChange={setDiscount}
                      />
                    </CardContent>
                  </Card>
                )}
                <Card className="mb-6">
                  <CardContent className="p-4">
                    <ReferralCodeInput clinicSlug={slug} brand={brand} />
                  </CardContent>
                </Card>
                {prescriberItems.length > 0 && (
                  <Card className="mb-6 border-2" style={{ borderColor: accent }}>
                    <CardContent className="space-y-4 p-4">
                      <div>
                        <p className="font-semibold" style={headingStyle}>
                          Prescriber review required
                        </p>
                        <p className="mt-1 text-sm opacity-80">
                          One or more of your treatments needs sign-off from a qualified prescriber
                          before it can be performed. Please review and consent below.
                        </p>
                      </div>

                      {sameAddressItems.length > 0 && (
                        <div className="space-y-3">
                          {sameAddressItems.map((p) => (
                            <div key={p.treatment_id} className="rounded-md border bg-muted/30 p-3">
                              <p className="text-sm font-medium">{p.treatment_name}</p>
                              <p className="mt-0.5 text-xs opacity-75">
                                Prescriber: <span className="font-medium">{p.prescriber_name}</span>
                                {p.prescriber_regulatory_body ? ` · ${p.prescriber_regulatory_body}` : ""}
                              </p>
                              {p.note && <p className="mt-1 text-xs opacity-75">{p.note}</p>}
                              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4"
                                  checked={Boolean(prescriberConsents[p.treatment_id])}
                                  onChange={(e) =>
                                    setPrescriberConsents((prev) => ({
                                      ...prev,
                                      [p.treatment_id]: e.target.checked,
                                    }))
                                  }
                                />
                                <span>
                                  I consent to {ctx.clinicName} sharing my booking details and
                                  medical forms with {p.prescriber_name} for this treatment.
                                  <span className="text-destructive"> *</span>
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}

                      {clinicVisitItems.length > 0 && (
                        <div className="space-y-3">
                          {clinicVisitItems.map((p) => {
                            const visits = availableVisits.filter(
                              (v) => v.treatment_id === p.treatment_id,
                            );
                            const selected = visitSelections[p.treatment_id];
                            return (
                              <div
                                key={p.treatment_id}
                                className="rounded-md border bg-muted/30 p-3"
                              >
                                <p className="text-sm font-medium">{p.treatment_name}</p>
                                <p className="mt-0.5 text-xs opacity-75">
                                  Prescriber: <span className="font-medium">{p.prescriber_name}</span>
                                  {p.prescriber_regulatory_body
                                    ? ` · ${p.prescriber_regulatory_body}`
                                    : ""}
                                </p>
                                <p className="mt-1 text-xs">
                                  Pick a day {p.prescriber_name} will be visiting the clinic for your
                                  prescriber review:
                                </p>
                                {availableVisitsQuery.isLoading ? (
                                  <p className="mt-2 text-xs opacity-70">Loading visit days…</p>
                                ) : visits.length === 0 ? (
                                  <p className="mt-2 text-xs text-destructive">
                                    No upcoming visit days available. Please contact the clinic.
                                  </p>
                                ) : (
                                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                    {visits.map((v) => {
                                      const active = selected === v.visit_id;
                                      return (
                                        <button
                                          key={v.visit_id}
                                          type="button"
                                          onClick={() =>
                                            setVisitSelections((prev) => ({
                                              ...prev,
                                              [p.treatment_id]: v.visit_id,
                                            }))
                                          }
                                          className={`rounded-md border px-2 py-1.5 text-left text-xs transition ${
                                            active
                                              ? "border-2 font-semibold"
                                              : "hover:bg-muted"
                                          }`}
                                          style={
                                            active ? { borderColor: accent, color: accent } : undefined
                                          }
                                        >
                                          <div>
                                            {new Date(
                                              v.visit_date + "T00:00:00",
                                            ).toLocaleDateString(undefined, {
                                              weekday: "short",
                                              day: "numeric",
                                              month: "short",
                                            })}{" "}
                                            · {v.start_time.slice(0, 5)}–{v.end_time.slice(0, 5)}
                                          </div>
                                          {v.location_name && (
                                            <div className="opacity-70">{v.location_name}</div>
                                          )}
                                          <div className="opacity-60">
                                            {v.remaining_capacity} slot
                                            {v.remaining_capacity === 1 ? "" : "s"} left
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {visits.length > 0 && (
                                  <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 h-4 w-4"
                                      checked={Boolean(prescriberConsents[p.treatment_id])}
                                      onChange={(e) =>
                                        setPrescriberConsents((prev) => ({
                                          ...prev,
                                          [p.treatment_id]: e.target.checked,
                                        }))
                                      }
                                    />
                                    <span>
                                      I consent to {ctx.clinicName} sharing my booking details and
                                      medical forms with {p.prescriber_name} for this visit.
                                      <span className="text-destructive"> *</span>
                                    </span>
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {inPersonItems.length > 0 && (
                        <div className="space-y-3">
                          {inPersonItems.map((p) => (
                            <div
                              key={p.treatment_id}
                              className="rounded-md border bg-amber-50/60 p-3 text-sm"
                            >
                              <p className="font-medium">{p.treatment_name}</p>
                              <p className="mt-1 text-xs">
                                This treatment requires an in-person consultation with{" "}
                                <span className="font-medium">{p.prescriber_name}</span> before it can
                                be booked here.
                              </p>
                              {p.note && <p className="mt-1 text-xs opacity-75">{p.note}</p>}
                              <p className="mt-2 text-xs opacity-75">
                                Please contact the clinic to arrange this consultation.
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {(() => {
                  const anySplit = splitEligibleTreatments.some((t) => selectedPaymentPlan(t) === "split");
                  // Per-session today: split treatments contribute price/sessions; others contribute full price.
                  let perSessionToday = 0;
                  let remainingPerSession = 0;
                  treatments.forEach((t) => {
                    const sessions = Math.max(1, Number((t as { session_count?: number }).session_count ?? 1));
                    const isSplit =
                      Boolean((t as { allow_split_payment?: boolean }).allow_split_payment) &&
                      sessions > 1 &&
                      selectedPaymentPlan(t) === "split";
                    if (isSplit) {
                      perSessionToday += priceFor(t) / sessions;
                      remainingPerSession += priceFor(t) / sessions;
                    } else {
                      perSessionToday += priceFor(t);
                    }
                  });
                  perSessionToday += addonsExtraPrice;
                  // Apply proportional discount to the today figure.
                  if (totalPrice > 0 && discountTotal > 0) {
                    perSessionToday = Math.max(0, perSessionToday - (perSessionToday / totalPrice) * discountTotal);
                    remainingPerSession = Math.max(0, remainingPerSession - (remainingPerSession / totalPrice) * discountTotal);
                  }
                  const maxSessions = anySplit
                    ? Math.max(
                        ...splitEligibleTreatments
                          .filter((t) => selectedPaymentPlan(t) === "split")
                          .map((t) => Math.max(2, Number((t as { session_count?: number }).session_count ?? 2))),
                      )
                    : 0;
                  return (
                    <BookingPaymentPicker
                      slug={slug}
                      totalAmount={anySplit ? perSessionToday : totalAfterDiscount}
                      value={paymentChoice}
                      onChange={setPaymentChoice}
                      accent={brand}
                      depositOverrideCents={(() => {
                        const values = treatments.map((t) => (t as { deposit_amount?: number | null }).deposit_amount);
                        // Every treatment explicitly waived (£0) → no deposit at all.
                        if (values.length > 0 && values.every((v) => v != null && Number(v) <= 0)) return 0;
                        const overrides = values.filter((v): v is number => v != null && v > 0);
                        if (overrides.length === 0) return null;
                        return Math.round(overrides.reduce((a, b) => a + b, 0) * 100);
                      })()}

                      splitInfo={anySplit ? { sessionCount: maxSessions, remainingPerSessionCents: Math.round(remainingPerSession * 100) } : null}
                    />
                  );
                })()}

                {(() => {
                  const isDeposit = paymentChoice?.mode === "deposit";
                  // Deposit overrides split: charge deposit today, balance at appointment.
                  const anySplit = !isDeposit && splitEligibleTreatments.some((t) => selectedPaymentPlan(t) === "split");
                  let dueToday = 0;
                  treatments.forEach((t) => {
                    const sessions = Math.max(1, Number((t as { session_count?: number }).session_count ?? 1));
                    const isSplit =
                      !isDeposit &&
                      Boolean((t as { allow_split_payment?: boolean }).allow_split_payment) &&
                      sessions > 1 &&
                      selectedPaymentPlan(t) === "split";
                    dueToday += isSplit ? priceFor(t) / sessions : priceFor(t);
                  });
                  dueToday += addonsExtraPrice;
                  if (totalPrice > 0) dueToday = Math.max(0, dueToday - (dueToday / totalPrice) * discountTotal);
                  const missingDetail =
                    !slot ? "Please pick a time slot above"
                    : !form.name ? "Please enter your name above"
                    : !form.email ? "Please enter your email above"
                    : (reqPhone && !form.phone) ? "Please enter your phone number above"
                    : (reqDob && !form.dob) ? "Please enter your date of birth above"
                    : (termsRequired && !agreedToTerms) ? "Please agree to the terms above"
                    : (totalAfterDiscount > 0 && !paymentChoice) ? "Please choose how you'd like to pay above"
                    : null;
                  const btnLabel = submitting
                    ? "Booking…"
                    : inPersonItems.length > 0
                      ? "Consultation required before booking"
                      : !allVisitsPicked
                        ? "Please pick a clinic visit day above"
                        : !allClinicVisitsConsented || !allConsented
                          ? "Please give prescriber consent above"
                          : prescriberBlocks
                            ? "Please complete prescriber consent above"
                            : anySplit && !splitAgreed
                              ? "Tick the payment-plan agreement to continue"
                              : missingDetail
                                ? missingDetail
                                : isDeposit
                                  ? `Book & pay deposit today`
                                  : anySplit
                                    ? `Book & pay £${dueToday.toFixed(2)} today (rest at each appointment)`
                                    : `Confirm ${treatments.length} booking${treatments.length === 1 ? "" : "s"} · £${totalAfterDiscount.toFixed(2)}`;
                  return (
                    <Button
                      className="mt-4 w-full"
                      size="lg"
                      disabled={
                        !slot || submitting || !form.name || !form.email || (reqPhone && !form.phone) || (reqDob && !form.dob) ||
                        (termsRequired && !agreedToTerms) || prescriberBlocks ||
                        (anySplit && !splitAgreed) ||
                        (totalAfterDiscount > 0 && !paymentChoice)
                      }
                      onClick={submit}
                      style={{ backgroundColor: brand, color: "#fff" }}
                    >
                      {btnLabel}
                    </Button>
                  );
                })()}
              </>
            )
          )}

          {step !== "details" && (
            <div className="mt-6 hidden items-center justify-between gap-3 lg:flex">
              <Button
                variant="outline"
                onClick={goBack}
                disabled={step === "selection"}
                style={{ color: brand, borderColor: `${brand}55` }}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={goNext}
                size="lg"
                className="h-12 px-8 text-base font-semibold"
                disabled={step === "selection" ? !selectionValid : !datetimeValid}
                style={{ backgroundColor: brand, color: "#fff" }}
              >
                Book <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6">{SummarySidebar}</div>
        </aside>
      </div>


      {step !== "details" && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden"
          style={{ borderColor: `${brand}33` }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            {step !== "selection" && (
              <Button variant="outline" size="lg" onClick={goBack} className="h-12 px-4" style={{ color: brand, borderColor: `${brand}55` }}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <Button
              size="lg"
              onClick={goNext}
              disabled={step === "selection" ? !selectionValid : !datetimeValid}
              className="h-12 flex-1 text-base font-semibold shadow-md"
              style={{ backgroundColor: brand, color: "#fff" }}
            >
              Book <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

