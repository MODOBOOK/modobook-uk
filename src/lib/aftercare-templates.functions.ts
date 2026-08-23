import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

function decodeEntities(s: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith("#x")) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith("#")) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[key] ?? match;
  });
}

function plainAftercareText(value: string | null | undefined) {
  return decodeEntities(value ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
  return data?.id ?? null;
}

export const listAftercareTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("aftercare_templates")
      .select("*")
      .or(`is_system.eq.true${profileId ? `,profile_id.eq.${profileId}` : ""}`)
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const cloneSystemAftercareTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: src, error: e1 } = await context.supabase
      .from("aftercare_templates")
      .select("name, body_html, delay_hours, category, summary")
      .eq("id", data.id)
      .eq("is_system", true)
      .single();
    if (e1) throw e1;
    const { data: row, error } = await context.supabase
      .from("aftercare_templates")
      .insert({
        profile_id: profileId,
        is_system: false,
        name: `${src.name} (my copy)`,
        body_html: plainAftercareText(src.body_html),
        delay_hours: src.delay_hours,
        category: src.category,
        summary: src.summary,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const saveAftercareTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string; name: string; body_html: string; delay_hours: number; show_on_public?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const body_html = plainAftercareText(data.body_html);
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("aftercare_templates")
        .update({ name: data.name, body_html, delay_hours: data.delay_hours, show_on_public: !!data.show_on_public })
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("aftercare_templates")
      .insert({ profile_id: profileId, name: data.name, body_html, delay_hours: data.delay_hours, show_on_public: !!data.show_on_public })
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

export const listMyTreatmentsBasic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("treatments")
      .select("id, name")
      .eq("profile_id", profileId)
      .order("name");
    if (error) throw error;
    return (data ?? []) as { id: string; name: string }[];
  });

export const getAftercareTemplateTreatmentIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).maybeSingle();
    if (!profile) return [];
    const { data: myTreatments } = await context.supabase
      .from("treatments").select("id").eq("profile_id", profile.id);
    const myIds = (myTreatments ?? []).map((t: any) => t.id as string);
    if (!myIds.length) return [];
    const { data: rows, error } = await context.supabase
      .from("treatment_aftercare_templates")
      .select("treatment_id")
      .eq("template_id", data.template_id)
      .in("treatment_id", myIds);
    if (error) throw error;
    return (rows ?? []).map((r: any) => r.treatment_id as string);
  });

export const setAftercareTemplateTreatmentIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template_id: string; treatment_ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    // Scope both delete and insert to the current practitioner's treatments so
    // attaching a system template does not clobber other practitioners' links.
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const { data: myTreatments } = await context.supabase
      .from("treatments").select("id").eq("profile_id", profile.id);
    const myIds = (myTreatments ?? []).map((t: any) => t.id as string);
    if (myIds.length) {
      await context.supabase
        .from("treatment_aftercare_templates")
        .delete()
        .eq("template_id", data.template_id)
        .in("treatment_id", myIds);
    }
    const allowed = data.treatment_ids.filter((tid) => myIds.includes(tid));
    if (allowed.length) {
      const { error } = await context.supabase
        .from("treatment_aftercare_templates")
        .insert(allowed.map((tid) => ({ treatment_id: tid, template_id: data.template_id })));
      if (error) throw error;
    }
    return { ok: true };
  });
