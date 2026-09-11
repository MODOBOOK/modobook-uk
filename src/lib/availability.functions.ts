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


/**
 * Team calendars: a staff member whose access is limited to "own" only ever
 * sees and edits their own diary + anything set for the whole clinic. Owners
 * and clinic-wide staff see everything and can pick who a shift belongs to.
 */
async function getScope(supabase: any, userId: string) {
  const { resolveClinicAccess } = await import("./clinic-context.server");
  const a = await resolveClinicAccess(supabase, userId);
  const ownPractitionerId =
    a.dataScope === "own" && a.staffPractitionerId ? a.staffPractitionerId : null;
  // Which practitioner card is *this* person, even for owners who can see the
  // whole clinic. Used to open the calendar on their own diary by default.
  let selfPractitionerId: string | null = ownPractitionerId ?? a.staffPractitionerId ?? null;
  if (!selfPractitionerId && a.profileId) {
    const { data: mine } = await supabase
      .from("practitioners")
      .select("id")
      .eq("profile_id", a.profileId)
      .eq("user_id", userId)
      .maybeSingle();
    selfPractitionerId = (mine?.id as string | undefined) ?? null;
  }
  return { profileId: a.profileId, ownPractitionerId, selfPractitionerId, isOwner: a.isOwner, role: a.role };
}

/** Restrict a query to a staff member's own diary (plus clinic-wide rows). */
function scopeToPractitioner(q: any, practitionerId: string | null) {
  if (!practitionerId) return q;
  return q.or(`practitioner_id.eq.${practitionerId},practitioner_id.is.null`);
}

export const getCalendarScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await getScope(context.supabase, context.userId);
    return {
      ownPractitionerId: s.ownPractitionerId,
      selfPractitionerId: s.selfPractitionerId,
      canSeeWholeClinic: !s.ownPractitionerId,
      isOwner: s.isOwner,
      role: s.role,
    };
  });

export const listAvailabilityRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) return [];
    const { ownPractitionerId } = await getScope(supabase, userId);
    const { data, error } = await scopeToPractitioner(
      supabase.from("availability_rules").select("*").eq("profile_id", profileId),
      ownPractitionerId,
    )
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
    const { ownPractitionerId } = await getScope(supabase, userId);
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
      practitioner_id: ownPractitionerId ?? data.practitioner_id ?? null,
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
    // Staff limited to their own diary can only remove their own entries.
    const { ownPractitionerId } = await getScope(supabase, userId);
    let q = supabase.from("availability_rules").delete().eq("id", data.id).eq("profile_id", profileId);
    if (ownPractitionerId) q = q.eq("practitioner_id", ownPractitionerId);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });

export const listMyAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) return [];
    // Stripe checkout rows are temporary slot holds, not appointments. Keep
    // them out of the practitioner diary until payment has actually completed.
    // Pending appointments without a hold are legitimate manually-created or
    // approval-pending bookings and remain visible.
    const { ownPractitionerId } = await getScope(supabase, userId);
    let q = supabase
      .from("appointments")
      .select("id, patient_name, patient_email, patient_phone, scheduled_date, start_time, end_time, status, payment_status, total_amount, amount_paid_cents, amount_refunded_cents, checkout_discount_cents, stripe_payment_intent_id, card_capture_agreed_at, card_captured_at, card_capture_policy_text, checked_out_at, notes, practitioner_notes, aftercare_html, has_allergies, allergies_text, treatment_id, location_id, payment_hold_expires_at, practitioner_id, treatments(name, color), locations(name), practitioners(name)")
      .eq("profile_id", profileId)
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (ownPractitionerId) q = q.eq("practitioner_id", ownPractitionerId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).filter((appointment) => {
      const isUnpaidCheckoutHold =
        appointment.status === "pending" &&
        appointment.payment_status !== "paid" &&
        Number(appointment.amount_paid_cents ?? 0) <= 0 &&
        Boolean(appointment.payment_hold_expires_at);
      return !isUnpaidCheckoutHold;
    });
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
        const { sendWhatsApp, smsMessage } = await import("@/lib/whatsapp/send.server");
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        await sendWhatsApp({
          profileId,
          appointmentId: appt.id,
          kind: "booking-cancellation",
          toPhone: (appt as { patient_phone?: string | null }).patient_phone,
          messageKey: `wa-cancel-${appt.id}`,
          ...smsMessage("booking-cancellation", {
            patientName: appt.patient_name,
            clinicName: prof?.clinic_name,
            treatmentName: (appt as { treatments?: { name?: string } | null }).treatments?.name,
            locationName: (appt as { locations?: { name?: string } | null }).locations?.name,
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

async function dispatchAftercareForAppointment(
  supabase: any,
  profileId: string,
  appt: {
    id: string;
    patient_name?: string | null;
    patient_email?: string | null;
    patient_phone?: string | null;
    aftercare_html?: string | null;
    scheduled_date?: string | null;
    start_time?: string | null;
  },
) {
  if (!appt.aftercare_html || !appt.patient_email) return { sent: false };
  const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
  const branding = await getPractitionerBranding(profileId);
  const firstName = (appt.patient_name ?? "").split(" ")[0] || "there";
  await tryEnqueueAppEmail({
    templateName: "patient-message",
    recipientEmail: appt.patient_email,
    messageId: `aftercare-${appt.id}`,
    templateData: {
      profileId,
      patientName: appt.patient_name,
      clinicName: branding.clinicName,
      subject: `Aftercare instructions from ${branding.clinicName}`,
      body: `Hi ${firstName},\n\nThank you for visiting ${branding.clinicName}.\n\n${appt.aftercare_html}\n\nIf you have any questions, please contact your practitioner.`,
      logoUrl: branding.logoUrl,
      brandColor: branding.brandColor,
    },
  });
  return { sent: true };
}

export const checkOutAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");

    const { data: appt, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, patient_name, patient_email, patient_phone, aftercare_html, aftercare_sent_at, scheduled_date, start_time, status")
      .eq("id", data.id)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!appt) throw new Error("Appointment not found");

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { checked_out_at: now };
    if (appt.aftercare_html && !appt.aftercare_sent_at) {
      try {
        await dispatchAftercareForAppointment(supabase, profileId, appt);
        patch.aftercare_sent_at = now;
      } catch (e) {
        console.error("[checkOutAppointment] aftercare dispatch failed", e);
      }
    }

    const { error } = await supabase
      .from("appointments")
      .update(patch as never)
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true, aftercareSent: !!patch.aftercare_sent_at };
  });

export const undoCheckoutAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await supabase
      .from("appointments")
      .update({ checked_out_at: null } as never)
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
  practitioner_id?: string | null;
};

