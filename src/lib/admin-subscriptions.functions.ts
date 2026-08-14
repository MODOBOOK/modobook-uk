import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

export const listSubscriptionPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("subscription_plans")
      .select("*")
      .order("amount_cents", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const listPractitionerSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("practitioner_subscriptions")
      .select("*, subscription_plans(name, amount_cents, currency, interval)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    name: string; description?: string;
    amount_cents: number; currency?: string; interval?: "month" | "year";
    kind?: "base" | "addon_location" | "addon_practitioner";
    default_trial_days?: number;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const currency = (data.currency || "gbp").toLowerCase();
    const interval = data.interval || "month";
    const kind = data.kind || "base";
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const product = await stripe.products.create({
      name: data.name,
      description: data.description || undefined,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: data.amount_cents,
      currency,
      recurring: { interval },
    });
    const { data: row, error } = await context.supabase
      .from("subscription_plans")
      .insert({
        name: data.name,
        description: data.description ?? null,
        amount_cents: data.amount_cents,
        currency,
        interval,
        kind,
        default_trial_days: data.default_trial_days ?? 30,
        stripe_price_id: price.id,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id: string;
    active?: boolean;
    description?: string | null;
    name?: string;
    is_default?: boolean;
    amount_cents?: number;
    interval?: "month" | "year";
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = {};
    if (data.active !== undefined) patch.active = data.active;
    if (data.description !== undefined) patch.description = data.description;
    if (data.name !== undefined) patch.name = data.name;
    if (data.is_default !== undefined) patch.is_default = data.is_default;

    // Stripe prices are immutable: to change amount/interval we create a new
    // price on the same product and archive the old one. Existing subscribers
    // keep their current price until re-checkout; new checkouts use the new one.
    if (data.amount_cents !== undefined || data.interval !== undefined) {
      const { data: existing, error: eErr } = await context.supabase
        .from("subscription_plans")
        .select("stripe_price_id, amount_cents, interval, currency, name, description")
        .eq("id", data.id)
        .single();
      if (eErr) throw eErr;

      const nextAmount = data.amount_cents ?? existing.amount_cents;
      const nextInterval = (data.interval ?? existing.interval) as "month" | "year";
      const currency = (existing.currency || "gbp").toLowerCase();

      const { getStripe } = await import("./stripe.server");
      const stripe = getStripe();

      let productId: string | null = null;
      if (existing.stripe_price_id) {
        try {
          const oldPrice = await stripe.prices.retrieve(existing.stripe_price_id);
          productId = typeof oldPrice.product === "string" ? oldPrice.product : oldPrice.product.id;
          await stripe.prices.update(existing.stripe_price_id, { active: false });
        } catch (e) { console.error("stripe old price lookup", e); }
      }
      if (!productId) {
        const product = await stripe.products.create({
          name: data.name || existing.name,
          description: (data.description ?? existing.description) || undefined,
        });
        productId = product.id;
      }
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: nextAmount,
        currency,
        recurring: { interval: nextInterval },
      });
      patch.amount_cents = nextAmount;
      patch.interval = nextInterval;
      patch.stripe_price_id = newPrice.id;
    }

    if (data.is_default === true) {
      const { error: clrErr } = await context.supabase
        .from("subscription_plans")
        .update({ is_default: false })
        .neq("id", data.id);
      if (clrErr) throw clrErr;
    }

    const { error } = await context.supabase
      .from("subscription_plans")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw error;

    return { ok: true };
  });

/**
 * Create a Stripe Checkout subscription session for a practitioner.
 * Returns the hosted URL so the admin can share it with the practitioner.
 */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profileId: string; planId: string; successUrl?: string; cancelUrl?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: plan, error: pErr } = await context.supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", data.planId)
      .single();
    if (pErr) throw pErr;
    if (!plan?.stripe_price_id) throw new Error("Plan has no Stripe price configured");

    const { data: prof, error: prErr } = await context.supabase
      .from("profiles")
      .select("id, email, clinic_name, full_name")
      .eq("id", data.profileId)
      .single();
    if (prErr) throw prErr;
    if (!prof?.email) throw new Error("Practitioner has no email on profile");

    const { data: existing } = await context.supabase
      .from("practitioner_subscriptions")
      .select("*")
      .eq("profile_id", data.profileId)
      .maybeSingle();

    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    let customerId = existing?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: prof.email,
        name: prof.clinic_name || prof.full_name || prof.email,
        metadata: { profile_id: prof.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: data.successUrl || "https://example.com/subscription/success",
      cancel_url: data.cancelUrl || "https://example.com/subscription/cancel",
      metadata: { profile_id: prof.id, plan_id: plan.id },
    });

    const payload = {
      profile_id: prof.id,
      plan_id: plan.id,
      stripe_customer_id: customerId,
      status: "pending" as const,
    };
    if (existing) {
      await context.supabase
        .from("practitioner_subscriptions")
        .update(payload)
        .eq("id", existing.id);
    } else {
      await context.supabase.from("practitioner_subscriptions").insert(payload);
    }

    return { url: session.url };
  });

