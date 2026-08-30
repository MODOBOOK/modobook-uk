import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

function getServerSupabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

async function getMyProfileId(supabase: ReturnType<typeof getServerSupabasePublic>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", await __activeProfileId(supabase, userId))
    .single();
  if (error) throw error;
  return data.id;
}

export const getMyCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const profileId = await getMyProfileId(supabase as never, context.userId);
    const { data, error } = await supabase
      .from("treatment_categories")
      .select("*")
      .eq("profile_id", profileId)
      .eq("kind", "treatment")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data;
  });

export const getMyPackageCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const profileId = await getMyProfileId(supabase as never, context.userId);
    const { data, error } = await supabase
      .from("treatment_categories")
      .select("*")
      .eq("profile_id", profileId)
      .eq("kind", "package")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data;
  });

export const createPackageCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; sort_order?: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const profileId = await getMyProfileId(supabase as never, context.userId);
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const { data: row, error } = await supabase
      .from("treatment_categories")
      .insert({
        profile_id: profileId,
        name: data.name,
        slug: `pkg-${slug}`,
        sort_order: data.sort_order ?? 0,
        kind: "package",
      } as never)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deletePackageCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("treatment_categories")
      .delete()
      .eq("id", data.id)
      .eq("kind", "package");
    if (error) throw error;
    return { success: true };
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      parent_id?: string | null;
      description?: string | null;
      icon?: string | null;
      sort_order?: number;
      coming_soon_at?: string | null;
      rebook_reminder_days?: number | null;
      topup_reminder_days?: number | null;
      is_limited?: boolean;
      limited_starts_at?: string | null;
      limited_ends_at?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const profileId = await getMyProfileId(supabase as never, context.userId);
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const { data: row, error } = await supabase
      .from("treatment_categories")
      .insert({
        profile_id: profileId,
        name: data.name,
        parent_id: data.parent_id ?? null,
        description: data.description ?? null,
        icon: data.icon ?? null,
        sort_order: data.sort_order ?? 0,
        slug,
        coming_soon_at: data.coming_soon_at ?? null,
        rebook_reminder_days: data.rebook_reminder_days ?? null,
        topup_reminder_days: data.topup_reminder_days ?? null,
        is_limited: data.is_limited ?? false,
        limited_starts_at: data.limited_starts_at ?? null,
        limited_ends_at: data.limited_ends_at ?? null,
      } as never)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      parent_id?: string | null;
      description?: string | null;
      icon?: string | null;
      sort_order?: number;
      coming_soon_at?: string | null;
      rebook_reminder_days?: number | null;
      topup_reminder_days?: number | null;
      is_limited?: boolean;
      limited_starts_at?: string | null;
      limited_ends_at?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const update: Database["public"]["Tables"]["treatment_categories"]["Update"] = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.parent_id !== undefined) update.parent_id = data.parent_id;
    if (data.description !== undefined) update.description = data.description;
    if (data.icon !== undefined) update.icon = data.icon;
    if (data.sort_order !== undefined) update.sort_order = data.sort_order;
    if (data.coming_soon_at !== undefined) update.coming_soon_at = data.coming_soon_at;
    if (data.rebook_reminder_days !== undefined) (update as Record<string, unknown>).rebook_reminder_days = data.rebook_reminder_days;
    if (data.topup_reminder_days !== undefined) (update as Record<string, unknown>).topup_reminder_days = data.topup_reminder_days;
    if (data.is_limited !== undefined) (update as Record<string, unknown>).is_limited = data.is_limited;
    if (data.limited_starts_at !== undefined) (update as Record<string, unknown>).limited_starts_at = data.limited_starts_at;
    if (data.limited_ends_at !== undefined) (update as Record<string, unknown>).limited_ends_at = data.limited_ends_at;
    const { data: row, error } = await supabase
      .from("treatment_categories")
      .update(update)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("treatment_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).single();
    if (error) throw error;
    await Promise.all(
      data.ids.map((id, idx) =>
        supabase
          .from("treatment_categories")
          .update({ sort_order: idx })
          .eq("id", id)
          .eq("profile_id", profile.id),
      ),
    );
    return { success: true };
  });


export const getCategoriesBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;
    const { data: cats, error } = await supabase
      .from("treatment_categories")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return cats;
  });
