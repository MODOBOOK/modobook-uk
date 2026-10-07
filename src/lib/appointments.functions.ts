import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const createAppointmentForPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      treatmentId: string;
      locationId?: string | null;
      date: string;
      startTime: string;
      endTime: string;
      patientName: string;
      patientEmail: string;
      patientPhone?: string;
      patientDob?: string | null;
      patientAddress?: Record<string, string> | null;
      notes?: string;
      basePrice: number;
      extraConsentTemplateIds?: string[];
      medicalFormTemplateIds?: string[];
      modelSlotId?: string | null;
      practitionerId?: string | null;
      packageId?: string | null;
      paymentReceived?: {
        kind: "deposit" | "full";
        amountCents: number;
        method: "cash" | "card_in_person" | "bank_transfer" | "other";
        reference?: string | null;
      } | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .single();
    if (pErr || !profile) throw new Error("Profile not found");

    // Idempotency: if an identical appointment for this practitioner + patient +
    // treatment + slot was created in the last 5 minutes, return that one instead
    // of writing a duplicate. Guards against double-click / retry duplicates.
    {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: dup } = await supabase
        .from("appointments")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("treatment_id", data.treatmentId)
        .eq("scheduled_date", data.date)
        .eq("start_time", data.startTime)
        .ilike("patient_email", data.patientEmail)
        .gte("created_at", cutoff)
        .maybeSingle();
      if (dup) return { id: dup.id as string, manageToken: null };
    }

    const id = crypto.randomUUID();
    const pr = data.paymentReceived ?? null;
    const nowIso = new Date().toISOString();
    // Never save a £0 price by accident: fall back to the treatment's list
    // price, then to whatever was actually taken.
    let basePrice = Number(data.basePrice ?? 0);
    if (!(basePrice > 0)) {
      const { data: t } = await supabase
        .from("treatments")
        .select("price")
        .eq("id", data.treatmentId)
        .maybeSingle();
      basePrice = Number((t as { price?: number } | null)?.price ?? 0);
    }
    if (!(basePrice > 0) && pr?.amountCents) basePrice = pr.amountCents / 100;
    data.basePrice = basePrice;
    const totalCents = Math.round(basePrice * 100);
    const insertRow: Record<string, unknown> = {
      id,
      profile_id: profile.id,
      treatment_id: data.treatmentId,
      location_id: data.locationId ?? null,
      scheduled_date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      patient_name: data.patientName,
      patient_email: data.patientEmail,
      patient_phone: data.patientPhone ?? null,
      patient_dob: data.patientDob ?? null,
      patient_address: data.patientAddress,
      notes: data.notes ?? null,
      status: "confirmed",
      payment_status: pr?.kind === "full" ? "paid" : "pending",
      base_amount: data.basePrice,
      total_amount: data.basePrice,
      created_by_practitioner: true,
      model_slot_id: data.modelSlotId ?? null,
      practitioner_id: data.practitionerId ?? null,
    };
    if (pr) {
      insertRow.payment_method = pr.method;
      if (pr.kind === "deposit") {
        insertRow.deposit_required_cents = pr.amountCents;
        insertRow.deposit_paid_at = nowIso;
        insertRow.amount_paid_cents = pr.amountCents;
      } else {
        insertRow.amount_paid_cents = pr.amountCents || totalCents;
      }
    }
    // Prescribing clinic days: link the booking to that day's visit so the
    // prescriber gets the referral — same as patient bookings online.
    {
      const { data: tr } = await supabase
        .from("treatments")
        .select("prescriber_routing, requires_prescriber")
        .eq("id", data.treatmentId)
        .maybeSingle();
      const t = tr as { prescriber_routing?: string | null; requires_prescriber?: boolean | null } | null;
      // Prescriber days set up on the services page are generic clinic days —
      // they apply to any treatment needing a prescriber, often with no linked
      // prescriber and no specific treatment attached to the day.
      if (t?.prescriber_routing === "clinic_visit" || t?.requires_prescriber === true) {
        const { data: visits } = await supabase
          .from("prescriber_clinic_visits")
          .select("id, treatment_id, location_id")
          .eq("practitioner_profile_id", profile.id)
          .eq("visit_date", data.date)
          .neq("status", "cancelled");
        const vs = ((visits ?? []) as { id: string; treatment_id: string | null; location_id: string | null }[])
          .filter((v) => !data.locationId || !v.location_id || v.location_id === data.locationId);
        const visit =
          vs.find((v) => v.treatment_id === data.treatmentId) ??
          vs.find((v) => v.treatment_id == null) ??
          vs[0];
        if (visit) insertRow.clinic_visit_id = visit.id;
      }
    }
    const { error } = await supabase.from("appointments").insert(insertRow as never);
    if (error) throw new Error(error.message);

    // Booked as a package: record the purchase and label the booking with the
    // package name so the diary shows the package, not just one treatment.
    if (data.packageId) {
      const { data: pkg } = await supabase
        .from("packages")
        .select("id, name, session_count, expiry_days, profile_id")
        .eq("id", data.packageId)
        .maybeSingle();
      const p = pkg as { id: string; name: string; session_count: number | null; expiry_days: number | null; profile_id: string } | null;
      if (p && p.profile_id === profile.id) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const purchaseId = crypto.randomUUID();
        const { error: pErr2 } = await supabaseAdmin.from("package_purchases").insert({
          id: purchaseId,
          package_id: p.id,
          patient_email: data.patientEmail,
          sessions_remaining: Math.max(0, Number(p.session_count ?? 1) - 1),
          expires_at: p.expiry_days ? new Date(Date.now() + p.expiry_days * 86400000).toISOString() : null,
          status: "active",
        } as never);
        await supabase
          .from("appointments")
          .update({
            ...(pErr2 ? {} : { package_purchase_id: purchaseId }),
            treatment_name_snapshot: p.name,
          } as never)
          .eq("id", id);
      }
    }

    if (pr) {
      await supabase.from("payments").insert({
        profile_id: profile.id,
        appointment_id: id,
        amount: (pr.amountCents || totalCents) / 100,
        status: "succeeded",
        stripe_payment_intent_id:
          pr.reference || `manual:${pr.method}:${crypto.randomUUID()}`,
      } as never);
    }

    // Mark the model slot as booked so it disappears from public listings.
    if (data.modelSlotId) {
      await supabase
        .from("model_slots")
        .update({ booked_appointment_id: id })
        .eq("id", data.modelSlotId)
        .eq("profile_id", profile.id)
        .is("booked_appointment_id", null);
    }

    // Auto-create consents from treatment links
    const { data: links } = await supabase
      .from("treatment_consents")
      .select("consent_template_id")
      .eq("treatment_id", data.treatmentId);
    const consentIds = new Set<string>((links ?? []).map((l) => l.consent_template_id));
    for (const cid of data.extraConsentTemplateIds ?? []) consentIds.add(cid);
    if (consentIds.size > 0) {
      const rows = [...consentIds].map((cid) => ({
        appointment_id: id,
        consent_template_id: cid,
        profile_id: profile.id,
      }));
      await supabase.from("appointment_consents").insert(rows);
    }

    // Manually attach extra medical forms (treatment-linked ones added by trigger)
    if ((data.medicalFormTemplateIds ?? []).length > 0) {
      const rows = (data.medicalFormTemplateIds ?? []).map((tid) => ({
        appointment_id: id,
        template_id: tid,
        profile_id: profile.id,
      }));
      await supabase.from("appointment_medical_forms").insert(rows);
    }

    // Pull manage_token for confirmation link
    const { data: created } = await supabase
      .from("appointments")
      .select("manage_token")
      .eq("id", id)
      .single();

    if (data.patientEmail) {
      try {
        const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
        await sendBookingConfirmationEmails([id]);
      } catch (e) { console.error("[createAppointmentForPatient] email failed", e); }
    }

    return { id, manageToken: created?.manage_token ?? null };
  });

