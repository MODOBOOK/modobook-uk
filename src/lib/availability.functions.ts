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
  cycle_length?: number;
  weeks_mask?: number;
  practitioner_id?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
};



export const upsertAvailabilityRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RuleInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const cycle = data.cycle_length && [1, 2, 4].includes(data.cycle_length) ? data.cycle_length : 1;
    const maxMask = (1 << cycle) - 1;
    const mask = Math.max(1, Math.min(maxMask, data.weeks_mask ?? 1));
    const payload = {
      profile_id: profileId,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      slot_interval: data.slot_interval ?? 30,
      location_id: data.location_id ?? null,
      cycle_length: cycle,
      weeks_mask: mask,
      practitioner_id: data.practitioner_id ?? null,
      effective_from: data.effective_from || null,
      effective_to: data.effective_to || null,
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
    // NOTE: we intentionally do NOT sweep or hide pending/unpaid appointments
    // here. Practitioners need visibility of every booking — including ones
    // still awaiting Stripe confirmation or manually created without payment.
    // Slot availability release for abandoned checkouts is handled in
    // getDayAvailability (public-booking.functions.ts) based on the payment
    // hold window; the appointment row itself remains for the practitioner.
    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_name, patient_email, patient_phone, scheduled_date, start_time, end_time, status, payment_status, total_amount, amount_paid_cents, amount_refunded_cents, checkout_discount_cents, stripe_payment_intent_id, notes, practitioner_notes, aftercare_html, has_allergies, allergies_text, treatment_id, location_id, payment_hold_expires_at, treatments(name, color), locations(name)")
      .eq("profile_id", profileId)
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });


export const updateAppointmentNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; practitionerNotes: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await supabase
      .from("appointments")
      .update({ practitioner_notes: data.practitionerNotes })
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: appt } = await context.supabase
      .from("appointments")
      .select("id, patient_name, patient_email, scheduled_date, start_time, treatments(name)")
      .eq("id", data.id)
      .eq("profile_id", profileId)
      .maybeSingle();
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;

    // Free any host-clinic room that was auto-allocated for this appointment.
    try {
      const { releaseRoomForAppointment } = await import("./associates.server");
      await releaseRoomForAppointment(data.id);
    } catch (e) { console.error("[cancelAppointment] room release failed", e); }



    if (appt?.patient_email) {
      try {
        const { data: prof } = await context.supabase
          .from("profiles").select("clinic_name, slug").eq("id", profileId).maybeSingle();
        const { tryEnqueueAppEmail, formatBookingDateTime, getPractitionerBranding } = await import("@/lib/email/send.server");
        const branding = await getPractitionerBranding(profileId);
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        await tryEnqueueAppEmail({
          templateName: "booking-cancellation",
          recipientEmail: appt.patient_email,
          messageId: `booking-cancel-${appt.id}`,
          templateData: {
            patientName: (appt.patient_name ?? "").split(" ")[0] || "there",
            clinicName: prof?.clinic_name ?? branding.clinicName,
            treatmentName: (appt as { treatments?: { name?: string } | null }).treatments?.name ?? "your appointment",
            dateTime: formatBookingDateTime(appt.scheduled_date as string, appt.start_time as string),
            cancelledBy: "clinic",
            reason: data.reason,
            rebookUrl: prof?.slug ? `${origin}/m/${prof.slug}` : origin,
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
          },
        });
      } catch (e) { console.error("[cancelAppointment] email failed", e); }
    }
    return { ok: true };
  });

export const updateAppointmentAftercareAndAllergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; aftercare_html?: string | null; has_allergies?: boolean; allergies_text?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const patch: any = {};
    if ("aftercare_html" in data) patch.aftercare_html = data.aftercare_html;
    if ("has_allergies" in data) patch.has_allergies = data.has_allergies;
    if ("allergies_text" in data) patch.allergies_text = data.allergies_text;
    const { error } = await context.supabase
      .from("appointments")
      .update(patch)
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
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

// ---------- Blocked TIMES (timed blocks on a single day) ----------

export const listBlockedTimes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("blocked_times")
      .select("*")
      .eq("profile_id", profileId)
      .order("date")
      .order("start_time");
    if (error) throw error;
    return data ?? [];
  });

export const addBlockedTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { date: string; start_time: string; end_time: string; reason?: string | null; location_id?: string | null }) => d,
  )
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await context.supabase
      .from("blocked_times")
      .insert({
        profile_id: profileId,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        reason: data.reason ?? null,
        location_id: data.location_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteBlockedTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await context.supabase
      .from("blocked_times")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });



// ---------- Rota (multi-week cycle) settings ----------

export const getRotaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return { rota_anchor_date: null as string | null };
    const { data } = await context.supabase
      .from("profiles")
      .select("rota_anchor_date")
      .eq("id", profileId)
      .maybeSingle();
    return { rota_anchor_date: (data?.rota_anchor_date as string | null) ?? null };
  });

export const setRotaAnchor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string | null }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await context.supabase
      .from("profiles")
      .update({ rota_anchor_date: data.date })
      .eq("id", profileId);
    if (error) throw error;
    return { ok: true };
  });

export const listPractitioners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data } = await context.supabase
      .from("practitioners")
      .select("id, name")
      .eq("profile_id", profileId)
      .order("name");
    return data ?? [];
  });
