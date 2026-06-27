import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

export const listAvailabilityRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) return [];
    const { data, error } = await supabase
      .from("availability_rules")
      .select("*")
      .eq("profile_id", profileId)
      .order("day_of_week")
      .order("start_time");
    if (error) throw error;
    return data ?? [];
  });

type RuleInput = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_interval?: number;
  location_id?: string | null;
};

export const upsertAvailabilityRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RuleInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const payload = {
      profile_id: profileId,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      slot_interval: data.slot_interval ?? 30,
      location_id: data.location_id ?? null,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("availability_rules")
        .update(payload)
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("availability_rules")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAvailabilityRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await supabase
      .from("availability_rules")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

export const listMyAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) return [];
    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_name, patient_email, patient_phone, scheduled_date, start_time, end_time, status, payment_status, total_amount, notes, treatment_id, location_id, treatments(name), locations(name)")
      .eq("profile_id", profileId)
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

// ---------- Ad-hoc overrides (extra open slots on specific dates) ----------

type OverrideInput = {
  date: string;
  start_time: string;
  end_time: string;
  slot_interval?: number;
  location_id?: string | null;
};

export const listAvailabilityOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) return [];
    const { data, error } = await supabase
      .from("availability_overrides")
      .select("*")
      .eq("profile_id", profileId)
      .order("date")
      .order("start_time");
    if (error) throw error;
    return data ?? [];
  });

export const addAvailabilityOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OverrideInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await supabase
      .from("availability_overrides")
      .insert({
        profile_id: profileId,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        slot_interval: data.slot_interval ?? 30,
        location_id: data.location_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAvailabilityOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await supabase
      .from("availability_overrides")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Blocked dates (close days/slots) ----------

export const listBlockedDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) return [];
    const { data, error } = await supabase
      .from("blocked_dates")
      .select("*")
      .eq("profile_id", profileId)
      .order("date");
    if (error) throw error;
    return data ?? [];
  });

export const addBlockedDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string; reason?: string; location_id?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await supabase
      .from("blocked_dates")
      .insert({
        profile_id: profileId,
        date: data.date,
        reason: data.reason ?? null,
        location_id: data.location_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteBlockedDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await supabase
      .from("blocked_dates")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

