/**
 * Practitioner referral rewards on MODO's own Stripe billing.
 *
 * - Joiner: 25% off their first 3 PAID months, after the free trial month.
 *   We attach a "forever" 25% coupon and remove it once 3 paid invoices land,
 *   so the trial never eats into the 3 discounted months.
 * - Referrer: one completely free month once the joiner has completed their
 *   first paid billing cycle (i.e. their second paid invoice). Free months are
 *   banked and applied one at a time as a 100%-off-once coupon.
 */

/** Held back from live until Ryan approves the new referral rules. */
export const REFERRAL_RULES_V2_LIVE = false;

export const JOINER_DISCOUNTED_INVOICES = 3;
export const REFERRER_QUALIFY_AFTER_INVOICES = 2;

const JOINER_COUPON_ID = "modo_referral_25_paid3";
const FREE_MONTH_COUPON_ID = "modo_referral_free_month";

async function stripeClient() {
  const { getStripeStable } = await import("./stripe.server");
  return getStripeStable();
}

async function ensureCoupon(id: string, params: Record<string, unknown>) {
  const stripe = await stripeClient();
  try {
    const c = await stripe.coupons.retrieve(id);
    if (c && !(c as any).deleted) return c.id;
  } catch {
    /* create below */
  }
  const c = await stripe.coupons.create({ id, ...(params as any) });
  return c.id;
}

export function ensureJoinerCoupon() {
  return ensureCoupon(JOINER_COUPON_ID, {
    name: "Referral: 25% off first 3 paid months",
    percent_off: 25,
    duration: "forever",
  });
}

function ensureFreeMonthCoupon() {
  return ensureCoupon(FREE_MONTH_COUPON_ID, {
    name: "Referral reward: 1 free month",
    percent_off: 100,
    duration: "once",
  });
}

/** Is this platform discount code a practitioner's referral code? */
export async function isReferralDiscountCode(discountCodeId?: string | null) {
  if (!discountCodeId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("practitioner_referral_codes")
    .select("id")
    .eq("discount_code_id", discountCodeId)
    .maybeSingle();
  return !!data;
}

function couponIdOf(d: any): string | null {
  const c = d?.coupon ?? d?.source?.coupon;
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** Apply one banked free month to the referrer's next invoice, if possible. */
export async function applyBankedFreeMonth(profileId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("practitioner_subscriptions")
    .select("id, stripe_subscription_id, referral_reward_months_remaining")
    .eq("profile_id", profileId)
    .maybeSingle();
  const s = sub as any;
  if (!s?.stripe_subscription_id || Number(s.referral_reward_months_remaining ?? 0) < 1) return false;

  const stripe = await stripeClient();
  const couponId = await ensureFreeMonthCoupon();
  const live: any = await stripe.subscriptions.retrieve(s.stripe_subscription_id, { expand: ["discounts"] } as any);
  if (!live || ["canceled", "incomplete_expired"].includes(live.status)) return false;
  const existing: any[] = Array.isArray(live.discounts) ? live.discounts : [];
  // One free month waiting at a time — the next one goes on after it is used.
  if (existing.some((d) => couponIdOf(d) === couponId)) return false;

  await stripe.subscriptions.update(s.stripe_subscription_id, {
    discounts: [
      ...existing.map((d) => ({ discount: typeof d === "string" ? d : d.id })),
      { coupon: couponId },
    ],
  } as any);
  await supabaseAdmin
    .from("practitioner_subscriptions")
    .update({ referral_reward_months_remaining: Number(s.referral_reward_months_remaining) - 1 } as never)
    .eq("id", s.id);
  return true;
}

async function removeJoinerDiscount(profileId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("practitioner_subscriptions")
    .select("id, stripe_subscription_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  const s = sub as any;
  if (s?.stripe_subscription_id) {
    const stripe = await stripeClient();
    const live: any = await stripe.subscriptions.retrieve(s.stripe_subscription_id, { expand: ["discounts"] } as any);
    const existing: any[] = Array.isArray(live?.discounts) ? live.discounts : [];
    const keep = existing.filter((d) => {
      const c = couponIdOf(d);
      return c !== JOINER_COUPON_ID;
    });
    if (keep.length !== existing.length || existing.length) {
      // Also drop any legacy referral coupon (created from the code itself).
      const { data: code } = await supabaseAdmin
        .from("practitioner_referral_signups")
        .select("referral_code_id, practitioner_referral_codes(discount_code_id, platform_discount_codes(stripe_coupon_id))")
        .eq("referred_profile_id", profileId)
        .maybeSingle();
      const legacy = (code as any)?.practitioner_referral_codes?.platform_discount_codes?.stripe_coupon_id ?? null;
      const final = keep.filter((d) => !legacy || couponIdOf(d) !== legacy);
      await stripe.subscriptions.update(s.stripe_subscription_id, {
        discounts: final.length ? final.map((d) => ({ discount: typeof d === "string" ? d : d.id })) : "",
      } as any);
    }
  }
  if (s?.id) {
    await supabaseAdmin
      .from("practitioner_subscriptions")
      .update({ discount_code_id: null } as never)
      .eq("id", s.id);
  }
}

/**
 * Called for every paid MODO invoice. Counts the joiner's paid invoices,
 * rewards the referrer after the first full paid cycle, ends the joiner's 25%
 * after 3 paid months, and drips banked free months onto the payer.
 */
export async function handleReferralInvoicePaid(profileId: string, invoiceId: string, amountPaidCents: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (amountPaidCents > 0) {
    const { data: signup } = await supabaseAdmin
      .from("practitioner_referral_signups")
      .select("id, paid_invoice_ids, reward_granted_at, joiner_discount_ended_at, referral_code_id")
      .eq("referred_profile_id", profileId)
      .maybeSingle();
    const sg = signup as any;
    if (sg) {
      const ids: string[] = Array.isArray(sg.paid_invoice_ids) ? sg.paid_invoice_ids : [];
      if (!ids.includes(invoiceId)) {
        ids.push(invoiceId);
        await supabaseAdmin
          .from("practitioner_referral_signups")
          .update({ paid_invoice_ids: ids, updated_at: new Date().toISOString() } as never)
          .eq("id", sg.id);
      }

      if (ids.length >= REFERRER_QUALIFY_AFTER_INVOICES && !sg.reward_granted_at) {
        const { error } = await supabaseAdmin.rpc("qualify_practitioner_referral" as never, {
          _referred_profile_id: profileId,
        } as never);
        if (error) console.error("[referrals] qualify failed", error.message);
        const { data: code } = await supabaseAdmin
          .from("practitioner_referral_codes")
          .select("owner_profile_id")
          .eq("id", sg.referral_code_id)
          .maybeSingle();
        const owner = (code as any)?.owner_profile_id as string | undefined;
        if (owner) {
          try {
            await applyBankedFreeMonth(owner);
          } catch (e) {
            console.error("[referrals] free month apply failed", e);
          }
        }
      }

      if (ids.length >= JOINER_DISCOUNTED_INVOICES && !sg.joiner_discount_ended_at) {
        try {
          await removeJoinerDiscount(profileId);
          await supabaseAdmin
            .from("practitioner_referral_signups")
            .update({ joiner_discount_ended_at: new Date().toISOString() } as never)
            .eq("id", sg.id);
        } catch (e) {
          console.error("[referrals] ending joiner discount failed", e);
        }
      }
    }
  }

  // The payer may be a referrer with more free months saved up.
  try {
    await applyBankedFreeMonth(profileId);
  } catch (e) {
    console.error("[referrals] banked month apply failed", e);
  }
}