/**
 * Record a subscription manually (e.g., comp account, or already paying offline).
 */
export const recordManualSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    profileId: string; planId: string | null;
    status: "active" | "trialing" | "past_due" | "canceled" | "pending";
    notes?: string | null;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: existing } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id")
      .eq("profile_id", data.profileId)
      .maybeSingle();
    const payload = {
      profile_id: data.profileId,
      plan_id: data.planId,
      status: data.status,
      notes: data.notes ?? null,
    };
    if (existing) {
      const { error } = await context.supabase
        .from("practitioner_subscriptions")
        .update(payload).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("practitioner_subscriptions")
        .insert(payload);
      if (error) throw error;
    }
    return { ok: true };
  });

export const cancelPractitionerSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profileId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: sub, error } = await context.supabase
      .from("practitioner_subscriptions")
      .select("*")
      .eq("profile_id", data.profileId)
      .single();
    if (error) throw error;
    if (sub.stripe_subscription_id) {
      const { getStripe } = await import("./stripe.server");
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }
    const { error: uErr } = await context.supabase
      .from("practitioner_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("id", sub.id);
    if (uErr) throw uErr;
    return { ok: true };
  });

// ---------- Discount codes ----------

export const listDiscountCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("platform_discount_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    code: string; description?: string;
    percent_off?: number | null; amount_off_cents?: number | null;
    duration: "once" | "repeating" | "forever";
    duration_in_months?: number | null;
    max_redemptions?: number | null;
    expires_at?: string | null;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { getStripeStable } = await import("./stripe.server");
    const stripe = getStripeStable();

    // Validate: Stripe rejects coupons with both percent_off and amount_off.
    const hasPercent = data.percent_off != null && data.percent_off > 0;
    const hasAmount = data.amount_off_cents != null && data.amount_off_cents > 0;
    if (hasPercent && hasAmount) {
      throw new Error("Choose either a percent discount OR a fixed amount, not both.");
    }
    if (!hasPercent && !hasAmount) {
      throw new Error("Enter a percent off or an amount off.");
    }

    let coupon;
    let promo;
    try {
      coupon = await stripe.coupons.create({
        name: data.description || data.code,
        duration: data.duration,
        duration_in_months: data.duration === "repeating" ? (data.duration_in_months ?? 3) : undefined,
        percent_off: hasPercent ? data.percent_off! : undefined,
        amount_off: hasAmount ? data.amount_off_cents! : undefined,
        currency: hasAmount ? "gbp" : undefined,
        max_redemptions: data.max_redemptions ?? undefined,
        redeem_by: data.expires_at ? Math.floor(new Date(data.expires_at).getTime() / 1000) : undefined,
      });
      promo = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: data.code.toUpperCase(),
        max_redemptions: data.max_redemptions ?? undefined,
        expires_at: data.expires_at ? Math.floor(new Date(data.expires_at).getTime() / 1000) : undefined,
      } as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe rejected the discount code";
      console.error("[createDiscountCode] stripe error", msg);
      throw new Error(`Stripe rejected the discount code: ${msg}`);
    }

    const { data: row, error } = await context.supabase
      .from("platform_discount_codes")
      .insert({
        code: data.code.toUpperCase(),
        description: data.description ?? null,
        percent_off: data.percent_off ?? null,
        amount_off_cents: data.amount_off_cents ?? null,
        currency: data.amount_off_cents ? "gbp" : null,
        duration: data.duration,
        duration_in_months: data.duration_in_months ?? null,
        max_redemptions: data.max_redemptions ?? null,
        expires_at: data.expires_at ?? null,
        stripe_coupon_id: coupon.id,
        stripe_promo_code_id: promo.id,
        active: true,
      } as any)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const toggleDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; active: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: dc, error } = await context.supabase
      .from("platform_discount_codes")
      .select("stripe_promo_code_id")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    if (dc.stripe_promo_code_id) {
      const { getStripeStable } = await import("./stripe.server");
      const stripe = getStripeStable();
      await stripe.promotionCodes.update(dc.stripe_promo_code_id, { active: data.active });
    }
    await context.supabase
      .from("platform_discount_codes")
      .update({ active: data.active })
      .eq("id", data.id);
    return { ok: true };
  });

