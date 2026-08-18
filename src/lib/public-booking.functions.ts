import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// Walks the category chain for the given category ids and returns the latest
// future `coming_soon_at` date (YYYY-MM-DD) found, or null if none are in the future.
async function computeBookableFrom(
  sb: ReturnType<typeof publicClient>,
  profileId: string,
  startCategoryIds: (string | null | undefined)[],
): Promise<string | null> {
  const seen = new Set<string>();
  const queue = startCategoryIds.filter((id): id is string => !!id);
  let latest: string | null = null;
  const todayIso = new Date().toISOString().slice(0, 10);
  while (queue.length) {
    const batch = queue.splice(0, queue.length).filter((id) => !seen.has(id));
    batch.forEach((id) => seen.add(id));
    if (batch.length === 0) break;
    const { data: cats } = await sb
      .from("treatment_categories")
      .select("id, parent_id, coming_soon_at")
      .eq("profile_id", profileId)
      .in("id", batch);
    for (const c of cats ?? []) {
      const csa = (c as { coming_soon_at: string | null }).coming_soon_at;
      if (csa) {
        const iso = csa.slice(0, 10);
        if (iso > todayIso && (!latest || iso > latest)) latest = iso;
      }
      const pid = (c as { parent_id: string | null }).parent_id;
      if (pid && !seen.has(pid)) queue.push(pid);
    }
  }
  return latest;
}

export const getBookingContext = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; treatmentId: string }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: profile, error: pErr } = await sb
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;
    if (!profile) throw new Error("Clinic not found");

    const { data: treatment, error: tErr } = await sb
      .from("treatments")
      .select("*")
      .eq("id", data.treatmentId)
      .eq("profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!treatment) throw new Error("Treatment not found");

    const { data: locations } = await sb
      .from("locations")
      .select("id, profile_id, name, address_line1, address_line2, city, postcode, country, is_primary, display_order, active, created_at, updated_at, image_url, coming_soon, coming_soon_label")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .eq("is_public", true)
      .order("is_primary", { ascending: false });

    const { data: rules } = await sb
      .from("availability_rules")
      .select("*")
      .eq("profile_id", profile.id);
    const { data: anchorRes } = await sb.rpc("get_rota_anchor", { p_profile_id: profile.id });
    const rotaAnchor = (anchorRes as string | null) ?? null;


    const { data: theme } = await sb
      .from("clinic_theme")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const today = new Date().toISOString().slice(0, 10);
    const { data: modelSlots } = await sb
      .from("model_slots")
      .select("id, treatment_id, location_id, slot_date, start_time, end_time, price_mode, price_value, notes, booked_appointment_id, active")
      .eq("profile_id", profile.id)
      .eq("treatment_id", data.treatmentId)
      .eq("active", true)
      .is("booked_appointment_id", null)
      .gte("slot_date", today)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });

    const bookableFrom = await computeBookableFrom(sb, profile.id, [
      (treatment as { category_id: string | null }).category_id,
    ]);

    const settings = extractBookingSettings(profile as Record<string, unknown>);

    return {
      profileId: profile.id,
      clinicName: profile.clinic_name,
      treatment,
      locations: locations ?? [],
      rules: rules ?? [],
      theme: theme ?? null,
      brandColor: (profile as { brand_color?: string | null }).brand_color ?? null,
      modelSlots: (() => {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        return (modelSlots ?? []).filter((s: any) => {
          if (!s.slot_date) return true;
          if (s.slot_date > todayStr) return true;
          if (s.slot_date < todayStr) return false;
          const timeStr = s.end_time || s.start_time;
          if (!timeStr) return true;
          return new Date(`${s.slot_date}T${timeStr}`).getTime() > now.getTime();
        });
      })(),
      bookableFrom,
      settings,
      rotaAnchor,
    };
  });


export type PublicBookingSettings = {
  booking_min_notice_hours: number;
  booking_max_lead_days: number;
  booking_buffer_before_minutes: number;
  booking_buffer_after_minutes: number;
  booking_daily_cap: number | null;
  payment_card_full_enabled: boolean;
  payment_deposit_enabled: boolean;
  payment_klarna_enabled: boolean;
  payment_clearpay_enabled: boolean;
  payment_pass_fees_to_customer: boolean;
  allow_pay_in_clinic: boolean;
  show_prices_on_booking: boolean;
  require_account_to_book: boolean;
  require_phone: boolean;
  require_dob: boolean;
  require_address: boolean;
  auto_confirm_bookings: boolean;
  booking_smart_times_enabled: boolean;
};

function extractBookingSettings(p: Record<string, unknown>): PublicBookingSettings {
  const num = (k: string, d: number) => (typeof p[k] === "number" ? (p[k] as number) : d);
  const numN = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);
  const bo = (k: string, d: boolean) => (typeof p[k] === "boolean" ? (p[k] as boolean) : d);
  return {
    booking_min_notice_hours: num("booking_min_notice_hours", 0),
    booking_max_lead_days: num("booking_max_lead_days", 90),
    booking_buffer_before_minutes: num("booking_buffer_before_minutes", 0),
    booking_buffer_after_minutes: num("booking_buffer_after_minutes", 0),
    booking_daily_cap: numN("booking_daily_cap"),
    payment_card_full_enabled: bo("payment_card_full_enabled", true),
    payment_deposit_enabled: bo("payment_deposit_enabled", false),
    payment_klarna_enabled: bo("payment_klarna_enabled", false),
    payment_clearpay_enabled: bo("payment_clearpay_enabled", false),
    payment_pass_fees_to_customer: bo("payment_pass_fees_to_customer", false),
    allow_pay_in_clinic: bo("allow_pay_in_clinic", true),
    show_prices_on_booking: bo("show_prices_on_booking", true),
    require_account_to_book: bo("require_account_to_book", false),
    require_phone: bo("require_phone", true),
    require_dob: bo("require_dob", true),
    require_address: bo("require_address", true),
    auto_confirm_bookings: bo("auto_confirm_bookings", true),
    booking_smart_times_enabled: bo("booking_smart_times_enabled", false),
  };
}


