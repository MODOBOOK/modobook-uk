import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", await __activeProfileId(supabase, userId))
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
      .select("id, patient_name, patient_email, patient_phone, scheduled_date, start_time, end_time, status, payment_status, total_amount, amount_paid_cents, amount_refunded_cents, checkout_discount_cents, stripe_payment_intent_id, card_capture_agreed_at, card_captured_at, card_capture_policy_text, notes, practitioner_notes, aftercare_html, has_allergies, allergies_text, treatment_id, location_id, payment_hold_expires_at, treatments(name, color), locations(name)")
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
      .select("id, patient_name, patient_email, patient_phone, scheduled_date, start_time, treatments(name)")
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



    if (appt) {
      try {
        const { data: prof } = await context.supabase
          .from("profiles").select("clinic_name, slug").eq("id", profileId).maybeSingle();
        const { formatBookingDateTime } = await import("@/lib/email/send.server");
        const { sendWhatsApp, buildWhatsAppBody } = await import("@/lib/whatsapp/send.server");
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        await sendWhatsApp({
          profileId,
          appointmentId: appt.id,
          kind: "booking-cancellation",
          toPhone: (appt as { patient_phone?: string | null }).patient_phone,
          messageKey: `wa-cancel-${appt.id}`,
          body: buildWhatsAppBody("booking-cancellation", {
            patientName: appt.patient_name,
            clinicName: prof?.clinic_name,
            treatmentName: (appt as { treatments?: { name?: string } | null }).treatments?.name,
            dateTime: formatBookingDateTime(appt.scheduled_date as string, appt.start_time as string),
            bookingUrl: prof?.slug ? `${origin}/m/${prof.slug}` : origin,
          }),
        });
      } catch (e) { console.error("[cancelAppointment] whatsapp failed", e); }
    }

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

/**
 * Close off the shifts that are currently running (stamp an end date on them so
 * they become a "previous rota"), and optionally copy them forward as the
 * starting point of the next rota.
 */
export const endCurrentRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { end_date: string; new_start_date?: string | null; copy?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const profileId = await getProfileId(supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");

    const { data: rows, error } = await supabase
      .from("availability_rules")
      .select("*")
      .eq("profile_id", profileId);
    if (error) throw error;

    const active = (rows ?? []).filter((r: any) => {
      if (r.effective_to && r.effective_to <= data.end_date) return false; // already ended
      if (r.effective_from && r.effective_from > data.end_date) return false; // future rota
      return true;
    });
    if (active.length === 0) return { ended: 0, created: 0 };

    const { error: upErr } = await supabase
      .from("availability_rules")
      .update({ effective_to: data.end_date })
      .in("id", active.map((r: any) => r.id));
    if (upErr) throw upErr;

    let created = 0;
    if (data.copy && data.new_start_date) {
      const clones = active.map((r: any) => ({
        profile_id: profileId,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        slot_interval: r.slot_interval,
        location_id: r.location_id,
        cycle_length: r.cycle_length,
        weeks_mask: r.weeks_mask,
        practitioner_id: r.practitioner_id,
        effective_from: data.new_start_date,
        effective_to: null,
      }));
      const { error: insErr } = await supabase.from("availability_rules").insert(clones);
      if (insErr) throw insErr;
      created = clones.length;
    }
    return { ended: active.length, created };
  });

/** Permanently remove an archived rota (all shifts sharing the same end date). */
export const deletePreviousRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { effective_to: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await context.supabase
      .from("availability_rules")
      .delete()
      .eq("profile_id", profileId)
      .eq("effective_to", data.effective_to);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Change the start/end dates of a whole rota period at once (the set of shifts
 * currently shown as one rota). Pass null to clear a date.
 */
export const updateRotaPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { ids: string[]; effective_from?: string | null; effective_to?: string | null }) => d,
  )
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (!data.ids?.length) return { ok: true, updated: 0 };
    const patch: { effective_from?: string | null; effective_to?: string | null } = {};
    if ("effective_from" in data) patch.effective_from = data.effective_from || null;
    if ("effective_to" in data) patch.effective_to = data.effective_to || null;
    if (Object.keys(patch).length === 0) return { ok: true, updated: 0 };
    const { error } = await context.supabase
      .from("availability_rules")
      .update(patch)
      .eq("profile_id", profileId)
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true, updated: data.ids.length };
  });

/** Permanently delete a whole rota period (by its shift ids). */
export const deleteRotaPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (!data.ids?.length) return { ok: true };
    const { error } = await context.supabase
      .from("availability_rules")
      .delete()
      .eq("profile_id", profileId)
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true };
  });
