import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
    .eq("user_id", userId)
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
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data;
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      parent_id?: string | null;
      description?: string;
      icon?: string;
      sort_order?: number;
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
      })
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