export const getMultiBookingContext = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; treatmentIds: string[]; packageIds?: string[] }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: profile, error: pErr } = await sb
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;
    if (!profile) throw new Error("Clinic not found");

    // Load selected packages first so we can auto-include their first treatment
    const packageIds = (data.packageIds ?? []).filter(Boolean);
    let packagesRows: Array<Record<string, unknown>> = [];
    if (packageIds.length > 0) {
      // Use admin client: custom "build your own" packages are created inactive
      // and are therefore invisible to the anon (RLS) client.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: pkgs } = await supabaseAdmin
        .from("packages")
        .select("*")
        .in("id", packageIds)
        .eq("profile_id", profile.id);
      packagesRows = (pkgs ?? []) as Array<Record<string, unknown>>;
    }

    const pkgFirstTreatmentIds = packagesRows
      .map((p) => {
        const ids = (p.treatment_ids as string[] | null) ?? [];
        const single = p.treatment_id as string | null;
        return ids[0] ?? single ?? null;
      })
      .filter((v): v is string => Boolean(v));

    const treatmentIds = Array.from(new Set([...(data.treatmentIds ?? []), ...pkgFirstTreatmentIds]));

    const treatmentsRes = await sb
      .from("treatments")
      .select("*")
      .in("id", treatmentIds.length > 0 ? treatmentIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("profile_id", profile.id)
      .eq("active", true);
    if (treatmentsRes.error) throw treatmentsRes.error;
    const treatments = treatmentsRes.data ?? [];

    const { data: locations } = await sb
      .from("locations")
      .select("id, profile_id, name, address_line1, address_line2, city, postcode, country, is_primary, display_order, active, created_at, updated_at, image_url, coming_soon, coming_soon_label")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .eq("is_public", true)
      .order("is_primary", { ascending: false });

    const { data: rules } = await sb
      .from("availability_rules")
      .select("*")
      .eq("profile_id", profile.id);
    const { data: anchorRes2 } = await sb.rpc("get_rota_anchor", { p_profile_id: profile.id });
    const rotaAnchor = (anchorRes2 as string | null) ?? null;


    const { data: theme } = await sb
      .from("clinic_theme")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const pricingRes = await sb
      .from("treatment_location_pricing")
      .select("*")
      .in("treatment_id", treatmentIds.length > 0 ? treatmentIds : ["00000000-0000-0000-0000-000000000000"]);
    const pricing = pricingRes.data ?? [];

    const bookableFrom = await computeBookableFrom(
      sb,
      profile.id,
      (treatments ?? []).map((t) => (t as { category_id: string | null }).category_id),
    );

    // Build lightweight package summaries with resolved first treatment id + expiry
    const selectedPackages = packagesRows.map((p) => {
      const ids = (p.treatment_ids as string[] | null) ?? [];
      const single = p.treatment_id as string | null;
      const firstTreatmentId = ids[0] ?? single ?? null;
      return {
        id: p.id as string,
        name: p.name as string,
        price: Number(p.price ?? 0),
        compare_at_price: p.compare_at_price == null ? null : Number(p.compare_at_price),
        session_count: Number(p.session_count ?? 1),
        expiry_days: (p.expiry_days as number | null) ?? null,
        allow_split_payment: Boolean(p.allow_split_payment),
        firstTreatmentId,

      };
    });

    return {
      profileId: profile.id,
      clinicName: profile.clinic_name,
      treatments: treatments ?? [],
      pricing: pricing ?? [],
      locations: locations ?? [],
      rules: rules ?? [],
      theme: theme ?? null,
      brandColor: (profile as { brand_color?: string | null }).brand_color ?? null,
      termsHtml: (profile as { terms_html?: string | null }).terms_html ?? null,
      termsRequired: (profile as { terms_required?: boolean | null }).terms_required ?? false,
      bookableFrom,
      settings: extractBookingSettings(profile as Record<string, unknown>),
      selectedPackages,
      rotaAnchor,
    };
  });




export const getDayAvailability = createServerFn({ method: "GET" })
  .inputValidator((input: { profileId: string; date: string; locationId?: string | null }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    // Use admin client to read appointments — anon has no SELECT policy on appointments,
    // so without this booked slots would not appear as busy to public visitors.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch profile settings (buffer, daily cap) via admin so RLS doesn't block us.
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("booking_buffer_before_minutes,booking_buffer_after_minutes,booking_daily_cap")
      .eq("id", data.profileId)
      .maybeSingle();
    const bufferBefore = Number(profileRow?.booking_buffer_before_minutes ?? 0);
    const bufferAfter = Number(profileRow?.booking_buffer_after_minutes ?? 0);
    const dailyCap = profileRow?.booking_daily_cap ?? null;

    const { data: blockedRows } = await sb
      .from("blocked_dates")
      .select("id,location_id")
      .eq("profile_id", data.profileId)
      .eq("date", data.date);
    let isBlocked = (blockedRows ?? []).some(
      (b) => !b.location_id || !data.locationId || b.location_id === data.locationId,
    );
    // A closure set for THIS specific location can only be re-opened by an
    // ad-hoc slot that is also scoped to this location — an "all locations"
    // opening must not cancel a location-specific closure.
    const hasLocationSpecificBlock = (blockedRows ?? []).some(
      (b) => !!b.location_id && !!data.locationId && b.location_id === data.locationId,
    );

    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id,start_time,end_time,location_id,status,payment_status,payment_hold_expires_at")
      .eq("profile_id", data.profileId)
      .eq("scheduled_date", data.date)
      .neq("status", "cancelled");

    // Release slots that were held for a Stripe checkout that the patient
    // abandoned: an unpaid pending appointment whose hold timestamp has
    // passed no longer blocks availability. We also actively cancel those
    // rows so they stop appearing on patient profiles and dashboards.
    const nowMs = Date.now();
    const expiredIds: string[] = [];
    const activeAppts = (appts ?? []).filter((a) => {
      const held = (a as { payment_hold_expires_at?: string | null; id?: string }).payment_hold_expires_at;
      const paid = (a as { payment_status?: string }).payment_status === "paid";
      const pending = a.status === "pending";
      if (!held || paid || !pending) return true;
      if (new Date(held).getTime() > nowMs) return true;
      const id = (a as { id?: string }).id;
      if (id) expiredIds.push(id);
      return false;
    });
    if (expiredIds.length > 0) {
      await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled" } as never)
        .in("id", expiredIds);
    }


    // Daily cap: if reached, block the date entirely.
    if (dailyCap != null && activeAppts.length >= Number(dailyCap)) {
      isBlocked = true;
    }

    // Apply buffer padding around each existing appointment so slots respect setup time.
    const padTime = (t: string, delta: number) => {
      const [h, m, s] = t.split(":").map(Number);
      const total = Math.max(0, h * 60 + m + delta);
      const hh = String(Math.floor(total / 60)).padStart(2, "0");
      const mm = String(total % 60).padStart(2, "0");
      return `${hh}:${mm}:${String(s ?? 0).padStart(2, "0")}`;
    };
    const paddedAppts = activeAppts.map((a) => ({
      ...a,
      start_time: bufferBefore ? padTime(a.start_time, -bufferBefore) : a.start_time,
      end_time: bufferAfter ? padTime(a.end_time, bufferAfter) : a.end_time,
    }));


    const { data: overrides } = await sb
      .from("availability_overrides")
      .select("start_time,end_time,slot_interval,location_id")
      .eq("profile_id", data.profileId)
      .eq("date", data.date);

    const { data: blockedTimes } = await sb
      .from("blocked_times")
      .select("start_time,end_time,location_id")
      .eq("profile_id", data.profileId)
      .eq("date", data.date);
    const blockedBusy = (blockedTimes ?? [])
      .filter((b) => !b.location_id || !data.locationId || b.location_id === data.locationId)
      .map((b) => ({ start_time: b.start_time, end_time: b.end_time, location_id: b.location_id, status: "blocked" }));

    // Overrides with a location only apply at that location; null = every location.
    const scopedOverrides = (overrides ?? []).filter(
      (o) => !o.location_id || !data.locationId || o.location_id === data.locationId,
    );

    // An ad-hoc slot added for this date is an explicit opening, so it beats a
    // closed/blocked day. The daily cap still applies.
    const capReached = dailyCap != null && activeAppts.length >= Number(dailyCap);
    const openingOverrides = hasLocationSpecificBlock
      ? scopedOverrides.filter((o) => o.location_id === data.locationId)
      : scopedOverrides;
    if (openingOverrides.length > 0 && !capReached) isBlocked = false;



    // Associate practitioners hosted inside another clinic can only take
    // bookings while a room is free at the host clinic.
    let roomBusy: { start_time: string; end_time: string; status: string; location_id: string | null }[] = [];
    try {
      const { associateRoomBusy } = await import("./associates.server");
      roomBusy = (await associateRoomBusy(supabaseAdmin, data.profileId, data.date)).map((b) => ({ ...b, location_id: null }));
    } catch (e) {
      console.error("[getDayAvailability] associate room check failed", e);
    }

    return { isBlocked, busy: [...paddedAppts, ...blockedBusy, ...roomBusy], overrides: openingOverrides };


  });



