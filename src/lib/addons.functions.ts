import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function pubClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function getProfileId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export type AddonRow = {
  id: string;
  name: string;
  price_cents: number;
  duration_min: number;
  active: boolean;
  sort_order: number;
};
export type AddonLinkRow = {
  id: string;
  addon_id: string;
  treatment_id: string | null;
  category_id: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
};

/* ============ Practitioner ============ */

export const listAddons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return { addons: [] as AddonRow[], links: [] as AddonLinkRow[] };
    const [{ data: addons, error: aErr }, { data: links, error: lErr }] = await Promise.all([
      context.supabase.from("addons").select("*").eq("profile_id", pid).order("sort_order").order("created_at"),
      context.supabase.from("addon_links").select("*, addons!inner(profile_id)").eq("addons.profile_id", pid),
    ]);
    if (aErr) throw aErr;
    if (lErr) throw lErr;
    return {
      addons: (addons ?? []) as AddonRow[],
      links: ((links ?? []) as any[]).map((l) => ({
        id: l.id, addon_id: l.addon_id, treatment_id: l.treatment_id,
        category_id: l.category_id, discount_percent: l.discount_percent,
      })) as AddonLinkRow[],
    };
  });

export const upsertAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string; name: string; price_cents: number; duration_min: number;
    active?: boolean; sort_order?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const payload: any = {
      profile_id: pid,
      name: data.name.trim(),
      price_cents: data.price_cents | 0,
      duration_min: data.duration_min | 0,
      active: data.active ?? true,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("addons").update(payload).eq("id", data.id).eq("profile_id", pid).select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("addons").insert(payload).select().single();
    if (error) throw error;
    return row;
  });

export const deleteAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase
      .from("addons").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

export const setAddonLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    addon_id: string;
    treatments: { id: string; discount_percent?: number | null }[];
    categories: { id: string; discount_percent?: number | null }[];
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    // ownership check
    const { data: own } = await context.supabase
      .from("addons").select("id").eq("id", data.addon_id).eq("profile_id", pid).maybeSingle();
    if (!own) throw new Error("Add-on not found");

    await context.supabase.from("addon_links").delete().eq("addon_id", data.addon_id);
    const rows = [
      ...data.treatments.map((t) => ({
        addon_id: data.addon_id, treatment_id: t.id, category_id: null,
        discount_percent: t.discount_percent ?? null,
      })),
      ...data.categories.map((c) => ({
        addon_id: data.addon_id, treatment_id: null, category_id: c.id,
        discount_percent: c.discount_percent ?? null,
      })),
    ];
    if (rows.length) {
      const { error } = await context.supabase.from("addon_links").insert(rows as never);
      if (error) throw error;
    }
    return { ok: true };
  });

/* ============ Public (booking) ============ */

export type PublicAddon = {
  id: string;
  name: string;
  price_cents: number;
  duration_min: number;
  discount_percent: number | null; // best (highest) applicable discount
};

export const listAddonsForBooking = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; treatment_ids: string[] }) => input)
  .handler(async ({ data }) => {
    if (!data.treatment_ids.length) return [] as PublicAddon[];
    const supabase = pubClient();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr || !profile) return [];

    // Resolve treatments → their categories
    const { data: treats } = await supabase
      .from("treatments")
      .select("id, category_id")
      .in("id", data.treatment_ids)
      .eq("profile_id", profile.id);
    const treatIds = (treats ?? []).map((t) => t.id);
    const catIds = Array.from(new Set((treats ?? []).map((t) => t.category_id).filter(Boolean) as string[]));

    // Walk up category ancestors so a link on a parent category applies to children
    const allCatIds = new Set<string>(catIds);
    if (catIds.length) {
      const { data: allCats } = await supabase
        .from("treatment_categories")
        .select("id, parent_id")
        .eq("profile_id", profile.id);
      const byId = new Map<string, string | null>();
      (allCats ?? []).forEach((c: any) => byId.set(c.id, c.parent_id ?? null));
      for (const id of catIds) {
        let cur = byId.get(id) ?? null;
        let guard = 0;
        while (cur && guard++ < 20) { allCatIds.add(cur); cur = byId.get(cur) ?? null; }
      }
    }

    // Fetch matching links
    const orFilters: string[] = [];
    if (treatIds.length) orFilters.push(`treatment_id.in.(${treatIds.join(",")})`);
    if (allCatIds.size) orFilters.push(`category_id.in.(${Array.from(allCatIds).join(",")})`);
    if (!orFilters.length) return [];
    const { data: links } = await supabase
      .from("addon_links")
      .select("addon_id, discount_percent, addons!inner(id, name, price_cents, duration_min, active, profile_id, sort_order)")
      .or(orFilters.join(","));

    const best = new Map<string, PublicAddon>();
    for (const l of (links ?? []) as any[]) {
      const a = l.addons;
      if (!a || !a.active || a.profile_id !== profile.id) continue;
      const cur = best.get(a.id);
      const disc = l.discount_percent != null ? Number(l.discount_percent) : null;
      if (!cur) {
        best.set(a.id, {
          id: a.id, name: a.name, price_cents: a.price_cents,
          duration_min: a.duration_min, discount_percent: disc,
        });
      } else if (disc != null && (cur.discount_percent == null || disc > cur.discount_percent)) {
        cur.discount_percent = disc;
      }
    }
    return Array.from(best.values()).sort((a, b) => a.name.localeCompare(b.name));
  });
