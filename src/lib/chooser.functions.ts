import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

function getPublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function getOwnProfileId(supabase: ReturnType<typeof getPublic>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", await __activeProfileId(supabase, userId))
    .single();
  if (error) throw error;
  return data.id as string;
}

/* ---------- Dashboard CRUD ---------- */

export const listMyConcernData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getOwnProfileId(supabase, userId);
    const [areas, concerns, links] = await Promise.all([
      supabase.from("concern_areas").select("*").eq("profile_id", profileId).order("sort_order"),
      supabase.from("concerns").select("*").eq("profile_id", profileId).order("sort_order"),
      supabase.from("concern_treatments").select("*").eq("profile_id", profileId),
    ]);
    if (areas.error) throw areas.error;
    if (concerns.error) throw concerns.error;
    if (links.error) throw links.error;
    return {
      areas: areas.data ?? [],
      concerns: concerns.data ?? [],
      links: links.data ?? [],
    };
  });

export const createConcernArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string; sort_order?: number }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getOwnProfileId(supabase, userId);
    const { data: row, error } = await supabase
      .from("concern_areas")
      .insert({ profile_id: profileId, name: data.name, sort_order: data.sort_order ?? 0 })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateConcernArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; name?: string; sort_order?: number }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.sort_order !== undefined) update.sort_order = data.sort_order;
    const { error } = await supabase.from("concern_areas").update(update as never).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteConcernArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("concern_areas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const createConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { area_id: string; name: string; description?: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getOwnProfileId(supabase, userId);
    const { data: row, error } = await supabase
      .from("concerns")
      .insert({
        profile_id: profileId,
        area_id: data.area_id,
        name: data.name,
        description: data.description ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; name?: string; description?: string | null; area_id?: string }) => i)
  .handler(async ({ data, context }) => {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.area_id !== undefined) update.area_id = data.area_id;
    const { error } = await context.supabase.from("concerns").update(update as never).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("concerns").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setConcernTreatments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { concern_id: string; treatment_ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getOwnProfileId(supabase, userId);
    const del = await supabase
      .from("concern_treatments")
      .delete()
      .eq("concern_id", data.concern_id);
    if (del.error) throw del.error;
    if (data.treatment_ids.length > 0) {
      const rows = data.treatment_ids.map((tid, idx) => ({
        concern_id: data.concern_id,
        treatment_id: tid,
        profile_id: profileId,
        sort_order: idx,
      }));
      const ins = await supabase.from("concern_treatments").insert(rows);
      if (ins.error) throw ins.error;
    }
    return { ok: true };
  });

/* ---------- Public read for booking page ---------- */

export const getPublicChooser = createServerFn({ method: "GET" })
  .inputValidator((i: { profile_id: string }) => i)
  .handler(async ({ data }) => {
    const supabase = getPublic();
    const [areas, concerns, links] = await Promise.all([
      supabase.from("concern_areas").select("*").eq("profile_id", data.profile_id).order("sort_order"),
      supabase.from("concerns").select("*").eq("profile_id", data.profile_id).order("sort_order"),
      supabase.from("concern_treatments").select("concern_id, treatment_id, sort_order").eq("profile_id", data.profile_id),
    ]);
    return {
      areas: areas.data ?? [],
      concerns: concerns.data ?? [],
      links: links.data ?? [],
    };
  });
