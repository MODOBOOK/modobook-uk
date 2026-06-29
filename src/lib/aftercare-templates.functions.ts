import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export const listAftercareTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("aftercare_templates")
      .select("*")
      .eq("profile_id", profileId)
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const saveAftercareTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string; name: string; body_html: string; delay_hours: number }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("aftercare_templates")
        .update({ name: data.name, body_html: data.body_html, delay_hours: data.delay_hours })
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("aftercare_templates")
      .insert({ profile_id: profileId, name: data.name, body_html: data.body_html, delay_hours: data.delay_hours })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAftercareTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("aftercare_templates").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getTreatmentAftercareIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatment_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("treatment_aftercare_templates")
      .select("template_id")
      .eq("treatment_id", data.treatment_id);
    if (error) throw error;
    return (rows ?? []).map((r: any) => r.template_id as string);
  });

export const setTreatmentAftercareIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatment_id: string; template_ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("treatment_aftercare_templates")
      .delete()
      .eq("treatment_id", data.treatment_id);
    if (data.template_ids.length) {
      const { error } = await context.supabase
        .from("treatment_aftercare_templates")
        .insert(data.template_ids.map((tid) => ({ treatment_id: data.treatment_id, template_id: tid })));
      if (error) throw error;
    }
    return { ok: true };
  });
