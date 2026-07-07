import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** List all consents (per-appointment + standalone) for a client. */
export const listConsentsForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { client_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase.rpc as any)(
      "list_consents_for_client",
      { p_client_id: data.client_id },
    );
    if (error) throw error;
    return (rows ?? []) as Array<{
      id: string;
      token: string;
      status: string;
      signed_at: string | null;
      signature_name: string | null;
      created_at: string;
      appointment_id: string | null;
      template_id: string;
      template_name: string;
    }>;
  });

/** Send a consent form to a client outside of any appointment. */
export const sendConsentToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { client_id: string; template_id: string; email?: string; sendEmail?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase.rpc as any)(
      "send_consent_to_client",
      { p_client_id: data.client_id, p_template_id: data.template_id },
    );
    if (error) throw error;
    const r = Array.isArray(row) ? row[0] : row;
    const id = r.id as string;
    const token = r.token as string;

    if (data.sendEmail && data.email) {
      try {
        const [{ data: tpl }, { data: client }, { data: profile }] = await Promise.all([
          context.supabase.from("consent_templates").select("name").eq("id", data.template_id).maybeSingle(),
          context.supabase.from("clinic_clients").select("full_name").eq("id", data.client_id).maybeSingle(),
          context.supabase.from("profiles").select("id, clinic_name").eq("user_id", context.userId).maybeSingle(),
        ]);
        const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
        const branding = await getPractitionerBranding((profile as { id?: string } | null)?.id);
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        await tryEnqueueAppEmail({
          templateName: "medical-form-request",
          recipientEmail: data.email,
          messageId: `consent-request-${id}`,
          templateData: {
            patientName: (client?.full_name ?? "").split(" ")[0] || "there",
            clinicName: profile?.clinic_name ?? branding.clinicName,
            formName: tpl?.name ?? "consent form",
            formUrl: `${origin}/c/${token}`,
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
          },
        });
      } catch (e) { console.error("[sendConsentToClient] email failed", e); }
    }

    return { id, token };
  });

export const getTreatmentConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { treatmentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("treatment_consents")
      .select("consent_template_id")
      .eq("treatment_id", data.treatmentId);
    if (error) throw error;
    return (rows ?? []).map((r) => r.consent_template_id);
  });

export const setTreatmentConsents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { treatmentId: string; consentTemplateIds: string[] }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Need profile_id for the rows
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .single();
    if (!profile) throw new Error("Profile not found");

    // Confirm treatment belongs to this practitioner
    const { data: t } = await supabase
      .from("treatments")
      .select("id, profile_id")
      .eq("id", data.treatmentId)
      .single();
    if (!t || t.profile_id !== profile.id) throw new Error("Not allowed");

    await supabase
      .from("treatment_consents")
      .delete()
      .eq("treatment_id", data.treatmentId);

    if (data.consentTemplateIds.length === 0) return { success: true };

    const rows = data.consentTemplateIds.map((cid) => ({
      treatment_id: data.treatmentId,
      consent_template_id: cid,
      profile_id: profile.id,
    }));
    const { error } = await supabase.from("treatment_consents").insert(rows);
    if (error) throw error;
    return { success: true };
  });

export const listMyConsentTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .single();
    if (!profile) return [];
    const { data } = await context.supabase
      .from("consent_templates")
      .select("id, name, treatment_type, is_system, summary, sections")
      .or(`is_system.eq.true,profile_id.eq.${profile.id}`)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    return data ?? [];
  });

export const getConsentTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("consent_templates")
      .select("id, name, treatment_type, is_system, summary, sections, body_markdown, requires_signature")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

/** Get treatments this consent template is currently attached to (for the current practitioner). */
export const getConsentTemplateTreatmentIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!profile) return [];
    const { data: rows, error } = await context.supabase
      .from("treatment_consents")
      .select("treatment_id")
      .eq("consent_template_id", data.template_id)
      .eq("profile_id", profile.id);
    if (error) throw error;
    return (rows ?? []).map((r: any) => r.treatment_id as string);
  });

/** Replace the set of treatments this consent template is attached to (for the current practitioner). */
export const setConsentTemplateTreatmentIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template_id: string; treatment_ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    await context.supabase
      .from("treatment_consents")
      .delete()
      .eq("consent_template_id", data.template_id)
      .eq("profile_id", profile.id);
    if (data.treatment_ids.length) {
      const rows = data.treatment_ids.map((tid) => ({
        treatment_id: tid,
        consent_template_id: data.template_id,
        profile_id: profile.id,
      }));
      const { error } = await context.supabase.from("treatment_consents").insert(rows);
      if (error) throw error;
    }
    return { ok: true };
  });
