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
      .select("id, profile_id, name, address_line1, address_line2, city, postcode, country, is_primary, display_order, active, created_at, updated_at, image_url")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("is_primary", { ascending: false });

    const { data: rules } = await sb
      .from("availability_rules")
      .select("*")
      .eq("profile_id", profile.id);

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
      modelSlots: modelSlots ?? [],
      bookableFrom,
      settings,
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
  };
}


export const getMultiBookingContext = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; treatmentIds: string[] }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: profile, error: pErr } = await sb
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;
    if (!profile) throw new Error("Clinic not found");

    const { data: treatments, error: tErr } = await sb
      .from("treatments")
      .select("*")
      .in("id", data.treatmentIds)
      .eq("profile_id", profile.id)
      .eq("active", true);
    if (tErr) throw tErr;

    const { data: locations } = await sb
      .from("locations")
      .select("id, profile_id, name, address_line1, address_line2, city, postcode, country, is_primary, display_order, active, created_at, updated_at, image_url")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("is_primary", { ascending: false });

    const { data: rules } = await sb
      .from("availability_rules")
      .select("*")
      .eq("profile_id", profile.id);

    const { data: theme } = await sb
      .from("clinic_theme")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const { data: pricing } = await sb
      .from("treatment_location_pricing")
      .select("*")
      .in("treatment_id", data.treatmentIds);

    const bookableFrom = await computeBookableFrom(
      sb,
      profile.id,
      (treatments ?? []).map((t) => (t as { category_id: string | null }).category_id),
    );

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
    };
  });



export const getDayAvailability = createServerFn({ method: "GET" })
  .inputValidator((input: { profileId: string; date: string; locationId?: string | null }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    // Use admin client to read appointments — anon has no SELECT policy on appointments,
    // so without this booked slots would not appear as busy to public visitors.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: blockedRows } = await sb
      .from("blocked_dates")
      .select("id,location_id")
      .eq("profile_id", data.profileId)
      .eq("date", data.date);
    const isBlocked = (blockedRows ?? []).some(
      (b) => !b.location_id || !data.locationId || b.location_id === data.locationId,
    );

    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("start_time,end_time,location_id,status")
      .eq("profile_id", data.profileId)
      .eq("scheduled_date", data.date)
      .neq("status", "cancelled");

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

    return { isBlocked, busy: [...(appts ?? []), ...blockedBusy], overrides: overrides ?? [] };
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
      .select("day_of_week,location_id")
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

    const matchLoc = (rowLoc: string | null) =>
      !data.locationId || !rowLoc || rowLoc === data.locationId;
    const activeDays = Array.from(
      new Set((rules ?? []).filter((r) => matchLoc(r.location_id)).map((r) => r.day_of_week)),
    );
    const blockedDates = (blocked ?? []).filter((b) => matchLoc(b.location_id)).map((b) => b.date);
    const overrideDates = (overrides ?? []).filter((o) => matchLoc(o.location_id)).map((o) => o.date);
    return { activeDays, blockedDates, overrideDates };
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
    }) => input,
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: blk } = await sb
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", data.profileId)
      .ilike("email", data.patientEmail)
      .eq("is_blocked", true)
      .maybeSingle();
    if (blk) throw new Error("Unable to book online. Please contact the clinic directly.");
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
      status: "confirmed",
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
    return { id, consents };
  });


function addMinutesToTime(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
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
    }) => input,
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: blk } = await sb
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", data.profileId)
      .ilike("email", data.patientEmail)
      .eq("is_blocked", true)
      .maybeSingle();
    if (blk) throw new Error("Unable to book online. Please contact the clinic directly.");
    let cursor = data.startTime;
    const created: { id: string; treatmentId: string }[] = [];
    const consents: { token: string; consent_template_id: string }[] = [];
    for (const b of data.bookings) {
      const id = crypto.randomUUID();
      const end = addMinutesToTime(cursor, b.durationMin);
      const sessionCount = Math.max(1, Number(b.sessionCount ?? 1));
      const paymentNote = sessionCount > 1
        ? b.paymentPlan === "split"
          ? `Payment plan: Split into ${sessionCount} sessions (£${((b.priceCents / 100) / sessionCount).toFixed(2)} per session)`
          : `Payment plan: Pay in full for ${sessionCount} sessions`
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
        notes: appointmentNotes,
        status: "confirmed",
        payment_status: "pending",
        base_amount: b.priceCents / 100,
        total_amount: sessionCount > 1 && b.paymentPlan === "split"
          ? (b.priceCents / 100) / sessionCount
          : b.priceCents / 100,
      });

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
    return { appointments: created, consents };
  });

