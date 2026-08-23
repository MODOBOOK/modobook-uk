import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

const KIND = "training";

function slugify(name: string) {
  return `trn-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

async function profileIdOf(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).single();
  if (error) throw error;
  return data.id as string;
}

export const listTrainingCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await profileIdOf(supabase, userId);
    const { data, error } = await supabase
      .from("treatment_categories")
      .select("id, name, sort_order")
      .eq("profile_id", profileId)
      .eq("kind", KIND)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as { id: string; name: string; sort_order: number }[];
  });

export const createTrainingCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await profileIdOf(supabase, userId);
    const { count } = await supabase
      .from("treatment_categories")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("kind", KIND);
    const { data: row, error } = await supabase
      .from("treatment_categories")
      .insert({
        profile_id: profileId,
        name: data.name.trim(),
        kind: KIND,
        slug: slugify(data.name),
        sort_order: count ?? 0,
      } as never)
      .select("id, name, sort_order")
      .single();
    if (error) throw error;
    return row;
  });

export const renameTrainingCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("treatment_categories")
      .update({ name: data.name.trim(), slug: slugify(data.name) } as never)
      .eq("id", data.id)
      .eq("kind", KIND);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTrainingCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("treatment_categories")
      .delete()
      .eq("id", data.id)
      .eq("kind", KIND);
    if (error) throw error;
    return { ok: true };
  });

export const reorderTrainingCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await profileIdOf(supabase, userId);
    await Promise.all(
      data.ids.map((id, idx) =>
        supabase
          .from("treatment_categories")
          .update({ sort_order: idx } as never)
          .eq("id", id)
          .eq("profile_id", profileId)
          .eq("kind", KIND),
      ),
    );
    return { ok: true };
  });