// Public lookup by manage token (for patient reschedule/cancel page)
export const getAppointmentByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .rpc("get_appointment_by_manage_token", { p_token: data.token })
      .single();
    if (error) throw error;
    return row;
  });

export const cancelAppointmentByToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    // Load appointment first (for email context) via existing manage-token RPC
    type ApptCtx = {
      id?: string;
      patient_name?: string;
      patient_email?: string;
      scheduled_date?: string;
      start_time?: string;
      treatment_name?: string;
      clinic_name?: string;
      clinic_slug?: string;
    };
    let apptRow: ApptCtx | null = null;
    try {
      const { data: row } = await sb.rpc("get_appointment_by_manage_token", { p_token: data.token }).single();
      apptRow = (row as unknown as ApptCtx | null) ?? null;
    } catch { /* ignore */ }

    const { data: ok, error } = await sb.rpc("cancel_appointment_by_token", { p_token: data.token });
    if (error) throw error;

    const a: ApptCtx | null = apptRow;
    // Refund automatically when the clinic allows it and the cancellation
    // landed inside their refund window.
    let autoRefundedCents = 0;
    if (ok && a?.id) {
      try {
        const { autoRefundCancelledAppointment } = await import("./refunds.functions");
        const r = await autoRefundCancelledAppointment({ data: { appointmentId: a.id } });
        if (r.refunded) autoRefundedCents = r.refundedCents;
      } catch (e) { console.error("[cancelAppointmentByToken] auto refund failed", e); }
    }
    if (ok && a && a.patient_email && a.id) {
      try {
        const { tryEnqueueAppEmail, formatBookingDateTime, getPractitionerBranding } = await import("@/lib/email/send.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: apptFull } = await supabaseAdmin
          .from("appointments").select("profile_id, patient_phone, locations(name)").eq("id", a.id).maybeSingle();
        const branding = await getPractitionerBranding((apptFull as { profile_id?: string } | null)?.profile_id);
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        try {
          const { sendWhatsApp, smsMessage } = await import("@/lib/whatsapp/send.server");
          await sendWhatsApp({
            profileId: (apptFull as { profile_id?: string } | null)?.profile_id ?? null,
            appointmentId: a.id,
            kind: "booking-cancellation",
            toPhone: (apptFull as { patient_phone?: string | null } | null)?.patient_phone,
            messageKey: `wa-cancel-${a.id}`,
            ...smsMessage("booking-cancellation", {
              patientName: a.patient_name,
              clinicName: a.clinic_name ?? branding.clinicName,
              treatmentName: a.treatment_name,
              locationName: (apptFull as { locations?: { name?: string } | null } | null)?.locations?.name,
              dateTime: a.scheduled_date && a.start_time ? formatBookingDateTime(a.scheduled_date, a.start_time) : null,
              bookingUrl: a.clinic_slug ? `${origin}/m/${a.clinic_slug}` : origin,
            }),
          });
        } catch (e) { console.error("[cancelAppointmentByToken] whatsapp failed", e); }
        await tryEnqueueAppEmail({
          templateName: "booking-cancellation",
          recipientEmail: a.patient_email,
          messageId: `booking-cancel-${a.id}`,
          templateData: {
            patientName: (a.patient_name ?? "").split(" ")[0] || "there",
            clinicName: a.clinic_name ?? branding.clinicName,
            treatmentName: a.treatment_name ?? "your appointment",
            dateTime: a.scheduled_date && a.start_time
              ? formatBookingDateTime(a.scheduled_date, a.start_time) : "",
            cancelledBy: "patient",
            rebookUrl: a.clinic_slug ? `${origin}/m/${a.clinic_slug}` : origin,
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
          },
        });
      } catch (e) { console.error("[cancelAppointmentByToken] email failed", e); }
    }
    return { ok: !!ok, autoRefundedCents };
  });

