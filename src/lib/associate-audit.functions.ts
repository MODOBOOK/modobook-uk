/**
 * Consent-gated access to an associate's patient records, plus the shared
 * audit trail that BOTH the host clinic owner and the associate can read.
 *
 * Financial data (prices, payment status, invoices) is deliberately never
 * returned here — oversight is clinical only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, clinic_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { id: string; full_name: string | null; clinic_name: string | null; email: string | null } | null;
}

/** A link is live for oversight when accepted, or when the clinic owns both sides. */
function isLinkLive(link: { status?: string | null; associate_profile_id?: string | null }, clinicProfileId: string) {
  if (link.status === "active") return true;
  return Boolean(link.associate_profile_id && link.associate_profile_id === clinicProfileId);
}

export type AccessLogEntry = {
  id: string;
  created_at: string;
  actor_name: string | null;
  client_name: string | null;
  client_id: string | null;
  action: string;
  reason: string | null;
  lawful_basis: string | null;
  consent_clinical: boolean;
  consent_minimum: boolean;
  consent_logged: boolean;
};

/**
 * Open one patient record. The clinic owner must tick the consent boxes and
 * give a reason — every call writes an audit entry both sides can see.
 */
export const openAssociatePatientRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      clientId: string;
      reason: string;
      lawfulBasis?: string | null;
      consentClinical: boolean;
      consentMinimum: boolean;
      consentLogged: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    if (!data.consentClinical || !data.consentMinimum || !data.consentLogged) {
      throw new Error("Please confirm all three statements before opening the record");
    }
    if (!data.reason?.trim() || data.reason.trim().length < 4) {
      throw new Error("Please give a reason for opening this record");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    const { data: link } = await admin
      .from("clinic_associates")
      .select("id, associate_profile_id, status, oversight_records")
      .eq("id", data.id)
      .eq("clinic_profile_id", prof.id)
      .maybeSingle();
    if (!link?.oversight_records || !isLinkLive(link, prof.id)) throw new Error("Not permitted");

    const { data: client } = await admin
      .from("clinic_clients")
      .select("*")
      .eq("id", data.clientId)
      .eq("profile_id", link.associate_profile_id)
      .maybeSingle();
    if (!client) throw new Error("Patient not found");

    // Never surface money — strip anything financial from the client row.
    for (const k of Object.keys(client)) {
      if (/price|amount|paid|spend|balance|invoice|stripe|payment/i.test(k)) delete client[k];
    }

    const [
      { data: notes },
      { data: appts },
      { data: consents },
      { data: forms },
      { data: meds },
      { data: concerns },
      { data: files },
      { data: consultations },
      { data: prescriptions },
    ] = await Promise.all([
      admin
        .from("client_notes")
        .select("id, body, created_at, visible_to_patient")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(200),
      client.email
        ? admin
            .from("appointments")
            .select("id, scheduled_date, start_time, status, patient_name, notes, treatment_name_snapshot, treatments(name)")
            .eq("profile_id", link.associate_profile_id)
            .ilike("patient_email", client.email)
            .order("scheduled_date", { ascending: false })
            .limit(150)
        : Promise.resolve({ data: [] }),
      admin
        .from("appointment_consents")
        .select("id, signed_at, status, created_at, consent_templates(name)")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("appointment_medical_forms")
        .select("id, status, submitted_at, created_at, response, medical_form_templates(name, schema)")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("client_medications")
        .select("id, drug, dose, route, frequency, prescriber, is_current, started_on, stopped_on, notes")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("client_concerns")
        .select("id, label, severity, resolved, notes, created_at")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("client_files")
        .select("id, kind, url, filename, created_at")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(60),
      client.email
        ? admin
            .from("consultations")
            .select(
              "id, created_at, completed_at, status, current_step, has_allergies, medical, concerns, assessment, treatment_plan, treatment_log, consent, notes",
            )
            .eq("profile_id", link.associate_profile_id)
            .ilike("patient_email", client.email)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
      admin
        .from("client_prescriptions")
        .select("id, product, dose, directions, prescribed_on, prescriber_name, created_at")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    await admin.from("associate_access_log").insert({
      link_id: link.id,
      clinic_profile_id: prof.id,
      associate_profile_id: link.associate_profile_id,
      client_id: data.clientId,
      client_name: client.full_name ?? null,
      actor_user_id: context.userId,
      actor_name: prof.clinic_name || prof.full_name || prof.email,
      action: "view_record",
      reason: data.reason.trim(),
      lawful_basis: data.lawfulBasis?.trim() || null,
      consent_clinical: true,
      consent_minimum: true,
      consent_logged: true,
    });

    return {
      client,
      notes: notes ?? [],
      appointments: appts ?? [],
      consents: consents ?? [],
      forms: forms ?? [],
      medications: meds ?? [],
      concerns: concerns ?? [],
      files: files ?? [],
      consultations: consultations ?? [],
      prescriptions: prescriptions ?? [],
    };
  });

/** Clinic owner: audit trail for one associate (optionally one patient). */
export const listAssociateAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; clientId?: string | null }) => d)
  .handler(async ({ data, context }): Promise<AccessLogEntry[]> => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin
      .from("clinic_associates")
      .select("id")
      .eq("id", data.id)
      .eq("clinic_profile_id", prof.id)
      .maybeSingle();
    if (!link) return [];
    let q = admin
      .from("associate_access_log")
      .select("*")
      .eq("link_id", link.id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.clientId) q = q.eq("client_id", data.clientId);
    const { data: rows } = await q;
    return (rows ?? []) as AccessLogEntry[];
  });

/** Associate side: every time a host clinic opened one of my patient records. */
export const listMyRecordAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessLogEntry[]> => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: rows } = await admin
      .from("associate_access_log")
      .select("*")
      .eq("associate_profile_id", prof.id)
      .order("created_at", { ascending: false })
      .limit(300);
    return (rows ?? []) as AccessLogEntry[];
  });
