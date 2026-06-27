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

export type AddonLink = {
  addon_id: string;
  discount_percent: number | null;
  discount_amount: number | null;
};

export const getTreatmentAddons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { treatmentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("treatment_addons")
      .select("addon_id, discount_percent, discount_amount")
      .eq("treatment_id", data.treatmentId);
    if (error) throw error;
    return (rows ?? []) as AddonLink[];
  });

export const setTreatmentAddons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { treatmentId: string; addons: AddonLink[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("treatment_addons").delete().eq("treatment_id", data.treatmentId);
    if (data.addons.length === 0) return { ok: true };
    const rows = data.addons.map((a) => ({
      treatment_id: data.treatmentId,
      addon_id: a.addon_id,
      discount_percent: a.discount_percent,
      discount_amount: a.discount_amount,
    }));
    const { error } = await supabase.from("treatment_addons").insert(rows as never);
    if (error) throw error;
    return { ok: true };
  });

// Public: fetch all addon links for a slug so the booking page can resolve
// add-ons by treatment_id on the client.
export const getPublicTreatmentAddons = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = pubClient();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;
    const { data: treatIds, error: tErr } = await supabase
      .from("treatments")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("active", true);
    if (tErr) throw tErr;
    const ids = (treatIds ?? []).map((t) => t.id);
    if (ids.length === 0)
      return [] as { treatment_id: string; addon_id: string; discount_percent: number | null; discount_amount: number | null }[];
    const { data: rows, error } = await supabase
      .from("treatment_addons")
      .select("treatment_id, addon_id, discount_percent, discount_amount")
      .in("treatment_id", ids);
    if (error) throw error;
    return rows ?? [];
  });