export const markAppointmentPaymentReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      appointmentId: string;
      kind: "deposit" | "full";
      amountCents: number;
      method: "cash" | "card_in_person" | "bank_transfer" | "other";
      reference?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const { data: appt, error: aErr } = await supabase
      .from("appointments")
      .select("id, total_amount, amount_paid_cents, deposit_required_cents")
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!appt) throw new Error("Appointment not found");

    const prevPaid = Number(appt.amount_paid_cents ?? 0);
    const patch: Record<string, unknown> = {
      payment_method: data.method,
      amount_paid_cents: prevPaid + data.amountCents,
    };
    const newPaid = prevPaid + data.amountCents;
    const totalCents = Math.round(Number(appt.total_amount ?? 0) * 100);
    if (data.kind === "deposit") {
      patch.deposit_paid_at = new Date().toISOString();
      if (!appt.deposit_required_cents) patch.deposit_required_cents = data.amountCents;
    }
    // Only settle the booking once the full amount is covered.
    if (!totalCents || newPaid >= totalCents) patch.payment_status = "paid";


    const { error: uErr } = await supabase
      .from("appointments")
      .update(patch as never)
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id);
    if (uErr) throw uErr;

    await supabase.from("payments").insert({
      profile_id: profile.id,
      appointment_id: data.appointmentId,
      amount: data.amountCents / 100,
      status: "succeeded",
      stripe_payment_intent_id:
        data.reference || `manual:${data.method}:${crypto.randomUUID()}`,
    } as never);

    return { ok: true };
  });

/**
 * Locations the clinic can move an appointment to for a given date/time.
 * A location is only offered when the practitioner works there at that time
 * (rota or one-off opening), it isn't blocked, and nothing else is booked.
 */
