import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .select("id, name, treatment_type, is_system")
      .or(`is_system.eq.true,profile_id.eq.${profile.id}`)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    return data ?? [];
  });
