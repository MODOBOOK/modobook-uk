import { associateBillingEnabled } from "@/lib/feature-flags";

/**
 * Keeps a live Stripe subscription in step with what actually exists on the
 * account (locations, practitioners, associates).
 *
 * Runs with `proration_behavior: "none"` so nothing is charged mid-cycle —
 * the direct debit simply collects the new amount from the next invoice.
 * Safe to call often: it only touches Stripe when the quantities differ.
 */
export async function syncSubscriptionSeats(supabase: any, profileId: string) {
  const { data: sub } = await supabase
    .from("practitioner_subscriptions")
    .select(
      "id, status, plan_id, stripe_subscription_id, free_locations, free_practitioners, free_associates, waive_associates_fee, extra_locations, extra_practitioners",
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) return { ok: false, reason: "no-subscription" as const };
  if (!["active", "trialing", "past_due"].includes(String(sub.status))) {
    return { ok: false, reason: "inactive" as const };
  }

  const [{ count: locCount }, { count: pracCount }, { count: assocCount }, { data: plans }, { data: profRow }] =
    await Promise.all([
      supabase.from("locations").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
      supabase
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId)
        .eq("role", "practitioner")
        .in("status", ["invited", "active"]),
      supabase
        .from("clinic_associates")
        .select("id", { count: "exact", head: true })
        .eq("clinic_profile_id", profileId)
        .in("status", ["invited", "active"]),
      supabase
        .from("subscription_plans")
        .select("id, kind, name, amount_cents, stripe_price_id, active")
        .in("kind", ["base", "addon_location", "addon_practitioner", "addon_associates_module", "addon_associate"])
        .eq("active", true),
      supabase.from("profiles").select("associates_enabled, slug").eq("id", profileId).maybeSingle(),
    ]);

  const list = (plans ?? []) as any[];
  const base = list.find((p) => p.id === sub.plan_id && p.kind === "base") ?? list.find((p) => p.kind === "base");
  if (!base?.stripe_price_id) return { ok: false, reason: "no-base-plan" as const };
  const locAddon = list.find((p) => p.kind === "addon_location");
  const pracAddon = list.find((p) => p.kind === "addon_practitioner");
  const assocModule = list.find((p) => p.kind === "addon_associates_module");
  const assocAddon = list.find((p) => p.kind === "addon_associate");

  const freeLocs = Math.max(0, Number(sub.free_locations ?? 0));
  const freePracs = Math.max(0, Number(sub.free_practitioners ?? 0));
  const extraLocations = Math.max(0, (locCount ?? 0) - 1 - freeLocs);
  const extraPractitioners = Math.max(0, (pracCount ?? 0) - 1 - freePracs);

  const ASSOC_BLOCK = 5;
  const assocEnabled = Boolean(profRow?.associates_enabled);
  const assocWaived = Boolean(sub.waive_associates_fee) || !associateBillingEnabled(profRow?.slug);
  const assocChargeable = assocEnabled && !assocWaived;
  const assocIncluded = ASSOC_BLOCK + Math.max(0, Number(sub.free_associates ?? 0));
  const assocBlocks = assocChargeable
    ? Math.ceil(Math.max(0, (assocCount ?? 0) - assocIncluded) / ASSOC_BLOCK)
    : 0;

  const wanted: Array<{ price: string; quantity: number }> = [{ price: base.stripe_price_id, quantity: 1 }];
  if (extraLocations > 0 && locAddon?.stripe_price_id)
    wanted.push({ price: locAddon.stripe_price_id, quantity: extraLocations });
  if (extraPractitioners > 0 && pracAddon?.stripe_price_id)
    wanted.push({ price: pracAddon.stripe_price_id, quantity: extraPractitioners });
  const { ensurePlanPrice } = await import("./plan-prices.server");
  if (assocChargeable) {
    const priceId = await ensurePlanPrice(assocModule as any);
    if (priceId) wanted.push({ price: priceId, quantity: 1 });
  }
  if (assocBlocks > 0) {
    const priceId = await ensurePlanPrice(assocAddon as any);
    if (priceId) wanted.push({ price: priceId, quantity: assocBlocks });
  }

  const { getStripe } = await import("./stripe.server");
  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

  const items: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }> = [];
  const seen = new Set<string>();
  let changed = false;
  for (const existing of current.items.data) {
    const match = wanted.find((w) => w.price === existing.price.id);
    if (match) {
      items.push({ id: existing.id, quantity: match.quantity });
      seen.add(match.price);
      if (Number(existing.quantity ?? 0) !== match.quantity) changed = true;
    } else {
      items.push({ id: existing.id, deleted: true });
      changed = true;
    }
  }
  for (const w of wanted) {
    if (!seen.has(w.price)) {
      items.push({ price: w.price, quantity: w.quantity });
      changed = true;
    }
  }

  if (changed) {
    await stripe.subscriptions.update(sub.stripe_subscription_id, { items, proration_behavior: "none" });
  }

  await supabase
    .from("practitioner_subscriptions")
    .update({ extra_locations: extraLocations, extra_practitioners: extraPractitioners })
    .eq("id", sub.id);

  return { ok: true, changed, extraLocations, extraPractitioners, assocBlocks };
}