// ---------- Per-practitioner controls ----------

export const extendTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profileId: string; days: number }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: sub } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, trial_end, stripe_subscription_id")
      .eq("profile_id", data.profileId)
      .maybeSingle();
    const base = sub?.trial_end && new Date(sub.trial_end).getTime() > Date.now()
      ? new Date(sub.trial_end)
      : new Date();
    base.setDate(base.getDate() + data.days);
    const iso = base.toISOString();
    if (sub) {
      await context.supabase.from("practitioner_subscriptions").update({ trial_end: iso }).eq("id", sub.id);
      if (sub.stripe_subscription_id) {
        const { getStripe } = await import("./stripe.server");
        try {
          await getStripe().subscriptions.update(sub.stripe_subscription_id, { trial_end: Math.floor(base.getTime() / 1000) });
        } catch (e) { console.error("stripe trial extend", e); }
      }
    } else {
      await context.supabase.from("practitioner_subscriptions").insert({
        profile_id: data.profileId, trial_end: iso, status: "trialing",
      });
    }
    return { ok: true, trial_end: iso };
  });

export const setCustomPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profileId: string; custom_price_cents: number | null }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await context.supabase
      .from("practitioner_subscriptions")
      .update({ custom_price_cents: data.custom_price_cents })
      .eq("profile_id", data.profileId);
    return { ok: true };
  });

export const toggleComped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profileId: string; comped: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: existing } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id")
      .eq("profile_id", data.profileId)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("practitioner_subscriptions")
        .update({ comped: data.comped, status: data.comped ? "active" : "pending" })
        .eq("id", existing.id);
    } else {
      await context.supabase.from("practitioner_subscriptions")
        .insert({ profile_id: data.profileId, comped: data.comped, status: data.comped ? "active" : "pending" });
    }
    return { ok: true };
  });

export const setSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profileId: string; suspended: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await context.supabase
      .from("practitioner_subscriptions")
      .update({ suspended_at: data.suspended ? new Date().toISOString() : null })
      .eq("profile_id", data.profileId);
    return { ok: true };
  });

// ---------- Comped accounts, discounts & free extra seats ----------

/** Read a clinic's billing settings, seat usage + free allowance. */
export const adminGetSeatAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profileId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Admin console reads across clinics, so use the privileged client
    // (RLS on profiles/locations/practitioners scopes to the owner only).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: sub }, locs, pracs, { data: codes }] = await Promise.all([
      db
        .from("practitioner_subscriptions")
        .select(
          "free_locations, free_practitioners, extra_locations, extra_practitioners, comped, status, trial_end, custom_price_cents, discount_code_id, stripe_subscription_id, waive_associates_fee, free_associates, discount_percent, discount_amount_cents",
        )
        .eq("profile_id", data.profileId)
        .maybeSingle(),
      db.from("locations").select("id", { count: "exact", head: true }).eq("profile_id", data.profileId),
      db.from("practitioners").select("id", { count: "exact", head: true }).eq("profile_id", data.profileId),
      db
        .from("platform_discount_codes")
        .select("id, code, percent_off, amount_off_cents, active")
        .eq("active", true)
        .order("code"),
    ]);
    return {
      free_locations: Number(sub?.free_locations ?? 0),
      free_practitioners: Number(sub?.free_practitioners ?? 0),
      extra_locations: Number(sub?.extra_locations ?? 0),
      extra_practitioners: Number(sub?.extra_practitioners ?? 0),
      comped: Boolean(sub?.comped),
      status: (sub?.status as string) ?? null,
      trial_end: (sub?.trial_end as string) ?? null,
      custom_price_cents: sub?.custom_price_cents ?? null,
      discount_code_id: (sub?.discount_code_id as string) ?? null,
      waive_associates_fee: Boolean(sub?.waive_associates_fee),
      free_associates: Number(sub?.free_associates ?? 0),
      discount_percent: Number(sub?.discount_percent ?? 0),
      discount_amount_cents: Number(sub?.discount_amount_cents ?? 0),
      has_stripe_subscription: Boolean(sub?.stripe_subscription_id),
      location_count: locs.count ?? 0,
      practitioner_count: pracs.count ?? 0,
      discount_codes: (codes ?? []) as Array<{
        id: string;
        code: string;
        percent_off: number | null;
        amount_off_cents: number | null;
      }>,
    };
  });

