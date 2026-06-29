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

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

/* ---------- Form categories ---------- */
export const listFormCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("medical_form_categories")
      .select("*")
      .eq("profile_id", profileId)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertFormCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("medical_form_categories")
        .update({ name: data.name })
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("medical_form_categories")
      .insert({ profile_id: profileId, name: data.name })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteFormCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_form_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Form templates ---------- */
export const listForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("medical_form_templates")
      .select("*")
      .or(`profile_id.eq.${profileId},is_system.eq.true`)
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const getForm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("medical_form_templates")
      .select("*, treatment_medical_forms(treatment_id)")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return row;
  });

export const saveForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    name: string;
    description?: string | null;
    category_id?: string | null;
    validity?: string;
    schema: unknown;
    treatment_ids?: string[];
  }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    let id = data.id;
    if (id) {
      const { error } = await context.supabase
        .from("medical_form_templates")
        .update({
          name: data.name,
          description: data.description ?? null,
          category_id: data.category_id ?? null,
          validity: data.validity ?? "always_required",
          schema: data.schema as any,
        })
        .eq("id", id)
        .eq("profile_id", profileId);
      if (error) throw error;
    } else {
      const { data: row, error } = await context.supabase
        .from("medical_form_templates")
        .insert({
          profile_id: profileId,
          name: data.name,
          description: data.description ?? null,
          category_id: data.category_id ?? null,
          validity: data.validity ?? "always_required",
          schema: data.schema as any,
          is_system: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      id = row.id;
    }
    // sync treatment links
    if (data.treatment_ids) {
      await context.supabase.from("treatment_medical_forms").delete().eq("template_id", id);
      if (data.treatment_ids.length) {
        await context.supabase.from("treatment_medical_forms").insert(
          data.treatment_ids.map((tid) => ({ template_id: id!, treatment_id: tid })),
        );
      }
    }
    return { id };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_form_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Treatment form links (for treatments editor) ---------- */
export const getTreatmentFormIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatment_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("treatment_medical_forms")
      .select("template_id")
      .eq("treatment_id", data.treatment_id);
    if (error) throw error;
    return (rows ?? []).map((r: any) => r.template_id as string);
  });

export const setTreatmentFormIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatment_id: string; template_ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    await context.supabase.from("treatment_medical_forms").delete().eq("treatment_id", data.treatment_id);
    if (data.template_ids.length) {
      const { error } = await context.supabase.from("treatment_medical_forms").insert(
        data.template_ids.map((tid) => ({ treatment_id: data.treatment_id, template_id: tid })),
      );
      if (error) throw error;
    }
    return { ok: true };
  });

/* ---------- Per-appointment forms (practitioner side) ---------- */
export const listFormsForAppointment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { appointment_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("appointment_medical_forms")
      .select("id, status, token, submitted_at, template:template_id (id, name)")
      .eq("appointment_id", data.appointment_id);
    if (error) throw error;
    return rows ?? [];
  });

/* ---------- Public token-based fill flow ---------- */
export const getFormByToken = createServerFn({ method: "GET" })
  .inputValidator((i: { token: string }) => i)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb.rpc("get_medical_form_by_token", { p_token: data.token }).single();
    if (error) throw error;
    return row;
  });

export const submitFormByToken = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; response: unknown }) => i)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: ok, error } = await sb.rpc("submit_medical_form", {
      p_token: data.token,
      p_response: data.response as any,
    });
    if (error) throw error;
    return { ok: !!ok };
  });

/* ---------- Standalone send-to-patient (no appointment) ---------- */
export const sendFormToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { client_id: string; template_id: string; email?: string; phone?: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("send_medical_form_to_client", {
      p_client_id: data.client_id,
      p_template_id: data.template_id,
      p_email: (data.email ?? "") as string,
      p_phone: (data.phone ?? "") as string,
    });
    if (error) throw error;
    // row is a setof: take first
    const r = Array.isArray(row) ? row[0] : row;
    return { id: r.id as string, token: r.token as string };
  });

export const listFormsForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { client_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("appointment_medical_forms")
      .select("id, token, status, submitted_at, created_at, recipient_email, recipient_phone, template:template_id (id, name)")
      .eq("client_id", data.client_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