export const getMonthAvailability = createServerFn({ method: "GET" })
  .inputValidator((input: { profileId: string; year: number; month: number; locationId?: string | null }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const start = new Date(Date.UTC(data.year, data.month - 1, 1));
    const end = new Date(Date.UTC(data.year, data.month, 0));
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    const { data: rules } = await sb
      .from("availability_rules")
      .select("day_of_week,location_id,cycle_length,weeks_mask,effective_from,effective_to")
      .eq("profile_id", data.profileId);
    const { data: blocked } = await sb
      .from("blocked_dates")
      .select("date,location_id")
      .eq("profile_id", data.profileId)
      .gte("date", startIso)
      .lte("date", endIso);
    const { data: overrides } = await sb
      .from("availability_overrides")
      .select("date,location_id")
      .eq("profile_id", data.profileId)
      .gte("date", startIso)
      .lte("date", endIso);

    const { data: anchorRes } = await sb.rpc("get_rota_anchor", { p_profile_id: data.profileId });
    const anchorIso = (anchorRes as string | null) ?? null;
    const { ruleAppliesOnDate } = await import("@/lib/rota");

    const matchLoc = (rowLoc: string | null) =>
      !data.locationId || !rowLoc || rowLoc === data.locationId;
    const activeDays = Array.from(
      new Set((rules ?? []).filter((r) => matchLoc(r.location_id)).map((r) => r.day_of_week)),
    );
    const blockedDates = (blocked ?? []).filter((b) => matchLoc(b.location_id)).map((b) => b.date);
    // Dates closed specifically for the selected location: only an ad-hoc slot
    // scoped to that same location can re-open them.
    const locationBlockedDates = new Set(
      (blocked ?? [])
        .filter((b) => !!b.location_id && !!data.locationId && b.location_id === data.locationId)
        .map((b) => b.date),
    );
    const overrideDates = (overrides ?? [])
      .filter((o) => matchLoc(o.location_id))
      .filter((o) => !locationBlockedDates.has(o.date) || o.location_id === data.locationId)
      .map((o) => o.date);

    // Expand rota-aware open dates across the month
    const openDates: string[] = [];
    const monthDays = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
    for (let d = 1; d <= monthDays; d++) {
      const dt = new Date(Date.UTC(data.year, data.month - 1, d));
      const iso = dt.toISOString().slice(0, 10);
      const dow = dt.getUTCDay();
      const applicable = (rules ?? []).filter(
        (r) => r.day_of_week === dow && matchLoc(r.location_id) && ruleAppliesOnDate(r, iso, anchorIso),
      );
      if (applicable.length > 0) openDates.push(iso);
    }

    return { activeDays, blockedDates, overrideDates, openDates, rotaAnchor: anchorIso };
  });




export type PaymentChoice = {
  mode: "deposit" | "full" | "cash";
  method: "card" | "klarna" | "clearpay";
};

// A booking either hands the patient off to Stripe's hosted checkout page,
// or (when the practitioner has opted into save-card-on-file) renders our
// own embedded Stripe Elements form so we can hide Apple Pay / Google Pay /
// Link. Exactly one of these will be non-null.
export type BookingPaymentResult =
  | { kind: "hosted"; checkoutUrl: string }
  | {
      kind: "embedded";
      clientSecret: string;
      paymentIntentId: string;
      publishableKey: string;
      connectedAccountId: string;
      amountCents: number;
      currency: string;
      returnUrl: string;
    };

export const getPublicPaymentOptions = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select(
        "stripe_connect_account_id,stripe_connect_onboarding_status,payment_card_full_enabled,payment_deposit_enabled,require_deposit_to_confirm,payment_klarna_enabled,payment_clearpay_enabled,payment_pass_fees_to_customer,deposit_amount_cents,deposit_type,deposit_percent,payment_surcharge_card_enabled,payment_surcharge_card_percent,payment_surcharge_bnpl_enabled,payment_surcharge_bnpl_percent,payment_surcharge_deposit_enabled,payment_surcharge_deposit_percent,stripe_fee_pass_to_patient,stripe_fee_bnpl_pass_to_patient,stripe_fee_card_percent,stripe_fee_card_fixed_cents,stripe_fee_bnpl_percent,stripe_fee_bnpl_fixed_cents,allow_pay_in_clinic,cash_only_balance",
      )
      .eq("slug", data.slug.toLowerCase())
      .maybeSingle();
    if (!prof) {
      return { configured: false } as const;
    }
    const active = !!prof.stripe_connect_account_id
      && (!prof.stripe_connect_onboarding_status || prof.stripe_connect_onboarding_status === "active");
    const cashOnlyBalance = !!(prof as { cash_only_balance?: boolean }).cash_only_balance;
    const depositEnabled = !!prof.payment_deposit_enabled;
    const fullCardEnabled = prof.payment_card_full_enabled !== false && !cashOnlyBalance;
    return {
      configured: active,
      requireDepositToConfirm: !!prof.require_deposit_to_confirm || depositEnabled,
      // When cash-only-for-balance is on, patients cannot pay the full price online.
      cardEnabled: fullCardEnabled || depositEnabled,
      fullCardEnabled,
      klarnaEnabled: !!prof.payment_klarna_enabled && !cashOnlyBalance,
      clearpayEnabled: !!prof.payment_clearpay_enabled && !cashOnlyBalance,
      depositEnabled,
      cashEnabled: prof.allow_pay_in_clinic !== false,
      cashOnlyBalance,
      depositCents: Math.max(0, Number(prof.deposit_amount_cents ?? 0)),
      depositType: ((prof as { deposit_type?: string | null }).deposit_type as "fixed" | "percent" | null) === "percent" ? "percent" as const : "fixed" as const,
      depositPercent: Math.max(0, Math.min(100, Number((prof as { deposit_percent?: number | null }).deposit_percent ?? 0))),
      passFees: !!prof.payment_pass_fees_to_customer,
      surcharges: {
        cardPercent: prof.payment_surcharge_card_enabled ? Number(prof.payment_surcharge_card_percent ?? 0) : 0,
        bnplPercent: prof.payment_surcharge_bnpl_enabled ? Number(prof.payment_surcharge_bnpl_percent ?? 0) : 0,
        depositPercent: prof.payment_surcharge_deposit_enabled ? Number(prof.payment_surcharge_deposit_percent ?? 0) : 0,
      },
      stripeFee: {
        passToPatient: !!prof.stripe_fee_pass_to_patient,
        cardPercent: Number(prof.stripe_fee_card_percent ?? 0),
        cardFixedCents: Math.round(Number(prof.stripe_fee_card_fixed_cents ?? 0)),
        bnplPercent: Number(prof.stripe_fee_bnpl_percent ?? 0),
        bnplFixedCents: Math.round(Number(prof.stripe_fee_bnpl_fixed_cents ?? 0)),
      },
    } as const;
  });

