import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Extra treatments added to a booking on the day — e.g. the client comes in for
 * lip filler and also has a skin booster. The booking keeps its original
 * treatment; extras sit alongside it and roll into the amount owed.
 */

async function clinicProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  const id = await activeProfileId(supabase, userId);
  if (!id) throw new Error("Clinic not found");
  return id as string;
}

async function assertOwnAppointment(supabase: any, appointmentId: string, profileId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, profile_id, base_amount, total_amount, scheduled_date, start_time, end_time")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.profile_id !== profileId) throw new Error("Appointment not found");
  return data as {
    id: string;
    profile_id: string;
    base_amount: number | null;
    total_amount: number | null;
    scheduled_date: string;
    start_time: string;
    end_time: string;
  };
}

function toMinutes(t: string) {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(n: number) {
  const capped = Math.max(0, Math.min(24 * 60 - 1, n));
  return `${String(Math.floor(capped / 60)).padStart(2, "0")}:${String(capped % 60).padStart(2, "0")}:00`;
}

/** Recalculate the booking total as base price + every extra. */
async function recalcTotal(supabase: any, appointmentId: string, profileId: string) {
  const appt = await assertOwnAppointment(supabase, appointmentId, profileId);
  const { data: extras, error } = await supabase
    .from("appointment_extras")
    .select("unit_price, quantity")
    .eq("appointment_id", appointmentId);
  if (error) throw error;
  const base = Number(appt.base_amount ?? appt.total_amount ?? 0);
  const extrasTotal = (extras ?? []).reduce(
    (sum: number, e: { unit_price: number | null; quantity: number | null }) =>
      sum + Number(e.unit_price ?? 0) * Number(e.quantity ?? 1),
    0,
  );
  const total = Math.round((base + extrasTotal) * 100) / 100;
  const { error: upErr } = await supabase
    .from("appointments")
    .update({ base_amount: base, total_amount: total })
    .eq("id", appointmentId);
  if (upErr) throw upErr;
  return { baseAmount: base, total };
}

export const listAppointmentExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appointmentId: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await clinicProfileId(context.supabase, context.userId);
    const appt = await assertOwnAppointment(context.supabase, data.appointmentId, profileId);
    const { data: rows, error } = await context.supabase
      .from("appointment_extras")
      .select("id, treatment_id, name, unit_price, quantity")
      .eq("appointment_id", data.appointmentId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return {
      extras: rows ?? [],
      baseAmount: Number(appt.base_amount ?? appt.total_amount ?? 0),
      total: Number(appt.total_amount ?? 0),
    };
  });

export const addAppointmentExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    appointmentId: string;
    treatmentId?: string | null;
    name: string;
    unitPrice: number;
    quantity?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await clinicProfileId(context.supabase, context.userId);
    await assertOwnAppointment(context.supabase, data.appointmentId, profileId);
    const name = data.name.trim();
    if (!name) throw new Error("Give the treatment a name");
    const { error } = await context.supabase.from("appointment_extras").insert({
      appointment_id: data.appointmentId,
      profile_id: profileId,
      treatment_id: data.treatmentId ?? null,
      name,
      unit_price: Math.max(0, Number(data.unitPrice) || 0),
      quantity: Math.max(1, Math.round(Number(data.quantity) || 1)),
    });
    if (error) throw error;
    return recalcTotal(context.supabase, data.appointmentId, profileId);
  });

export const updateAppointmentExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; appointmentId: string; unitPrice?: number; quantity?: number; name?: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await clinicProfileId(context.supabase, context.userId);
    await assertOwnAppointment(context.supabase, data.appointmentId, profileId);
    const patch: { unit_price?: number; quantity?: number; name?: string } = {};
    if (data.unitPrice !== undefined) patch.unit_price = Math.max(0, Number(data.unitPrice) || 0);
    if (data.quantity !== undefined) patch.quantity = Math.max(1, Math.round(Number(data.quantity) || 1));
    if (data.name !== undefined && data.name.trim()) patch.name = data.name.trim();
    const { error } = await context.supabase
      .from("appointment_extras")
      .update(patch)
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return recalcTotal(context.supabase, data.appointmentId, profileId);
  });

export const removeAppointmentExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; appointmentId: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await clinicProfileId(context.supabase, context.userId);
    await assertOwnAppointment(context.supabase, data.appointmentId, profileId);
    const { error } = await context.supabase
      .from("appointment_extras")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return recalcTotal(context.supabase, data.appointmentId, profileId);
  });

/** Amend the price of the treatment the booking was made for. */
export const setAppointmentBasePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appointmentId: string; basePrice: number }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await clinicProfileId(context.supabase, context.userId);
    await assertOwnAppointment(context.supabase, data.appointmentId, profileId);
    const base = Math.max(0, Number(data.basePrice) || 0);
    const { error } = await context.supabase
      .from("appointments")
      .update({ base_amount: base })
      .eq("id", data.appointmentId)
      .eq("profile_id", profileId);
    if (error) throw error;
    return recalcTotal(context.supabase, data.appointmentId, profileId);
  });

/** Services this clinic offers, for the "add a treatment" picker. */
export const listTreatmentsForExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await clinicProfileId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("treatments")
      .select("id, name, price")
      .eq("profile_id", profileId)
      .order("name");
    if (error) throw error;
    return (data ?? []) as { id: string; name: string; price: number | null }[];
  });
