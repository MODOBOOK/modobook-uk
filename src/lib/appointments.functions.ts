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
    const totalCents = Math.round(Number(data.basePrice ?? 0) * 100);
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
    const { error } = await supabase.from("appointments").insert(insertRow as never);
    if (error) throw new Error(error.message);

    if (pr) {
      await supabase.from("payments").insert({
        profile_id: profile.id,
        appointment_id: id,
        amount: (pr.amountCents || totalCents) / 100,
        status: "succeeded",
        stripe_payment_intent_id: pr.reference || `manual:${pr.method}`,
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
    if (data.kind === "deposit") {
      patch.deposit_paid_at = new Date().toISOString();
      if (!appt.deposit_required_cents) patch.deposit_required_cents = data.amountCents;
    } else {
      patch.payment_status = "paid";
    }

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
      stripe_payment_intent_id: data.reference || `manual:${data.method}`,
    } as never);

    return { ok: true };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      appointmentId: string;
      date: string;
      startTime: string;
      endTime: string;
      notifyPatient?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const { data: appt, error: aErr } = await supabase
      .from("appointments")
      .select("id, patient_name, patient_email, patient_phone, scheduled_date, start_time, end_time, locations(name)")
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!appt) throw new Error("Appointment not found");

    const startHM = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
    const endHM = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;

    const { error: uErr } = await supabase
      .from("appointments")
      .update({
        scheduled_date: data.date,
        start_time: startHM,
        end_time: endHM,
      } as never)
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id);
    if (uErr) throw uErr;

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
            locationName: (appt as { locations?: { name?: string } | null }).locations?.name,
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
        const { tryEnqueueAppEmail, formatBookingDateTime, getPractitionerBranding } = await import("@/lib/email/send.server");
        const branding = await getPractitionerBranding(profile.id);
        await tryEnqueueAppEmail({
          templateName: "booking-confirmation",
          recipientEmail: appt.patient_email,
          messageId: `booking-reschedule-${data.appointmentId}-${data.date}-${startHM}`,
          templateData: {
            patientName: (appt.patient_name ?? "").split(" ")[0] || "there",
            clinicName: branding.clinicName,
            dateTime: formatBookingDateTime(data.date, startHM),
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
            rescheduled: true,
          },
        });
      } catch (e) {
        console.error("[rescheduleAppointment] email failed", e);
      }
    }

    return { ok: true };
  });


