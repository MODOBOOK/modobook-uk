import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
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
      .order("sort_order")
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as PretreatmentTpl[];
  });

export const savePretreatmentTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    name: string;
    summary?: string;
    body_html: string;
    show_on_public?: boolean;
    active?: boolean;
    sort_order?: number;
  }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("pretreatment_templates")
        .update({
          name: data.name,
          summary: data.summary ?? null,
          body_html: data.body_html,
          show_on_public: data.show_on_public ?? true,
          active: data.active ?? true,
          ...(data.sort_order != null ? { sort_order: data.sort_order } : {}),
        })
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("pretreatment_templates")
      .insert({
        profile_id: profileId,
        name: data.name,
        summary: data.summary ?? null,
        body_html: data.body_html,
        show_on_public: data.show_on_public ?? true,
        active: data.active ?? true,
        sort_order: data.sort_order ?? 0,
      })
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
