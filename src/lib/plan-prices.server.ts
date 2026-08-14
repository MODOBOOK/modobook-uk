/**
 * Plan price provisioning.
 *
 * Some add-on plans (e.g. the associates module and extra associate blocks)
 * were added to `subscription_plans` without a matching Stripe price, so they
 * silently dropped out of checkout and direct-debit line items. This creates
 * the Stripe product/price on first use and stores the id back on the plan row.
 */

export type PlanRow = {
  id: string;
  kind: string;
  name?: string | null;
  amount_cents?: number | null;
  stripe_price_id?: string | null;
};

/** Return a usable Stripe price id for a plan, creating one when missing. */
export async function ensurePlanPrice(plan: PlanRow | null | undefined): Promise<string | null> {
  if (!plan) return null;
  if (plan.stripe_price_id) return plan.stripe_price_id;
  const amount = Number(plan.amount_cents ?? 0);
  if (amount <= 0) return null;
  try {
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const price = await stripe.prices.create({
      currency: "gbp",
      unit_amount: amount,
      recurring: { interval: "month" },
      product_data: { name: plan.name || plan.kind },
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscription_plans")
      .update({ stripe_price_id: price.id })
      .eq("id", plan.id);
    plan.stripe_price_id = price.id;
    return price.id;
  } catch (err) {
    console.error("[ensurePlanPrice] failed", plan.kind, err instanceof Error ? err.message : err);
    return null;
  }
}
