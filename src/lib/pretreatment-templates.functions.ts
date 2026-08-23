import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
  return data?.id ?? null;
}

export type PretreatmentTpl = {
  id: string;
  name: string;
  summary: string | null;
  body_html: string;
  sort_order: number;
  show_on_public: boolean;
  active: boolean;
  category: string;
  bullets: string[];
};

export const listPretreatmentTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("pretreatment_templates")
      .select("*")
      .eq("profile_id", profileId)
      .order("category")
      .order("sort_order")
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      ...r,
      bullets: Array.isArray(r.bullets) ? r.bullets : [],
      category: r.category ?? "general",
    })) as PretreatmentTpl[];
  });

export const savePretreatmentTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    name: string;
    summary?: string;
    body_html?: string;
    bullets?: string[];
    category?: string;
    show_on_public?: boolean;
    active?: boolean;
    sort_order?: number;
  }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const payload = {
      name: data.name,
      summary: data.summary ?? null,
      body_html: data.body_html ?? "",
      bullets: data.bullets ?? [],
      category: data.category ?? "general",
      show_on_public: data.show_on_public ?? true,
      active: data.active ?? true,
      ...(data.sort_order != null ? { sort_order: data.sort_order } : {}),
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("pretreatment_templates")
        .update(payload)
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("pretreatment_templates")
      .insert({ profile_id: profileId, sort_order: 0, ...payload })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deletePretreatmentTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pretreatment_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
