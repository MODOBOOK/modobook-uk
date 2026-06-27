import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/* ============ MEDICAL FORM TEMPLATES ============ */

export const listMedicalTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medical_form_templates")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const cloneMedicalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { template_id: string; name?: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: src, error: e1 } = await context.supabase
      .from("medical_form_templates")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (e1) throw e1;
    const { data: row, error } = await context.supabase
      .from("medical_form_templates")
      .insert({
        profile_id: profileId,
        name: data.name ?? `${src.name} (copy)`,
        description: src.description,
        schema: src.schema,
        is_system: false,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const saveMedicalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      description?: string | null;
      schema: unknown;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("medical_form_templates")
        .update({
          name: data.name,
          description: data.description ?? null,
          schema: data.schema as any,
        })
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("medical_form_templates")
      .insert({
        profile_id: profileId,
        name: data.name,
        description: data.description ?? null,
        schema: data.schema as any,
        is_system: false,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteMedicalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_form_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ============ CONSENT TEMPLATES ============ */

export const listConsentTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("consent_templates")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const cloneConsentTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { template_id: string; name?: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: src, error: e1 } = await context.supabase
      .from("consent_templates")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (e1) throw e1;
    const { data: row, error } = await context.supabase
      .from("consent_templates")
      .insert({
        profile_id: profileId,
        name: data.name ?? `${src.name} (copy)`,
        treatment_type: src.treatment_type,
        body_markdown: src.body_markdown,
        requires_signature: src.requires_signature,
        is_system: false,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const saveConsentTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      treatment_type?: string | null;
      body_markdown: string;
      requires_signature?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("consent_templates")
        .update({
          name: data.name,
          treatment_type: data.treatment_type ?? null,
          body_markdown: data.body_markdown,
          requires_signature: data.requires_signature ?? true,
        })
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("consent_templates")
      .insert({
        profile_id: profileId,
        name: data.name,
        treatment_type: data.treatment_type ?? null,
        body_markdown: data.body_markdown,
        requires_signature: data.requires_signature ?? true,
        is_system: false,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteConsentTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("consent_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
