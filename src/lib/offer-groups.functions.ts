import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OfferGroupItemInput = {
  treatment_id: string | null;
  package_id: string | null;
  offer_price: number | null;
};

export type OfferGroupInput = {
  name: string;
  subtitle: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  pricing_mode: "none" | "percent" | "item";
  discount_percent: number | null;
  items: OfferGroupItemInput[];
};

async function myProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).single();
  if (!data) throw new Error("No profile");
  return data.id as string;
}

export const listMyOfferGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", userId).single();
    if (!profile) return [];
    const { data: groups, error } = await supabase
      .from("offer_groups")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (groups ?? []).map((g: { id: string }) => g.id);
    const { data: items } = ids.length
      ? await supabase.from("offer_group_items").select("*").in("group_id", ids).order("sort_order")
      : { data: [] as any[] };
    return (groups ?? []).map((g: any) => ({
      ...g,
      items: (items ?? []).filter((i: any) => i.group_id === g.id),
    }));
  });

async function saveItems(
  supabase: any,
  profileId: string,
  groupId: string,
  items: OfferGroupItemInput[],
) {
  await supabase.from("offer_group_items").delete().eq("group_id", groupId);
  const rows = (items ?? [])
    .filter((i) => i.treatment_id || i.package_id)
    .map((i, idx) => ({
      group_id: groupId,
      profile_id: profileId,
      treatment_id: i.treatment_id ?? null,
      package_id: i.package_id ?? null,
      offer_price: i.offer_price ?? null,
      sort_order: idx,
    }));
  if (rows.length) {
    const { error } = await supabase.from("offer_group_items").insert(rows);
    if (error) throw new Error(error.message);
  }
}

function groupFields(d: OfferGroupInput) {
  return {
    name: d.name.trim(),
    subtitle: d.subtitle?.trim() || null,
    starts_at: d.starts_at ?? null,
    ends_at: d.ends_at ?? null,
    active: d.active,
    pricing_mode: d.pricing_mode,
    discount_percent: d.pricing_mode === "percent" ? d.discount_percent ?? null : null,
  };
}

export const createOfferGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: OfferGroupInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await myProfileId(supabase, userId);
    const { data: created, error } = await supabase
      .from("offer_groups")
      .insert({ profile_id: profileId, ...groupFields(data) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await saveItems(supabase, profileId, created.id, data.items);
    return { id: created.id as string };
  });

export const updateOfferGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: OfferGroupInput & { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await myProfileId(supabase, userId);
    const { error } = await supabase
      .from("offer_groups")
      .update(groupFields(data))
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    await saveItems(supabase, profileId, data.id, data.items);
    return { ok: true };
  });

export const deleteOfferGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("offer_groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