export const listRescheduleLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { appointmentId: string; date: string; startTime: string; endTime: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, location_id, practitioner_id")
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!appt) throw new Error("Appointment not found");

    const { data: locations } = await supabase
      .from("locations")
      .select("id, name, city, active")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("display_order");

    const toMin = (t: string) => {
      const [h, m] = String(t).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const wantStart = toMin(data.startTime);
    const wantEnd = toMin(data.endTime);
    const dow = new Date(`${data.date}T00:00:00`).getDay();
    const practitionerId = (appt as { practitioner_id?: string | null }).practitioner_id ?? null;

    const [{ data: rules }, { data: overrides }, { data: blockedTimes }, { data: blockedDates }, { data: busy }, { data: locPracs }] =
      await Promise.all([
        supabase.from("availability_rules")
          .select("location_id, practitioner_id, day_of_week, start_time, end_time, effective_from, effective_to")
          .eq("profile_id", profile.id).eq("day_of_week", dow),
        supabase.from("availability_overrides")
          .select("location_id, practitioner_id, start_time, end_time")
          .eq("profile_id", profile.id).eq("date", data.date),
        supabase.from("blocked_times")
          .select("location_id, practitioner_id, start_time, end_time")
          .eq("profile_id", profile.id).eq("date", data.date),
        supabase.from("blocked_dates")
          .select("location_id, practitioner_id")
          .eq("profile_id", profile.id).eq("date", data.date),
        supabase.from("appointments")
          .select("id, location_id, practitioner_id, start_time, end_time, status")
          .eq("profile_id", profile.id).eq("scheduled_date", data.date).neq("status", "cancelled"),
        supabase.from("location_practitioners").select("location_id, practitioner_id"),
      ]);

    const forPractitioner = (p: string | null | undefined) =>
      !p || !practitionerId || p === practitionerId;

    const covers = (from: string, to: string) => toMin(from) <= wantStart && toMin(to) >= wantEnd;
    const clashes = (from: string, to: string) => toMin(from) < wantEnd && wantStart < toMin(to);

    const results = (locations ?? []).map((l) => {
      const locId = l.id as string;
      const assigned = (locPracs ?? []).filter((lp) => lp.location_id === locId);
      if (practitionerId && assigned.length > 0 && !assigned.some((lp) => lp.practitioner_id === practitionerId)) {
        return { id: locId, name: l.name as string, city: (l.city as string) ?? null, available: false, reason: "Practitioner doesn't work here" };
      }
      if ((blockedDates ?? []).some((b) => (!b.location_id || b.location_id === locId) && forPractitioner(b.practitioner_id))) {
        return { id: locId, name: l.name as string, city: (l.city as string) ?? null, available: false, reason: "Closed that day" };
      }
      const openByOverride = (overrides ?? []).some(
        (o) => (!o.location_id || o.location_id === locId) && forPractitioner(o.practitioner_id) && covers(o.start_time as string, o.end_time as string),
      );
      const openByRule = (rules ?? []).some((r) => {
        if (r.location_id && r.location_id !== locId) return false;
        if (!forPractitioner(r.practitioner_id)) return false;
        if (r.effective_from && data.date < (r.effective_from as string)) return false;
        if (r.effective_to && data.date > (r.effective_to as string)) return false;
        return covers(r.start_time as string, r.end_time as string);
      });
      if (!openByOverride && !openByRule) {
        return { id: locId, name: l.name as string, city: (l.city as string) ?? null, available: false, reason: "Not open at that time" };
      }
      if ((blockedTimes ?? []).some((b) => (!b.location_id || b.location_id === locId) && forPractitioner(b.practitioner_id) && clashes(b.start_time as string, b.end_time as string))) {
        return { id: locId, name: l.name as string, city: (l.city as string) ?? null, available: false, reason: "Time blocked out" };
      }
      if ((busy ?? []).some((b) =>
        b.id !== data.appointmentId &&
        (!b.location_id || b.location_id === locId) &&
        forPractitioner(b.practitioner_id) &&
        clashes(b.start_time as string, b.end_time as string))) {
        return { id: locId, name: l.name as string, city: (l.city as string) ?? null, available: false, reason: "Already booked" };
      }
      return { id: locId, name: l.name as string, city: (l.city as string) ?? null, available: true, reason: null as string | null };
    });

    return { currentLocationId: (appt as { location_id?: string | null }).location_id ?? null, locations: results };
  });

