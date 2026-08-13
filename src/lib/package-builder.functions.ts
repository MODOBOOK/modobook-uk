import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeBuilderPrice, validateSelection, type BuilderRules } from "@/lib/package-builder-pricing";

export type BuilderInput = {
  id?: string;
  name: string;
  description: string | null;
  image_url: string | null;
  mode: string;
  discount_percent: number;
  tiers: { min: number; value: number }[];
  fixed_price: number | null;
  pick_count: number | null;
  min_items: number;
  max_items: number | null;
  category_id: string | null;
  show_in_packages: boolean;
  active: boolean;
  items: { treatment_id: string; max_qty: number }[];
};

export const listMyPackageBuilders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("user_id", userId).single();
    if (!profile) return [];
    const { data: builders, error } = await supabase
      .from("package_builders").select("*").eq("profile_id", profile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (builders ?? []).map((b) => b.id);
    const { data: items } = ids.length
      ? await supabase.from("package_builder_items").select("*").in("builder_id", ids).order("sort_order")
      : { data: [] as never[] };
    return (builders ?? []).map((b) => ({
      ...b,
      items: (items ?? []).filter((i) => i.builder_id === b.id),
    }));
  });

export const savePackageBuilder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: BuilderInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("user_id", userId).single();
    if (!profile) throw new Error("No profile");

    const row = {
      profile_id: profile.id,
      name: data.name,
      description: data.description,
      image_url: data.image_url,
      mode: data.mode,
      discount_percent: data.discount_percent ?? 0,
      tiers: data.tiers ?? [],
      fixed_price: data.fixed_price,
      pick_count: data.pick_count,
      min_items: data.min_items ?? 1,
      max_items: data.max_items,
      category_id: data.category_id,
      show_in_packages: data.show_in_packages,
      active: data.active,
    };

    let builderId = data.id ?? null;
    if (builderId) {
      const { error } = await supabase
        .from("package_builders").update(row as never).eq("id", builderId).eq("profile_id", profile.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabase
        .from("package_builders").insert(row as never).select("id").single();
      if (error) throw new Error(error.message);
      builderId = (inserted as { id: string }).id;
    }

    await supabase.from("package_builder_items").delete().eq("builder_id", builderId);
    const items = (data.items ?? []).filter((i) => i.treatment_id);
    if (items.length) {
      const { error } = await supabase.from("package_builder_items").insert(
        items.map((i, idx) => ({
          builder_id: builderId!,
          treatment_id: i.treatment_id,
          max_qty: Math.max(1, i.max_qty || 1),
          sort_order: idx,
        })) as never,
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true, id: builderId };
  });

export const deletePackageBuilder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("package_builders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Public: turn a client's builder selection into a hidden custom package row
 * so the normal package booking flow (deposit, split pay, session credits)
 * can be reused. Pricing is always recomputed server-side.
 */
export const buildCustomPackage = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; builderId: string; selections: { treatment_id: string; qty: number }[] }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: builder, error: bErr } = await supabaseAdmin
      .from("package_builders").select("*").eq("id", data.builderId).eq("active", true).single();
    if (bErr || !builder) throw new Error("Offer not available");

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id, slug").eq("id", builder.profile_id).single();
    if (!profile || (profile.slug ?? "").toLowerCase() !== data.slug.toLowerCase()) {
      throw new Error("Offer not available");
    }

    const { data: items } = await supabaseAdmin
      .from("package_builder_items").select("*").eq("builder_id", builder.id);
    const allowed = new Map((items ?? []).map((i) => [i.treatment_id, i]));

    const cleaned = (data.selections ?? [])
      .filter((s) => allowed.has(s.treatment_id) && s.qty > 0)
      .map((s) => ({
        treatment_id: s.treatment_id,
        qty: Math.min(s.qty, allowed.get(s.treatment_id)!.max_qty || 1),
      }));
    if (!cleaned.length) throw new Error("Nothing selected");

    const { data: treatments } = await supabaseAdmin
      .from("treatments").select("id, name, price, duration")
      .in("id", cleaned.map((s) => s.treatment_id))
      .eq("profile_id", builder.profile_id)
      .eq("active", true);
    const tById = new Map((treatments ?? []).map((t) => [t.id, t]));
    const selection = cleaned
      .filter((s) => tById.has(s.treatment_id))
      .map((s) => ({ ...s, price: Number(tById.get(s.treatment_id)!.price ?? 0) }));
    if (!selection.length) throw new Error("Nothing selected");

    const rules: BuilderRules = {
      mode: builder.mode as BuilderRules["mode"],
      discount_percent: builder.discount_percent,
      tiers: (builder.tiers as unknown as { min: number; value: number }[]) ?? [],
      fixed_price: builder.fixed_price,
      pick_count: builder.pick_count,
      min_items: builder.min_items,
      max_items: builder.max_items,
    };
    const invalid = validateSelection(rules, selection);
    if (invalid) throw new Error(invalid);
    const { total, base } = computeBuilderPrice(rules, selection);

    const treatmentIds: string[] = [];
    for (const s of selection) for (let i = 0; i < s.qty; i++) treatmentIds.push(s.treatment_id);
    const sessionCount = treatmentIds.length;
    const duration = selection.reduce(
      (sum, s) => sum + s.qty * Number(tById.get(s.treatment_id)!.duration ?? 30), 0,
    );
    const summary = selection
      .map((s) => `${s.qty > 1 ? `${s.qty}x ` : ""}${tById.get(s.treatment_id)!.name}`)
      .join(", ");

    const { data: inserted, error } = await supabaseAdmin
      .from("packages")
      .insert({
        profile_id: builder.profile_id,
        builder_id: builder.id,
        is_custom: true,
        active: false,
        name: `${builder.name}: ${summary}`,
        description: summary,
        treatment_id: selection[0]!.treatment_id,
        treatment_ids: treatmentIds,
        session_count: sessionCount,
        price: total,
        compare_at_price: base > total ? base : null,
        duration_minutes: Math.round(duration / Math.max(1, sessionCount)),
        allow_split_payment: sessionCount >= 2,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { packageId: (inserted as { id: string }).id, price: total, base };
  });