async function upsertSubscriptionPatch(profileId: string, patch: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: existing } = await db
    .from("practitioner_subscriptions")
    .select("id, stripe_subscription_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing) {
    const { error } = await db.from("practitioner_subscriptions").update(patch).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("practitioner_subscriptions")
      .insert({ profile_id: profileId, status: "pending", ...patch });
    if (error) throw error;
  }
  return existing as { id: string; stripe_subscription_id: string | null } | null;
}

/** Grant / adjust complimentary extra locations, practitioners and associates. */
export const adminSetSeatAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      profileId: string;
      freeLocations?: number;
      freePractitioners?: number;
      freeAssociates?: number;
      waiveAssociatesFee?: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const clamp = (n: unknown) => Math.max(0, Math.min(50, Math.floor(Number(n) || 0)));
    const patch: Record<string, number | boolean> = {};
    if (data.freeLocations !== undefined) patch.free_locations = clamp(data.freeLocations);
    if (data.freePractitioners !== undefined) patch.free_practitioners = clamp(data.freePractitioners);
    if (data.freeAssociates !== undefined) patch.free_associates = clamp(data.freeAssociates);
    if (data.waiveAssociatesFee !== undefined) patch.waive_associates_fee = Boolean(data.waiveAssociatesFee);
    if (!Object.keys(patch).length) return { ok: true };
    await upsertSubscriptionPatch(data.profileId, patch);
    return { ok: true, ...patch };
  });


/**
 * Free subscriptions & discounts.
 *  - `comped: true` makes the account permanently free (never billed, never
 *    blocked). Any live Stripe subscription is cancelled immediately.
 *  - `discountCodeId` attaches an existing platform discount code; when a live
 *    Stripe subscription exists the coupon is applied to it straight away,
 *    otherwise it pre-fills at checkout.
 *  - `trialDays` extends the free trial by N days from today.
 */
export const adminSetBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      profileId: string;
      comped?: boolean;
      discountCodeId?: string | null;
      trialDays?: number | null;
      customPriceCents?: number | null;
      discountPercent?: number | null;
      discountAmountCents?: number | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const patch: Record<string, unknown> = {};
    if (data.comped !== undefined) patch.comped = Boolean(data.comped);
    if (data.discountCodeId !== undefined) patch.discount_code_id = data.discountCodeId || null;
    if (data.discountPercent !== undefined)
      patch.discount_percent = Math.max(0, Math.min(100, Number(data.discountPercent) || 0));
    if (data.discountAmountCents !== undefined)
      patch.discount_amount_cents = Math.max(0, Math.floor(Number(data.discountAmountCents) || 0));
    if (data.customPriceCents !== undefined)
      patch.custom_price_cents =
        data.customPriceCents === null ? null : Math.max(0, Math.floor(data.customPriceCents));

    if (data.trialDays != null && data.trialDays > 0) {
      const end = new Date();
      end.setDate(end.getDate() + Math.floor(data.trialDays));
      patch.trial_end = end.toISOString();
      patch.status = "trialing";
    }
    if (!Object.keys(patch).length) return { ok: true };

    const existing = await upsertSubscriptionPatch(data.profileId, patch);

    // Sync with Stripe where a live subscription exists.
    if (existing?.stripe_subscription_id) {
      try {
        const { getStripe } = await import("./stripe.server");
        const stripe = getStripe();
        if (data.comped === true) {
          await stripe.subscriptions.cancel(existing.stripe_subscription_id);
          await db
            .from("practitioner_subscriptions")
            .update({ status: "canceled", stripe_subscription_id: null })
            .eq("id", existing.id);
        } else if (data.discountCodeId) {
          const { data: code } = await db
            .from("platform_discount_codes")
            .select("stripe_coupon_id")
            .eq("id", data.discountCodeId)
            .maybeSingle();
          if (code?.stripe_coupon_id) {
            await stripe.subscriptions.update(existing.stripe_subscription_id, {
              coupon: code.stripe_coupon_id,
            } as any);
          }
        } else if (data.discountCodeId === null) {
          await stripe.subscriptions.deleteDiscount(existing.stripe_subscription_id);
        }
      } catch (e) {
        console.error("[adminSetBilling] Stripe sync failed", e);
      }
    }
    return { ok: true };
  });