/** How many appointments this patient has on the same day (for "move them all"). */
export const getAppointmentGroupCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, scheduled_date, patient_email, patient_phone, patient_name")
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!appt) return { count: 0 };

    let q = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("scheduled_date", appt.scheduled_date as string)
      .neq("status", "cancelled");
    if (appt.patient_email) q = q.eq("patient_email", appt.patient_email);
    else if (appt.patient_phone) q = q.eq("patient_phone", appt.patient_phone);
    else q = q.eq("patient_name", (appt.patient_name as string) ?? "");
    const { count } = await q;
    return { count: count ?? 0 };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      appointmentId: string;
      date: string;
      startTime: string;
      endTime: string;
      locationId?: string | null;
      notifyPatient?: boolean;
      moveGroup?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const { data: appt, error: aErr } = await supabase
      .from("appointments")
      .select("id, patient_name, patient_email, patient_phone, scheduled_date, start_time, end_time, locations(name, address_line1, city, postcode)")
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!appt) throw new Error("Appointment not found");

    const startHM = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
    const endHM = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;

    // Moving the whole visit: every appointment this patient has that day
    // keeps its original order and gap from the first one.
    type GroupRow = { id: string; start_time: string; end_time: string };
    let group: GroupRow[] = [{ id: appt.id, start_time: appt.start_time as string, end_time: appt.end_time as string }];
    if (data.moveGroup) {
      let q = supabase
        .from("appointments")
        .select("id, start_time, end_time")
        .eq("profile_id", profile.id)
        .eq("scheduled_date", appt.scheduled_date as string)
        .neq("status", "cancelled")
        .order("start_time");
      if (appt.patient_email) q = q.eq("patient_email", appt.patient_email);
      else if (appt.patient_phone) q = q.eq("patient_phone", appt.patient_phone);
      else q = q.eq("patient_name", (appt.patient_name as string) ?? "");
      const { data: rows } = await q;
      if (rows && rows.length > 0) group = rows as GroupRow[];
    }

    const toMin = (t: string) => {
      const [h, m] = String(t).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const fromMin = (n: number) =>
      `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

    // The dialog's start/end apply to the appointment being rescheduled; the
    // rest of the group shifts by the same amount.
    const anchor = group.find((g) => g.id === appt.id) ?? group[0]!;
    const delta = toMin(startHM) - toMin(anchor.start_time);
    const newTimes = group.map((g) => ({
      id: g.id,
      start: toMin(g.start_time) + delta,
      end: toMin(g.end_time) + delta,
    }));

    for (const t of newTimes) {
      const { error: uErr } = await supabase
        .from("appointments")
        .update({
          scheduled_date: data.date,
          start_time: `${fromMin(t.start)}:00`,
          end_time: `${fromMin(t.end)}:00`,
          ...(data.locationId !== undefined && t.id === appt.id ? { location_id: data.locationId } : {}),
        } as never)
        .eq("id", t.id)
        .eq("profile_id", profile.id);
      if (uErr) throw uErr;
    }

    // When the appointment moved to another location, tell the patient about
    // the new address rather than the old one.
    let locRow = (appt as { locations?: { name?: string; address_line1?: string; city?: string; postcode?: string } | null }).locations ?? null;
    if (data.locationId) {
      const { data: newLoc } = await supabase
        .from("locations")
        .select("name, address_line1, city, postcode")
        .eq("id", data.locationId)
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (newLoc) locRow = newLoc as typeof locRow;
    }

    if (data.notifyPatient ?? true) {
      try {
        const { formatBookingDateTime, getPractitionerBranding } = await import("@/lib/email/send.server");
        const { sendWhatsApp, smsMessage } = await import("@/lib/whatsapp/send.server");
        const branding = await getPractitionerBranding(profile.id);
        await sendWhatsApp({
          profileId: profile.id,
          appointmentId: data.appointmentId,
          kind: "booking-reschedule",
          toPhone: (appt as { patient_phone?: string | null }).patient_phone,
          messageKey: `wa-reschedule-${data.appointmentId}-${data.date}-${startHM}`,
          ...smsMessage("booking-reschedule", {
            patientName: appt.patient_name,
            locationName: locRow?.name,
            locationAddress: locRow ? [locRow.address_line1, locRow.city, locRow.postcode].filter(Boolean).join(', ') : undefined,
            clinicName: branding.clinicName,
            dateTime: formatBookingDateTime(data.date, startHM),
          }),
        });
      } catch (e) {
        console.error("[rescheduleAppointment] whatsapp failed", e);
      }
    }

    if ((data.notifyPatient ?? true) && appt.patient_email) {
      try {
        const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
        await sendBookingConfirmationEmails(
          newTimes.map((t) => t.id),
          `booking-reschedule-${data.date}-${startHM}`,
        );
      } catch (e) {
        console.error("[rescheduleAppointment] email failed", e);
      }
    }

    return { ok: true };
  });


