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
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("is_primary", { ascending: false });

    const { data: rules } = await sb
      .from("availability_rules")
      .select("*")
      .eq("profile_id", profile.id);

    return {
      profileId: profile.id,
      clinicName: profile.clinic_name,
      treatment,
      locations: locations ?? [],
      rules: rules ?? [],
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
      notes?: string;
      basePrice: number;
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
      notes: data.notes ?? null,
      status: "pending",
      payment_status: "pending",
      base_amount: data.basePrice,
      total_amount: data.basePrice,
    });
    if (error) throw new Error(error.message);
    return { id };
  });
