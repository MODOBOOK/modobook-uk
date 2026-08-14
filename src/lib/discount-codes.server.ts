/**
 * Platform discount codes (MODO-side).
 *
 * Codes are created by platform admins and redeemed by practitioners on the
 * Plan & billing screen. They work entirely on MODO's own plan maths — a
 * matching Stripe coupon is created lazily and best-effort so the real
 * direct-debit amount lines up, but a missing Stripe coupon never blocks a
 * code from being redeemed or shown in the plan summary.
 */

export type DiscountCodeRow = {
  id: string;
  code: string;
  description: string | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  duration?: string | null;
  duration_in_months?: number | null;
  stripe_coupon_id?: string | null;
};

/** Discount, in cents, that a code takes off a gross monthly total. */
export function computeCodeDiscountCents(
  grossCents: number,
  code: Pick<DiscountCodeRow, "percent_off" | "amount_off_cents"> | null | undefined,
): number {
  if (!code || grossCents <= 0) return 0;
  const pct = Math.max(0, Math.min(100, Number(code.percent_off ?? 0)));
  const amt = Math.max(0, Number(code.amount_off_cents ?? 0));
  return Math.min(grossCents, Math.round((grossCents * pct) / 100) + amt);
}

/**
 * Return a usable Stripe coupon id for a locally-stored code, creating one in
 * Stripe on first use. Returns null when Stripe can't be reached — callers
 * must treat that as "apply locally only".
 */
export async function ensureStripeCoupon(code: DiscountCodeRow): Promise<string | null> {
  if (code.stripe_coupon_id) return code.stripe_coupon_id;
  try {
    const { getStripeStable } = await import("./stripe.server");
    const stripe = getStripeStable();
    const hasPercent = (code.percent_off ?? 0) > 0;
    const coupon = await stripe.coupons.create({
      name: code.description || code.code,
      duration: (code.duration as "once" | "repeating" | "forever") || "forever",
      duration_in_months: code.duration === "repeating" ? (code.duration_in_months ?? 3) : undefined,
      percent_off: hasPercent ? Number(code.percent_off) : undefined,
      amount_off: hasPercent ? undefined : Number(code.amount_off_cents ?? 0),
      currency: hasPercent ? undefined : "gbp",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("platform_discount_codes")
      .update({ stripe_coupon_id: coupon.id })
      .eq("id", code.id);
    return coupon.id;
  } catch (err) {
    console.error("[ensureStripeCoupon] failed", err instanceof Error ? err.message : err);
    return null;
  }
}