export const listAvailabilityOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) return [];
    const { ownPractitionerId } = await getScope(supabase, userId);
    const { data, error } = await scopeToPractitioner(
      supabase.from("availability_overrides").select("*").eq("profile_id", profileId),
      ownPractitionerId,
    )
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
        practitioner_id: (await getScope(supabase, userId)).ownPractitionerId ?? data.practitioner_id ?? null,
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
    // Staff limited to their own diary can only remove their own entries.
    const { ownPractitionerId } = await getScope(supabase, userId);
    let q = supabase.from("availability_overrides").delete().eq("id", data.id).eq("profile_id", profileId);
    if (ownPractitionerId) q = q.eq("practitioner_id", ownPractitionerId);
    const { error } = await q;
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
    const { ownPractitionerId } = await getScope(supabase, userId);
    const { data, error } = await scopeToPractitioner(
      supabase.from("blocked_dates").select("*").eq("profile_id", profileId),
      ownPractitionerId,
    ).order("date");
    if (error) throw error;
    return data ?? [];
  });

export const addBlockedDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string; reason?: string; location_id?: string | null; practitioner_id?: string | null }) => input)
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
        practitioner_id: (await getScope(supabase, userId)).ownPractitionerId ?? data.practitioner_id ?? null,
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
    // Staff limited to their own diary can only remove their own entries.
    const { ownPractitionerId } = await getScope(supabase, userId);
    let q = supabase.from("blocked_dates").delete().eq("id", data.id).eq("profile_id", profileId);
    if (ownPractitionerId) q = q.eq("practitioner_id", ownPractitionerId);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });

// ---------- Blocked TIMES (timed blocks on a single day) ----------

export const listBlockedTimes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { ownPractitionerId } = await getScope(context.supabase, context.userId);
    const { data, error } = await scopeToPractitioner(
      context.supabase.from("blocked_times").select("*").eq("profile_id", profileId),
      ownPractitionerId,
    )
      .order("date")
      .order("start_time");
    if (error) throw error;
    return data ?? [];
  });

export const addBlockedTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { date: string; start_time: string; end_time: string; reason?: string | null; location_id?: string | null; practitioner_id?: string | null }) => d,
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
        practitioner_id:
          (await getScope(context.supabase, context.userId)).ownPractitionerId ?? data.practitioner_id ?? null,
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
    // Staff limited to their own diary can only remove their own entries.
    const { ownPractitionerId } = await getScope(context.supabase, context.userId);
    let q = context.supabase.from("blocked_times").delete().eq("id", data.id).eq("profile_id", profileId);
    if (ownPractitionerId) q = q.eq("practitioner_id", ownPractitionerId);
    const { error } = await q;
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
    const { ownPractitionerId } = await getScope(context.supabase, context.userId);
    let q = context.supabase
      .from("practitioners")
      .select("id, name")
      .eq("profile_id", profileId)
      .order("name");
    if (ownPractitionerId) q = q.eq("id", ownPractitionerId);
    const { data } = await q;
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


/** Assign (or clear) which practitioner an appointment belongs to. */
export const setAppointmentPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string; practitionerId: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("Profile not found");
    if (data.practitionerId) {
      const { data: p } = await supabase
        .from("practitioners")
        .select("id")
        .eq("id", data.practitionerId)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (!p) throw new Error("Practitioner not found");
    }
    const { error } = await supabase
      .from("appointments")
      .update({ practitioner_id: data.practitionerId } as never)
      .eq("id", data.appointmentId)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });
