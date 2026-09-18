import { createServerFn } from "@tanstack/react-start";

/**
 * Patient-facing rescheduling from the "manage my appointment" link.
 * Everything here is authorised by the appointment's manage token, so the
 * queries run with the admin client and are always scoped to that one row.
 */

type ApptRow = {
  id: string;
  profile_id: string;
  treatment_id: string | null;
  location_id: string | null;
  practitioner_id: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string;
  reschedule_count: number | null;
  patient_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
};

const toMinutes = (t: string) => {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMinutes = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

async function loadByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, profile_id, treatment_id, location_id, practitioner_id, scheduled_date, start_time, end_time, status, reschedule_count, patient_name, patient_email, patient_phone",
    )
    .eq("manage_token", token)
    .maybeSingle();
  return { supabaseAdmin, appt: (appt as ApptRow | null) ?? null };
}

export const getRescheduleContextByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin, appt } = await loadByToken(data.token);
    if (!appt) return { allowed: false as const, reason: "Appointment not found." };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("allow_patient_reschedule, patient_reschedule_max, patient_reschedule_cutoff_hours, slug")
      .eq("id", appt.profile_id)
      .maybeSingle();

    const p = (profile ?? {}) as {
      allow_patient_reschedule?: boolean | null;
      patient_reschedule_max?: number | null;
      patient_reschedule_cutoff_hours?: number | null;
      slug?: string | null;
    };

    const base = {
      profileId: appt.profile_id,
      locationId: appt.location_id,
      practitionerId: appt.practitioner_id,
      durationMinutes: Math.max(5, toMinutes(appt.end_time) - toMinutes(appt.start_time)),
      slug: p.slug ?? null,
      usedCount: appt.reschedule_count ?? 0,
      maxCount: p.patient_reschedule_max ?? null,
      cutoffHours: p.patient_reschedule_cutoff_hours ?? 0,
    };

    if (appt.status === "cancelled") return { allowed: false as const, reason: "This appointment was cancelled.", ...base };
    if (p.allow_patient_reschedule === false)
      return { allowed: false as const, reason: "This clinic asks you to get in touch to change an appointment.", ...base };
    if (p.patient_reschedule_max != null && (appt.reschedule_count ?? 0) >= Number(p.patient_reschedule_max))
      return { allowed: false as const, reason: "You've already changed this appointment the maximum number of times.", ...base };

    const cutoff = Number(p.patient_reschedule_cutoff_hours ?? 0);
    if (cutoff > 0) {
      const startsAt = new Date(`${appt.scheduled_date}T${appt.start_time}`);
      if (startsAt.getTime() - Date.now() < cutoff * 3600_000)
        return {
          allowed: false as const,
          reason: `Appointments can only be changed more than ${cutoff} hours beforehand. Please contact the clinic.`,
          ...base,
        };
    }

    return { allowed: true as const, reason: null, ...base };
  });

/** Free start times on a given date for this appointment's length and location. */
export const getRescheduleSlotsByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string; date: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin, appt } = await loadByToken(data.token);
    if (!appt) return { slots: [] as string[] };

    const duration = Math.max(5, toMinutes(appt.end_time) - toMinutes(appt.start_time));
    const locId = appt.location_id;
    const pracId = appt.practitioner_id;
    const matchPract = (row: string | null | undefined) => !pracId || !row || row === pracId;
    const matchLoc = (row: string | null | undefined) => !row || !locId || row === locId;

    const [y, m, d] = data.date.split("-").map(Number);
    const dow = new Date(Date.UTC(y!, (m ?? 1) - 1, d)).getUTCDay();

    const [rulesRes, overridesRes, blockedDatesRes, blockedTimesRes, busyRes, anchorRes, profileRes] =
      await Promise.all([
        supabaseAdmin
          .from("availability_rules")
          .select("day_of_week, location_id, practitioner_id, start_time, end_time, slot_interval, cycle_length, weeks_mask, effective_from, effective_to")
          .eq("profile_id", appt.profile_id)
          .eq("day_of_week", dow),
        supabaseAdmin
          .from("availability_overrides")
          .select("start_time, end_time, slot_interval, location_id, practitioner_id")
          .eq("profile_id", appt.profile_id)
          .eq("date", data.date)
          .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`),
        supabaseAdmin
          .from("blocked_dates")
          .select("location_id, practitioner_id")
          .eq("profile_id", appt.profile_id)
          .eq("date", data.date),
        supabaseAdmin
          .from("blocked_times")
          .select("start_time, end_time, location_id, practitioner_id")
          .eq("profile_id", appt.profile_id)
          .eq("date", data.date),
        supabaseAdmin
          .from("appointments")
          .select("id, start_time, end_time, location_id, practitioner_id")
          .eq("profile_id", appt.profile_id)
          .eq("scheduled_date", data.date)
          .neq("status", "cancelled"),
        supabaseAdmin.rpc("get_rota_anchor", { p_profile_id: appt.profile_id }),
        supabaseAdmin
          .from("profiles")
          .select("booking_buffer_before_minutes, booking_buffer_after_minutes")
          .eq("id", appt.profile_id)
          .maybeSingle(),
      ]);

    const overrides = (overridesRes.data ?? []).filter(
      (o) => matchLoc(o.location_id) && matchPract((o as { practitioner_id?: string | null }).practitioner_id),
    );

    const closed = (blockedDatesRes.data ?? []).some(
      (b) => matchLoc(b.location_id) && matchPract((b as { practitioner_id?: string | null }).practitioner_id),
    );
    if (closed && overrides.length === 0) return { slots: [] as string[] };

    const { ruleAppliesOnDate } = await import("@/lib/rota");
    const anchor = (anchorRes.data as string | null) ?? null;
    const rules = (rulesRes.data ?? []).filter(
      (r) =>
        matchLoc(r.location_id) &&
        matchPract((r as { practitioner_id?: string | null }).practitioner_id) &&
        ruleAppliesOnDate(
          r as unknown as { cycle_length?: number; weeks_mask?: number; effective_from?: string | null; effective_to?: string | null },
          data.date,
          anchor,
        ),
    );

    const windows = [
      ...(closed ? [] : rules).map((r) => ({ start: r.start_time as string, end: r.end_time as string, step: (r.slot_interval as number) || duration })),
      ...overrides.map((o) => ({ start: o.start_time as string, end: o.end_time as string, step: (o.slot_interval as number) || duration })),
    ];
    if (windows.length === 0) return { slots: [] as string[] };

    const bufferBefore = Number((profileRes.data as { booking_buffer_before_minutes?: number } | null)?.booking_buffer_before_minutes ?? 0);
    const bufferAfter = Number((profileRes.data as { booking_buffer_after_minutes?: number } | null)?.booking_buffer_after_minutes ?? 0);

    const busy = [
      ...(busyRes.data ?? [])
        .filter((b) => b.id !== appt.id)
        .filter((b) => matchLoc(b.location_id) && matchPract((b as { practitioner_id?: string | null }).practitioner_id))
        .map((b) => ({ start: toMinutes(b.start_time as string) - bufferBefore, end: toMinutes(b.end_time as string) + bufferAfter })),
      ...(blockedTimesRes.data ?? [])
        .filter((b) => matchLoc(b.location_id) && matchPract((b as { practitioner_id?: string | null }).practitioner_id))
        .map((b) => ({ start: toMinutes(b.start_time as string), end: toMinutes(b.end_time as string) })),
    ];

    const out = new Set<string>();
    for (const w of windows) {
      const start = toMinutes(w.start);
      const end = toMinutes(w.end);
      const step = Math.max(5, w.step);
      for (let t = start; t + duration <= end; t += step) {
        const slotEnd = t + duration;
        if (busy.some((b) => t < b.end && slotEnd > b.start)) continue;
        out.add(fromMinutes(t));
      }
    }

    // Never offer a time that has already passed today.
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const slots = Array.from(out)
      .filter((s) => data.date !== todayIso || toMinutes(s) > nowMin)
      .sort();

    return { slots };
  });

export const rescheduleByToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; date: string; startTime: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin, appt } = await loadByToken(data.token);
    if (!appt) return { ok: false as const, error: "Appointment not found." };
    if (appt.status === "cancelled") return { ok: false as const, error: "This appointment was cancelled." };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("allow_patient_reschedule, patient_reschedule_max, patient_reschedule_cutoff_hours")
      .eq("id", appt.profile_id)
      .maybeSingle();
    const p = (profile ?? {}) as {
      allow_patient_reschedule?: boolean | null;
      patient_reschedule_max?: number | null;
      patient_reschedule_cutoff_hours?: number | null;
    };
    if (p.allow_patient_reschedule === false)
      return { ok: false as const, error: "This clinic asks you to get in touch to change an appointment." };
    if (p.patient_reschedule_max != null && (appt.reschedule_count ?? 0) >= Number(p.patient_reschedule_max))
      return { ok: false as const, error: "You've already changed this appointment the maximum number of times." };
    const cutoff = Number(p.patient_reschedule_cutoff_hours ?? 0);
    if (cutoff > 0) {
      const startsAt = new Date(`${appt.scheduled_date}T${appt.start_time}`);
      if (startsAt.getTime() - Date.now() < cutoff * 3600_000)
        return { ok: false as const, error: `Appointments can only be changed more than ${cutoff} hours beforehand.` };
    }

    const duration = Math.max(5, toMinutes(appt.end_time) - toMinutes(appt.start_time));
    const startHM = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
    const endHM = `${fromMinutes(toMinutes(data.startTime) + duration)}:00`;

    // Re-check the slot is still free right before moving the booking.
    const { data: clashing } = await supabaseAdmin
      .from("appointments")
      .select("id, start_time, end_time, location_id, practitioner_id")
      .eq("profile_id", appt.profile_id)
      .eq("scheduled_date", data.date)
      .neq("status", "cancelled");
    const wantStart = toMinutes(startHM);
    const wantEnd = wantStart + duration;
    const taken = (clashing ?? []).some(
      (b) =>
        b.id !== appt.id &&
        (!b.location_id || !appt.location_id || b.location_id === appt.location_id) &&
        (!appt.practitioner_id || !b.practitioner_id || b.practitioner_id === appt.practitioner_id) &&
        toMinutes(b.start_time as string) < wantEnd &&
        wantStart < toMinutes(b.end_time as string),
    );
    if (taken) return { ok: false as const, error: "Sorry, that time has just been taken. Please pick another." };

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({
        scheduled_date: data.date,
        start_time: startHM,
        end_time: endHM,
        reschedule_count: (appt.reschedule_count ?? 0) + 1,
      } as never)
      .eq("id", appt.id);
    if (error) return { ok: false as const, error: "Could not move the appointment. Please try again." };

    try {
      const { tryEnqueueAppEmail, formatBookingDateTime, getPractitionerBranding } = await import("@/lib/email/send.server");
      const branding = await getPractitionerBranding(appt.profile_id);
      const { data: loc } = appt.location_id
        ? await supabaseAdmin.from("locations").select("name, address_line1, city, postcode").eq("id", appt.location_id).maybeSingle()
        : { data: null };
      const locRow = loc as { name?: string; address_line1?: string; city?: string; postcode?: string } | null;
      const locationAddress = locRow
        ? [locRow.address_line1, locRow.city, locRow.postcode].filter(Boolean).join(", ")
        : undefined;

      if (appt.patient_email) {
        await tryEnqueueAppEmail({
          templateName: "booking-confirmation",
          recipientEmail: appt.patient_email,
          messageId: `booking-reschedule-${appt.id}-${data.date}-${startHM}`,
          templateData: {
            patientName: (appt.patient_name ?? "").split(" ")[0] || "there",
            clinicName: branding.clinicName,
            dateTime: formatBookingDateTime(data.date, startHM),
            locationName: locRow?.name,
            locationAddress,
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
            rescheduled: true,
          },
        });
      }

      try {
        const { sendWhatsApp, smsMessage } = await import("@/lib/whatsapp/send.server");
        await sendWhatsApp({
          profileId: appt.profile_id,
          appointmentId: appt.id,
          kind: "booking-reschedule",
          toPhone: appt.patient_phone,
          messageKey: `wa-reschedule-${appt.id}-${data.date}-${startHM}`,
          ...smsMessage("booking-reschedule", {
            patientName: appt.patient_name ?? undefined,
            clinicName: branding.clinicName,
            locationName: locRow?.name,
            locationAddress,
            dateTime: formatBookingDateTime(data.date, startHM),
          }),
        });
      } catch (e) {
        console.error("[rescheduleByToken] whatsapp failed", e);
      }
    } catch (e) {
      console.error("[rescheduleByToken] notify failed", e);
    }

    return { ok: true as const, date: data.date, startTime: startHM.slice(0, 5), endTime: endHM.slice(0, 5) };
  });