export const requestBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      profileId: string;
      treatmentId: string;
      locationId?: string | null;
      date: string;
      startTime: string;
      endTime: string;
      patientName: string;
      patientEmail: string;
      patientPhone?: string;
      patientDob?: string | null;
      patientAddress?: {
        line1?: string;
        line2?: string;
        city?: string;
        postcode?: string;
        country?: string;
      } | null;
      notes?: string;
      basePrice: number;
      patientUserId?: string | null;
      practitionerId?: string | null;
      paymentChoice?: PaymentChoice | null;
    }) => input,
  )

  .handler(async ({ data }) => {
    const sb = publicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("auto_confirm_bookings,require_account_to_book,slug,clinic_name,stripe_connect_account_id,stripe_connect_onboarding_status,payment_deposit_enabled,require_deposit_to_confirm,deposit_amount_cents,deposit_type,deposit_percent,payment_card_full_enabled,payment_klarna_enabled,payment_clearpay_enabled,payment_pass_fees_to_customer,payment_surcharge_card_enabled,payment_surcharge_card_percent,payment_surcharge_bnpl_enabled,payment_surcharge_bnpl_percent,payment_surcharge_deposit_enabled,payment_surcharge_deposit_percent,stripe_fee_pass_to_patient,stripe_fee_bnpl_pass_to_patient,stripe_fee_card_percent,stripe_fee_card_fixed_cents,stripe_fee_bnpl_percent,stripe_fee_bnpl_fixed_cents,save_card_on_file")
      .eq("id", data.profileId)
      .maybeSingle();
    if (prof?.require_account_to_book && !data.patientUserId) {
      throw new Error("Please sign in to book — this clinic requires an account.");
    }
    const paymentChoice = normaliseBookingPaymentChoice(prof, data.paymentChoice ?? null);
    // Auto-confirm target status once we know payment isn't required. We always
    // insert as "pending" first so the notify_new_booking trigger doesn't fire
    // for bookings that end up abandoning Stripe checkout.
    const finalStatus = prof?.auto_confirm_bookings === false ? "pending" : "confirmed";
    const status = "pending";

    const { data: blk } = await sb
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", data.profileId)
      .ilike("email", data.patientEmail)
      .eq("is_blocked", true)
      .maybeSingle();
    if (blk) throw new Error("Unable to book online. Please contact the clinic directly.");

    // Idempotency guard: reject duplicate submissions of the same booking
    // (same clinic + treatment + slot + patient email) inside a 5-minute window.
    {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: dup } = await sb
        .from("appointments")
        .select("id,status,payment_status,payment_hold_expires_at")
        .eq("profile_id", data.profileId)
        .eq("treatment_id", data.treatmentId)
        .eq("scheduled_date", data.date)
        .eq("start_time", data.startTime)
        .ilike("patient_email", data.patientEmail)
        .gte("created_at", cutoff)
        .neq("status", "cancelled")
        .maybeSingle();
      if (dup) {
        const unpaidBooking = dup.payment_status !== "paid";
        if (unpaidBooking && bookingNeedsStripePayment(prof, paymentChoice, data.basePrice)) {
          await supabaseAdmin
            .from("appointments")
            .update({ status: "cancelled", payment_hold_expires_at: null } as never)
            .eq("id", dup.id as string)
            .neq("payment_status", "paid");
          // Kill the Stripe session/intent already issued for the superseded
          // appointment so the patient cannot complete both and pay twice.
          if (prof?.stripe_connect_account_id) {
            try {
              const { voidOpenBookingPayments } = await import("./stripe.server");
              await voidOpenBookingPayments({
                accountId: prof.stripe_connect_account_id,
                appointmentIds: [dup.id as string],
              });
            } catch (e) {
              console.error("[requestBooking] voiding superseded payment failed", e);
            }
          }
        } else {
          return { id: dup.id as string, consents: [], medicalForms: [], checkoutUrl: null, embeddedPayment: null };
        }
      }
    }


    const id = crypto.randomUUID();
    const { error } = await sb.from("appointments").insert({
      id,
      profile_id: data.profileId,
      treatment_id: data.treatmentId,
      location_id: data.locationId ?? null,
      practitioner_id: data.practitionerId ?? null,
      scheduled_date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      patient_name: data.patientName,
      patient_email: data.patientEmail,
      patient_phone: data.patientPhone ?? null,
      patient_dob: data.patientDob ?? null,
      patient_address: data.patientAddress ?? null,
      patient_user_id: data.patientUserId ?? null,
      notes: data.notes ?? null,
      status,
      payment_status: "pending",
      base_amount: data.basePrice,
      total_amount: data.basePrice,
    });
    if (error) throw new Error(error.message);


    // Create one appointment_consent row per consent template attached to the treatment
    const { data: links } = await sb
      .from("treatment_consents")
      .select("consent_template_id")
      .eq("treatment_id", data.treatmentId);

    const consents: { token: string; consent_template_id: string }[] = [];
    if (links && links.length > 0) {
      const templateIds = links.map((l) => l.consent_template_id);
      const { data: inserted, error: cErr } = await sb.rpc("create_appointment_consents", {
        p_appointment_id: id,
        p_template_ids: templateIds,
      });
      if (cErr) throw new Error(cErr.message);
      consents.push(...((inserted ?? []) as { token: string; consent_template_id: string }[]));
    }
    // Fetch medical forms auto-created by DB trigger
    const medicalForms: { token: string; appointment_id: string; template_name: string | null }[] = [];
    {
      const { data: mfs } = await sb
        .from("appointment_medical_forms")
        .select("token, appointment_id, medical_form_templates(name)")
        .eq("appointment_id", id);
      for (const f of mfs ?? []) {
        medicalForms.push({
          token: (f as { token: string }).token,
          appointment_id: (f as { appointment_id: string }).appointment_id,
          template_name: (f as { medical_form_templates?: { name?: string } | null }).medical_form_templates?.name ?? null,
        });
      }
    }
    // Optional Stripe payment for deposit / full payment (hosted checkout or
    // embedded Payment Element depending on the save-card-on-file setting).
    let payment: BookingPaymentResult | null = null;
    try {
      payment = await maybeCreateBookingCheckout({
        profile: prof,
        appointmentIds: [id],
        totalAmount: data.basePrice,
        patientEmail: data.patientEmail,
        description: `Booking with ${prof?.clinic_name ?? "clinic"}`,
        choice: paymentChoice,
        dedupeKey: bookingDedupeKey({
          profileId: data.profileId,
          patientEmail: data.patientEmail,
          date: data.date,
          startTime: data.startTime,
          treatmentIds: [data.treatmentId],
        }),
      });
    } catch (e) {
      console.error("[requestBooking] checkout failed", e);
      if (bookingNeedsStripePayment(prof, paymentChoice, data.basePrice)) {
        await supabaseAdmin
          .from("appointments")
          .update({ status: "cancelled", payment_hold_expires_at: null } as never)
          .eq("id", id)
          .eq("status", "pending")
          .eq("payment_status", "pending");
        throw new Error("Card payment could not be started. Please try again — your appointment has not been confirmed.");
      }
    }
    if (!payment && bookingNeedsStripePayment(prof, paymentChoice, data.basePrice)) {
      await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled", payment_hold_expires_at: null } as never)
        .eq("id", id)
        .eq("status", "pending")
        .eq("payment_status", "pending");
      throw new Error("Card payment could not be started. Please try again — your appointment has not been confirmed.");
    }
    // If we handed the patient off to Stripe, hold the slot briefly. If they
    // abandon the payment the hold expires and availability re-opens; the
    // webhook clears the hold and confirms the appointment on success.
    if (payment) {
      const holdUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("appointments")
        .update({ status: "pending", payment_hold_expires_at: holdUntil } as never)
        .eq("id", id);
    }

    // No Stripe payment required: promote to the practitioner's normal status
    // (usually "confirmed"). This UPDATE transition is what fires the new-booking
    // notification trigger — so it only fires for real, non-abandoned bookings.
    if (!payment) {
      await supabaseAdmin
        .from("appointments")
        .update({ status: finalStatus } as never)
        .eq("id", id);
    }

    // Fire booking confirmation email now for non-Stripe bookings. Bookings
    // routed through Stripe are emailed by the webhook once payment succeeds
    // so patients don't get "confirmed" before they've paid.
    if (!payment && data.patientEmail) {
      try {
        const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
        await sendBookingConfirmationEmails([id]);
      } catch (e) { console.error("[requestBooking] email failed", e); }
    }

    // If this practitioner is an associate hosted by another clinic, reserve a
    // room unit at the host clinic for the appointment window.
    try {
      const { allocateRoomForAppointment } = await import("./associates.server");
      await allocateRoomForAppointment(id);
    } catch (e) {
      console.error("[requestBooking] associate room allocation failed", e);
    }

    const checkoutUrl = payment?.kind === "hosted" ? payment.checkoutUrl : null;

    const embeddedPayment = payment?.kind === "embedded" ? payment : null;
    return { id, consents, medicalForms, checkoutUrl, embeddedPayment };
  });



// Build a Checkout Session on the practitioner's Connect account for a deposit
// (or full amount) when the clinic has payments configured. Returns the hosted URL
// or null if payments aren't set up / not required.
async function maybeCreateBookingCheckout(args: {
  profile: {
    slug?: string | null;
    stripe_connect_account_id?: string | null;
    stripe_connect_onboarding_status?: string | null;
    payment_deposit_enabled?: boolean | null;
    require_deposit_to_confirm?: boolean | null;
    deposit_amount_cents?: number | null;
    deposit_type?: string | null;
    deposit_percent?: number | string | null;
    payment_card_full_enabled?: boolean | null;
    payment_klarna_enabled?: boolean | null;
    payment_clearpay_enabled?: boolean | null;
    payment_pass_fees_to_customer?: boolean | null;
    payment_surcharge_card_enabled?: boolean | null;
    payment_surcharge_card_percent?: number | string | null;
    payment_surcharge_bnpl_enabled?: boolean | null;
    payment_surcharge_bnpl_percent?: number | string | null;
    payment_surcharge_deposit_enabled?: boolean | null;
    payment_surcharge_deposit_percent?: number | string | null;
    stripe_fee_pass_to_patient?: boolean | null;
    stripe_fee_card_percent?: number | string | null;
    stripe_fee_card_fixed_cents?: number | string | null;
    stripe_fee_bnpl_percent?: number | string | null;
    stripe_fee_bnpl_fixed_cents?: number | string | null;
    save_card_on_file?: boolean | null;
    clinic_name?: string | null;
  } | null;
  appointmentIds: string[];
  totalAmount: number;
  patientEmail: string;
  description: string;
  choice?: PaymentChoice | null;
  // Stable identity of the booking attempt (clinic + patient + slot + treatments),
  // independent of the freshly generated appointment ids. Combined with the
  // amount and payment method it becomes the Stripe idempotency key, so two
  // concurrent submissions of the same booking share ONE payable session.
  dedupeKey?: string;
}): Promise<BookingPaymentResult | null> {
  const p = args.profile;
  if (!p) return null;
  // Free bookings (£0) never require a deposit or checkout, regardless of the
  // clinic's default deposit policy — the treatment itself has no charge.
  if (!(args.totalAmount > 0)) return null;

  // Patient chose to pay in cash at the appointment — skip Stripe only when
  // this clinic has not made an upfront deposit mandatory. Never trust a stale
  // client-side cash choice to bypass a required deposit/card capture.
  if (args.choice?.mode === "cash" && !depositRequiredForProfile(p)) return null;
  if (!p.stripe_connect_account_id) return null;
  if (p.stripe_connect_onboarding_status && p.stripe_connect_onboarding_status !== "active") return null;


  const depositEnabled = !!p.payment_deposit_enabled;
  const depositPer = Math.max(0, Number(p.deposit_amount_cents ?? 0));
  const depositTypeMode: "fixed" | "percent" = (p.deposit_type === "percent") ? "percent" : "fixed";
  const depositPct = Math.max(0, Math.min(100, Number(p.deposit_percent ?? 0)));
  const fullEnabled = p.payment_card_full_enabled !== false
    || !!p.payment_klarna_enabled
    || !!p.payment_clearpay_enabled;

  // Look up per-treatment deposit overrides for the appointments in this booking.
  // Treatment-level `deposit_amount` (in GBP) always wins. Otherwise use the
  // clinic default: a fixed £ amount, or a % of the treatment price.
  async function computeDepositTotalCents(): Promise<number> {
    if (args.appointmentIds.length === 0) return 0;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("appointments")
        .select("treatments(deposit_amount, price)")
        .in("id", args.appointmentIds);
      let total = 0;
      for (const r of rows ?? []) {
        const t = (r as { treatments?: { deposit_amount?: number | null; price?: number | null } | null }).treatments;
        const override = t?.deposit_amount != null ? Math.round(Number(t.deposit_amount) * 100) : null;
        if (override != null && override > 0) {
          total += override;
        } else if (depositTypeMode === "percent" && depositPct > 0) {
          const priceCents = Math.round(Number(t?.price ?? 0) * 100);
          total += Math.round((priceCents * depositPct) / 100);
        } else {
          total += depositPer;
        }
      }
      return total;
    } catch {
      return depositPer * args.appointmentIds.length;
    }
  }

  // Decide deposit vs full based on the patient's explicit choice when given,
  // otherwise fall back to legacy behaviour (deposit if configured).
  let kind: "deposit" | "checkout";
  let amountCents: number;
  // Patient's explicit "full" choice always wins — paying the full amount
  // (including via Klarna/Clearpay on the practitioner's Stripe account)
  // satisfies any deposit requirement. Only fall back to forcing a deposit
  // when the patient hasn't opted for full payment.
  const wantsDeposit = args.choice?.mode === "full"
    ? false
    : depositRequiredForProfile(p)
    ? true
    : args.choice
    ? args.choice.mode === "deposit"
    : depositEnabled && (depositPer >= 100 || (depositTypeMode === "percent" && depositPct > 0));
  if (wantsDeposit && depositEnabled) {
    amountCents = await computeDepositTotalCents();
    if (amountCents < 100) return null;
    kind = "deposit";
  } else if (fullEnabled) {
    amountCents = Math.round(args.totalAmount * 100);
    kind = "checkout";
  } else {
    return null;
  }
  if (amountCents < 100) return null;


  // Build allowed methods. When the patient picked one, restrict Stripe to
  // just that method so the fee we add matches the chosen rail exactly.
  const enabled = {
    card: p.payment_card_full_enabled !== false,
    klarna: !!p.payment_klarna_enabled,
    clearpay: !!p.payment_clearpay_enabled,
  };
  let methodTypes: string[] = [];
  if (args.choice) {
    const m = args.choice.method;
    if (m === "card" && enabled.card) methodTypes = ["card"];
    else if (m === "klarna" && enabled.klarna) methodTypes = ["klarna"];
    else if (m === "clearpay" && enabled.clearpay) methodTypes = ["afterpay_clearpay"];
  }
  if (methodTypes.length === 0) {
    if (enabled.card) methodTypes.push("card");
    if (enabled.klarna) methodTypes.push("klarna");
    if (enabled.clearpay) methodTypes.push("afterpay_clearpay");
    if (methodTypes.length === 0) methodTypes.push("card");
  }

  // Practitioner-set platform fee. When the patient picked a method we apply
  // the exact percentage for that rail; otherwise apply the worst-case among
  // the enabled methods so the practitioner nets the intended amount.
  const cardPct = p.payment_surcharge_card_enabled ? Number(p.payment_surcharge_card_percent ?? 0) : 0;
  const bnplPct = p.payment_surcharge_bnpl_enabled ? Number(p.payment_surcharge_bnpl_percent ?? 0) : 0;
  const depPct = p.payment_surcharge_deposit_enabled ? Number(p.payment_surcharge_deposit_percent ?? 0) : 0;
  let pct = 0;
  if (kind === "deposit") {
    pct = depPct;
  } else if (args.choice) {
    pct = args.choice.method === "card" ? cardPct : bnplPct;
  } else {
    const bnplOn = methodTypes.includes("klarna") || methodTypes.includes("afterpay_clearpay");
    pct = Math.max(cardPct, bnplOn ? bnplPct : 0);
  }
  let surchargeCents = pct > 0 ? Math.ceil((amountCents * pct) / 100) : 0;

  // Optionally add Stripe's own processing fee (rate% + fixed) for the chosen rail.
  {
    const isBnpl = args.choice
      ? args.choice.method === "klarna" || args.choice.method === "clearpay"
      : methodTypes.includes("klarna") || methodTypes.includes("afterpay_clearpay");
    const cardPassOn = !!p.stripe_fee_pass_to_patient;
    const bnplPassOn = !!(p as { stripe_fee_bnpl_pass_to_patient?: boolean }).stripe_fee_bnpl_pass_to_patient;
    const passOn = isBnpl ? bnplPassOn : cardPassOn;
    if (passOn) {
      const stripePct = Number((isBnpl ? p.stripe_fee_bnpl_percent : p.stripe_fee_card_percent) ?? 0);
      const stripeFixed = Math.round(Number((isBnpl ? p.stripe_fee_bnpl_fixed_cents : p.stripe_fee_card_fixed_cents) ?? 0));
      const stripeCents = Math.ceil((amountCents * stripePct) / 100) + Math.max(0, stripeFixed);
      surchargeCents += stripeCents;
    }
  }


  const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
  const successUrl = `${origin}/m/${p.slug ?? ""}/account?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/m/${p.slug ?? ""}`;

  const saveCardOnFile = !!p.save_card_on_file;
  const chosenMethod = kind === "deposit" ? "card" : args.choice?.method;
  const effectivelyCard =
    kind === "deposit" || chosenMethod === "card" || (!chosenMethod && enabled.card);
  // Deposits paid by card must both take the deposit and attach the card to
  // the connected Stripe Customer for the clinic's no-show / late-cancel file.
  const shouldSaveCardOnFile = effectivelyCard && (saveCardOnFile || kind === "deposit");
  const metadata = {
    appointment_ids: args.appointmentIds.join(","),
    kind,
    surcharge_cents: String(surchargeCents),
    save_card_on_file: shouldSaveCardOnFile ? "1" : "0",
    patient_email: args.patientEmail,
  };

  // Idempotency key for Stripe: same booking + same amount + same rail inside
  // the same short window => Stripe returns the FIRST object instead of a
  // second payable one. This is what prevents a double click / double tab /
  // retried request from producing two chargeable payments.
  const idempotencyKey = args.dedupeKey
    ? `modo:${args.dedupeKey}:${kind}:${amountCents + surchargeCents}:${[...methodTypes].sort().join("-")}:${Math.floor(Date.now() / (10 * 60 * 1000))}`
    : undefined;


  // Save-card-on-file: skip Stripe's hosted checkout entirely (it re-adds
  // Apple Pay + Link even when payment_method_types is ['card']) and drive an
  // embedded Payment Element on our own page. Wallets and Link are hidden
  // client-side. The total charged still includes any platform surcharge.
  // Only route to the embedded save-card flow when the patient is paying by
  // card. Klarna / Clearpay don't produce a reusable off-session card token,
  // so those must go through hosted Stripe Checkout on the practitioner's
  // connected account as normal.
  // Route to embedded save-card whenever the effective payment is card:
  // either the patient explicitly picked card, or they didn't pick anything
  // and card is enabled (default). Klarna / Clearpay explicit picks skip
  // this and go through hosted Checkout since they can't save a reusable card.
  if (effectivelyCard) {
    // Force card-only for this intent so surcharge math and the Payment
    // Element render match.
    methodTypes = ["card"];
    try {
      const { createSaveCardPaymentIntent } = await import("./stripe.server");
      const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        console.error("[maybeCreateBookingCheckout] STRIPE_PUBLISHABLE_KEY missing");
        return null;
      }
      const totalCents = amountCents + surchargeCents;
      const intent = await createSaveCardPaymentIntent({
        accountId: p.stripe_connect_account_id,
        amountCents: totalCents,
        currency: "gbp",
        customerEmail: args.patientEmail,
        description: kind === "deposit" ? `Deposit — ${args.description}` : args.description,
        metadata,
        saveForFutureUse: shouldSaveCardOnFile,
        descriptorName: p.clinic_name,
        idempotencyKey,
      });
      if (!intent.clientSecret) return null;
      const returnUrl = `${origin}/m/${p.slug ?? ""}/account?paid=1&pi=${intent.paymentIntentId}`;
      return {
        kind: "embedded",
        clientSecret: intent.clientSecret,
        paymentIntentId: intent.paymentIntentId,
        publishableKey,
        connectedAccountId: p.stripe_connect_account_id,
        amountCents: totalCents,
        currency: "gbp",
        returnUrl,
      };
    } catch (e) {
      console.error("[maybeCreateBookingCheckout] save-card PI error", e);
      return null;
    }
  }

  try {
    const { createCheckoutSession } = await import("./stripe.server");
    const lineItems: Array<{
      quantity: number;
      price_data: {
        currency: string;
        unit_amount: number;
        product_data: { name: string };
      };
    }> = [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amountCents,
          product_data: {
            name: kind === "deposit" ? `Deposit — ${args.description}` : args.description,
          },
        },
      },
    ];
    if (surchargeCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: surchargeCents,
          product_data: { name: "Platform fee" },
        },
      });
    }
    const session = await createCheckoutSession({
      accountId: p.stripe_connect_account_id,
      lineItems,
      successUrl,
      cancelUrl,
      customerEmail: args.patientEmail,
      paymentMethodTypes: methodTypes as never,
      saveCardOnFile: false,
      metadata,
      descriptorName: p.clinic_name,
      idempotencyKey,
    });
    if (!session.url) return null;
    return { kind: "hosted", checkoutUrl: session.url };
  } catch (e) {
    console.error("[maybeCreateBookingCheckout] stripe error", e);
    return null;
  }
}




/**
 * Stable identity for a booking attempt: same clinic, patient, slot and
 * treatments => same key, regardless of the appointment row ids generated on
 * this particular submission.
 */
function bookingDedupeKey(input: {
  profileId: string;
  patientEmail: string;
  date: string;
  startTime: string;
  treatmentIds: string[];
}) {
  return [
    input.profileId,
    input.patientEmail.trim().toLowerCase(),
    input.date,
    input.startTime,
    [...input.treatmentIds].sort().join("+"),
  ].join("|");
}

function addMinutesToTime(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function bookingNeedsStripePayment(
  profile: {
    stripe_connect_account_id?: string | null;
    stripe_connect_onboarding_status?: string | null;
    payment_deposit_enabled?: boolean | null;
    require_deposit_to_confirm?: boolean | null;
    deposit_amount_cents?: number | null;
    deposit_type?: string | null;
    deposit_percent?: number | string | null;
    payment_card_full_enabled?: boolean | null;
    payment_klarna_enabled?: boolean | null;
    payment_clearpay_enabled?: boolean | null;
  } | null,
  choice?: PaymentChoice | null,
  totalAmount?: number,
) {
  // Free bookings (£0) never require a Stripe payment, regardless of choice.
  if (totalAmount != null && !(totalAmount > 0)) return false;
  if (choice?.mode === "cash") return false;
  if (choice?.mode === "deposit" || choice?.mode === "full") return true;
  if (!profile) return false;
  if (!profile.stripe_connect_account_id) return false;
  if (profile.stripe_connect_onboarding_status && profile.stripe_connect_onboarding_status !== "active") return false;
  const depositConfigured =
    !!profile.require_deposit_to_confirm ||
    (!!profile.payment_deposit_enabled && Math.max(0, Number(profile.deposit_amount_cents ?? 0)) >= 100);
  const onlinePaymentConfigured =
    profile.payment_card_full_enabled !== false ||
    !!profile.payment_klarna_enabled ||
    !!profile.payment_clearpay_enabled;
  return depositConfigured || onlinePaymentConfigured;
}

function depositRequiredForProfile(profile: { payment_deposit_enabled?: boolean | null; require_deposit_to_confirm?: boolean | null } | null) {
  return !!profile && (!!profile.require_deposit_to_confirm || !!profile.payment_deposit_enabled);
}

function normaliseBookingPaymentChoice(
  profile: { payment_deposit_enabled?: boolean | null; require_deposit_to_confirm?: boolean | null } | null,
  choice?: PaymentChoice | null,
): PaymentChoice | null {
  // Deposits are mandatory whenever the clinic enables deposits, and deposits
  // must be card-only so Stripe can both charge today and save the card for file.
  if (choice?.mode === "deposit" || (depositRequiredForProfile(profile) && choice?.mode !== "full")) {
    return { mode: "deposit", method: "card" };
  }
  return choice ?? null;
}

export const requestMultiBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      profileId: string;
      bookings: {
        treatmentId: string;
        durationMin: number;
        priceCents: number;
        sessionCount?: number;
        paymentPlan?: "full" | "split";
        clinicVisitId?: string | null;
      }[];

      locationId?: string | null;
      date: string;
      startTime: string;
      patientName: string;
      patientEmail: string;
      patientPhone?: string;
      patientDob?: string | null;
      patientAddress?: {
        line1?: string;
        line2?: string;
        city?: string;
        postcode?: string;
        country?: string;
      } | null;
      notes?: string;
      patientUserId?: string | null;
      practitionerId?: string | null;
      packagePurchases?: { packageId: string }[];
      paymentChoice?: PaymentChoice | null;
    }) => input,
  )

  .handler(async ({ data }) => {
    const sb = publicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("auto_confirm_bookings,require_account_to_book,slug,clinic_name,stripe_connect_account_id,stripe_connect_onboarding_status,payment_deposit_enabled,require_deposit_to_confirm,deposit_amount_cents,deposit_type,deposit_percent,payment_card_full_enabled,payment_klarna_enabled,payment_clearpay_enabled,payment_pass_fees_to_customer,payment_surcharge_card_enabled,payment_surcharge_card_percent,payment_surcharge_bnpl_enabled,payment_surcharge_bnpl_percent,payment_surcharge_deposit_enabled,payment_surcharge_deposit_percent,stripe_fee_pass_to_patient,stripe_fee_bnpl_pass_to_patient,stripe_fee_card_percent,stripe_fee_card_fixed_cents,stripe_fee_bnpl_percent,stripe_fee_bnpl_fixed_cents,save_card_on_file")
      .eq("id", data.profileId)
      .maybeSingle();
    if (prof?.require_account_to_book && !data.patientUserId) {
      throw new Error("Please sign in to book — this clinic requires an account.");
    }
    const paymentChoice = normaliseBookingPaymentChoice(prof, data.paymentChoice ?? null);
    const finalStatus = prof?.auto_confirm_bookings === false ? "pending" : "confirmed";
    const status = "pending";
    const { data: blk } = await sb
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", data.profileId)
      .ilike("email", data.patientEmail)
      .eq("is_blocked", true)
      .maybeSingle();
    if (blk) throw new Error("Unable to book online. Please contact the clinic directly.");

    // Idempotency: if the exact same multi-booking (same clinic, patient email,
    // date + start time, and treatment ids) was submitted in the last 5 minutes,
    // return the existing appointments instead of duplicating them.
    {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const treatmentIds = data.bookings.map((b) => b.treatmentId);
      const { data: recent } = await sb
        .from("appointments")
        .select("id, treatment_id, start_time, status, payment_status, payment_hold_expires_at")
        .eq("profile_id", data.profileId)
        .eq("scheduled_date", data.date)
        .in("treatment_id", treatmentIds)
        .ilike("patient_email", data.patientEmail)
        .gte("created_at", cutoff)
        .neq("status", "cancelled");
      if (recent && recent.length >= data.bookings.length) {
        const existing = recent
          .filter((r) => treatmentIds.includes(r.treatment_id as string))
          .slice(0, data.bookings.length)
          .map((r) => ({ id: r.id as string, treatmentId: r.treatment_id as string }));
        if (existing.length === data.bookings.length) {
          const unpaidBooking = recent
            .filter((r) => existing.some((e) => e.id === (r.id as string)))
            .every((r) => r.payment_status !== "paid");
          if (unpaidBooking && bookingNeedsStripePayment(prof, paymentChoice, data.bookings.reduce((s, b) => s + b.priceCents / 100, 0))) {
            await supabaseAdmin
              .from("appointments")
              .update({ status: "cancelled", payment_hold_expires_at: null } as never)
              .in("id", existing.map((e) => e.id))
              .neq("payment_status", "paid");
            // Void the Stripe session/intent already issued for the superseded
            // appointments so only the new one can be paid.
            if (prof?.stripe_connect_account_id) {
              try {
                const { voidOpenBookingPayments } = await import("./stripe.server");
                await voidOpenBookingPayments({
                  accountId: prof.stripe_connect_account_id,
                  appointmentIds: existing.map((e) => e.id),
                });
              } catch (e) {
                console.error("[requestMultiBooking] voiding superseded payment failed", e);
              }
            }
          } else {
            return { appointments: existing, consents: [], medicalForms: [], packagePurchases: [], checkoutUrl: null, embeddedPayment: null };
          }
        }
      }
    }

    let cursor = data.startTime;
    const created: { id: string; treatmentId: string }[] = [];
    const consents: { token: string; consent_template_id: string }[] = [];
    for (const b of data.bookings) {
      const id = crypto.randomUUID();
      const end = addMinutesToTime(cursor, b.durationMin);
      const sessionCount = Math.max(1, Number(b.sessionCount ?? 1));
      const paymentNote = sessionCount > 1
        ? b.paymentPlan === "split"
          ? `Payment plan: Pay over ${sessionCount} appointments (£${((b.priceCents / 100) / sessionCount).toFixed(2)} per appointment)`
          : `Payment plan: Pay in full for ${sessionCount} appointments`
        : null;
      const appointmentNotes = [data.notes, paymentNote].filter(Boolean).join("\n") || null;
      const { error } = await sb.from("appointments").insert({
        id,
        profile_id: data.profileId,
        treatment_id: b.treatmentId,
        location_id: data.locationId ?? null,
        practitioner_id: data.practitionerId ?? null,
        scheduled_date: data.date,
        start_time: cursor,
        end_time: end,
        patient_name: data.patientName,
        patient_email: data.patientEmail,
        patient_phone: data.patientPhone ?? null,
        patient_dob: data.patientDob ?? null,
        patient_address: data.patientAddress ?? null,
        patient_user_id: data.patientUserId ?? null,
        clinic_visit_id: b.clinicVisitId ?? null,
        notes: appointmentNotes,
        status,
        payment_status: "pending",
        base_amount: b.priceCents / 100,
        total_amount: sessionCount > 1 && b.paymentPlan === "split"
          ? (b.priceCents / 100) / sessionCount
          : b.priceCents / 100,
      } as never);


      if (error) throw new Error(error.message);
      created.push({ id, treatmentId: b.treatmentId });

      const { data: links } = await sb
        .from("treatment_consents")
        .select("consent_template_id")
        .eq("treatment_id", b.treatmentId);
      if (links && links.length > 0) {
        const templateIds = links.map((l) => l.consent_template_id);
        const { data: inserted, error: cErr } = await sb.rpc("create_appointment_consents", {
          p_appointment_id: id,
          p_template_ids: templateIds,
        });
        if (cErr) throw new Error(cErr.message);
        consents.push(...((inserted ?? []) as { token: string; consent_template_id: string }[]));
      }

      cursor = end;
    }

    // The DB trigger create_appointment_medical_forms generated rows on insert;
    // return their tokens so the confirmation page can link the patient straight
    // into completing them.
    const apptIds = created.map((c) => c.id);
    const medicalForms: { token: string; appointment_id: string; template_name: string | null }[] = [];
    if (apptIds.length > 0) {
      const { data: forms } = await supabaseAdmin
        .from("appointment_medical_forms")
        .select("token, appointment_id, medical_form_templates(name)")
        .in("appointment_id", apptIds);
      for (const f of forms ?? []) {
        medicalForms.push({
          token: f.token as string,
          appointment_id: f.appointment_id as string,
          template_name: (f as { medical_form_templates?: { name?: string } | null }).medical_form_templates?.name ?? null,
        });
      }
    }

    // Persist package purchases (session 1 = the appointment we just booked; remaining sessions tracked here)
    const packagePurchases: { id: string; packageId: string; sessionsRemaining: number }[] = [];
    if (data.packagePurchases && data.packagePurchases.length > 0) {
      const pkgIds = data.packagePurchases.map((p) => p.packageId);
      const { data: pkgs } = await supabaseAdmin
        .from("packages")
        .select("id, session_count, expiry_days")
        .in("id", pkgIds);
      for (const p of data.packagePurchases) {
        const meta = (pkgs ?? []).find((x) => x.id === p.packageId);
        const sessions = Math.max(1, Number(meta?.session_count ?? 1));
        const remaining = Math.max(0, sessions - 1);
        const expDays = (meta?.expiry_days as number | null) ?? null;
        const expiresAt = expDays
          ? new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const purchaseId = crypto.randomUUID();
        const { error: purchErr } = await supabaseAdmin.from("package_purchases").insert({
          id: purchaseId,
          package_id: p.packageId,
          patient_email: data.patientEmail,
          sessions_remaining: remaining,
          expires_at: expiresAt,
          status: "active",
        } as never);
        if (purchErr) throw new Error(purchErr.message);
        // Count the claim against any limited-time allocation
        await (supabaseAdmin as never as { rpc: (n: string, a: Record<string, unknown>) => Promise<unknown> })
          .rpc("increment_package_claim", { p_package_id: p.packageId });
        packagePurchases.push({ id: purchaseId, packageId: p.packageId, sessionsRemaining: remaining });
      }
    }

    let payment: BookingPaymentResult | null = null;
    try {
      const totalAmount = data.bookings.reduce((sum, b) => sum + b.priceCents / 100, 0);
      payment = await maybeCreateBookingCheckout({
        profile: prof,
        appointmentIds: created.map((c) => c.id),
        totalAmount,
        patientEmail: data.patientEmail,
        description: `Booking with ${prof?.clinic_name ?? "clinic"}`,
        choice: paymentChoice,
        dedupeKey: bookingDedupeKey({
          profileId: data.profileId,
          patientEmail: data.patientEmail,
          date: data.date,
          startTime: data.startTime,
          treatmentIds: data.bookings.map((b) => b.treatmentId),
        }),
      });

    } catch (e) {
      console.error("[requestMultiBooking] checkout failed", e);
      if (bookingNeedsStripePayment(prof, paymentChoice, data.bookings.reduce((s, b) => s + b.priceCents / 100, 0)) && created.length > 0) {
        await supabaseAdmin
          .from("appointments")
          .update({ status: "cancelled", payment_hold_expires_at: null } as never)
          .in("id", created.map((c) => c.id))
          .eq("status", "pending")
          .eq("payment_status", "pending");
        throw new Error("Card payment could not be started. Please try again — your appointments have not been confirmed.");
      }
    }
    if (!payment && bookingNeedsStripePayment(prof, paymentChoice, data.bookings.reduce((s, b) => s + b.priceCents / 100, 0)) && created.length > 0) {
      await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled", payment_hold_expires_at: null } as never)
        .in("id", created.map((c) => c.id))
        .eq("status", "pending")
        .eq("payment_status", "pending");
      throw new Error("Card payment could not be started. Please try again — your appointments have not been confirmed.");
    }
    // Slot hold while patient completes Stripe payment; abandoned bookings
    // auto-release when the hold expires (see getDayAvailability filter).
    if (payment && created.length > 0) {
      const holdUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("appointments")
        .update({ status: "pending", payment_hold_expires_at: holdUntil } as never)
        .in("id", created.map((c) => c.id));
    }

    // No Stripe payment required: promote from the placeholder "pending" state
    // to the practitioner's normal status so the new-booking trigger fires.
    if (!payment && created.length > 0) {
      await supabaseAdmin
        .from("appointments")
        .update({ status: finalStatus } as never)
        .in("id", created.map((c) => c.id));
    }

    // Non-payment bookings should still receive confirmations. Payment bookings
    // are confirmed by the webhook after money is taken.
    if (!payment && data.patientEmail && created.length > 0) {
      try {
        const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
        await sendBookingConfirmationEmails(created.map((c) => c.id));
      } catch (e) { console.error("[requestMultiBooking] email failed", e); }
    }

    const checkoutUrl = payment?.kind === "hosted" ? payment.checkoutUrl : null;
    const embeddedPayment = payment?.kind === "embedded" ? payment : null;
    return { appointments: created, consents, medicalForms, packagePurchases, checkoutUrl, embeddedPayment };

  });



