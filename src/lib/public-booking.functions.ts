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

    return {
      profileId: profile.id,
      clinicName: profile.clinic_name,
      treatment,
      locations: locations ?? [],
      rules: rules ?? [],
      theme: theme ?? null,
      brandColor: (profile as { brand_color?: string | null }).brand_color ?? null,
    };
  });

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

    return {
      profileId: profile.id,
      clinicName: profile.clinic_name,
      treatments: treatments ?? [],
      pricing: pricing ?? [],
      locations: locations ?? [],
      rules: rules ?? [],
      theme: theme ?? null,
      brandColor: (profile as { brand_color?: string | null }).brand_color ?? null,
    };
  });



export const getDayAvailability = createServerFn({ method: "GET" })
  .inputValidator((input: { profileId: string; date: string; locationId?: string | null }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: blockedRows } = await sb
      .from("blocked_dates")
      .select("id,location_id")
      .eq("profile_id", data.profileId)
      .eq("date", data.date);
    const isBlocked = (blockedRows ?? []).some(
      (b) => !b.location_id || !data.locationId || b.location_id === data.locationId,
    );

    const { data: appts } = await sb
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

    return { isBlocked, busy: appts ?? [], overrides: overrides ?? [] };
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
    }) => input,
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const id = crypto.randomUUID();
    const { error } = await sb.from("appointments").insert({
      id,
      profile_id: data.profileId,
      treatment_id: data.treatmentId,
      location_id: data.locationId ?? null,
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
      const rows = links.map((l) => ({
        appointment_id: id,
        consent_template_id: l.consent_template_id,
        profile_id: data.profileId,
      }));
      const { data: inserted, error: cErr } = await sb
        .from("appointment_consents")
        .insert(rows)
        .select("token, consent_template_id");
      if (cErr) throw new Error(cErr.message);
      consents.push(...(inserted ?? []));
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
      bookings: { treatmentId: string; durationMin: number; priceCents: number }[];
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
    }) => input,
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    let cursor = data.startTime;
    const created: { id: string; treatmentId: string }[] = [];
    const consents: { token: string; consent_template_id: string }[] = [];
    for (const b of data.bookings) {
      const id = crypto.randomUUID();
      const end = addMinutesToTime(cursor, b.durationMin);
      const { error } = await sb.from("appointments").insert({
        id,
        profile_id: data.profileId,
        treatment_id: b.treatmentId,
        location_id: data.locationId ?? null,
        scheduled_date: data.date,
        start_time: cursor,
        end_time: end,
        patient_name: data.patientName,
        patient_email: data.patientEmail,
        patient_phone: data.patientPhone ?? null,
        patient_dob: data.patientDob ?? null,
        patient_address: data.patientAddress ?? null,
        patient_user_id: data.patientUserId ?? null,
        notes: data.notes ?? null,
        status: "confirmed",
        payment_status: "pending",
        base_amount: b.priceCents / 100,
        total_amount: b.priceCents / 100,
      });
      if (error) throw new Error(error.message);
      created.push({ id, treatmentId: b.treatmentId });

      const { data: links } = await sb
        .from("treatment_consents")
        .select("consent_template_id")
        .eq("treatment_id", b.treatmentId);
      if (links && links.length > 0) {
        const rows = links.map((l) => ({
          appointment_id: id,
          consent_template_id: l.consent_template_id,
          profile_id: data.profileId,
        }));
        const { data: inserted, error: cErr } = await sb
          .from("appointment_consents")
          .insert(rows)
          .select("token, consent_template_id");
        if (cErr) throw new Error(cErr.message);
        consents.push(...(inserted ?? []));
      }
      cursor = end;
    }
    return { appointments: created, consents };
  });

