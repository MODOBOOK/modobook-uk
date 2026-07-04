import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (pErr || !profile) throw new Error("Profile not found");

    const id = crypto.randomUUID();
    const { error } = await supabase.from("appointments").insert({
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
      patient_address: data.patientAddress as Database["public"]["Tables"]["appointments"]["Insert"]["patient_address"],
      notes: data.notes ?? null,
      status: "confirmed",
      payment_status: "pending",
      base_amount: data.basePrice,
      total_amount: data.basePrice,
      created_by_practitioner: true,
    });
    if (error) throw new Error(error.message);

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
    if (ok && a && a.patient_email && a.id) {
      try {
        const { tryEnqueueAppEmail, formatBookingDateTime } = await import("@/lib/email/send.server");
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        void tryEnqueueAppEmail({
          templateName: "booking-cancellation",
          recipientEmail: a.patient_email,
          messageId: `booking-cancel-${a.id}`,
          templateData: {
            patientName: (a.patient_name ?? "").split(" ")[0] || "there",
            clinicName: a.clinic_name ?? "MODO",
            treatmentName: a.treatment_name ?? "your appointment",
            dateTime: a.scheduled_date && a.start_time
              ? formatBookingDateTime(a.scheduled_date, a.start_time) : "",
            cancelledBy: "patient",
            rebookUrl: a.clinic_slug ? `${origin}/m/${a.clinic_slug}` : origin,
          },
        });
      } catch (e) { console.error("[cancelAppointmentByToken] email failed", e); }
    }
    return { ok: !!ok };
  });
