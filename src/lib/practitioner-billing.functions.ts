import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Practitioner-facing billing server functions. Everything is scoped to the
 * calling user's own profile via `requireSupabaseAuth`.
 */

async function getMyProfileId(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, email, clinic_name, full_name, created_at")
    .eq("user_id", context.userId)
    .single();
  if (error) throw error;
  return data as { id: string; email: string | null; clinic_name: string | null; full_name: string | null; created_at: string };
}

export const getMyBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) return { state: "blocked", hasAccess: false, daysLeft: 0, deadline: null, arrearsCents: 0, arrearsInvoiceUrl: null };
    const { data, error } = await context.supabase.rpc("practitioner_billing_status", { _profile_id: profile.id });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;

    // Sum outstanding platform invoices (open / uncollectible / past_due).
    const { data: openInvoices } = await context.supabase
      .from("platform_invoices")
      .select("amount_remaining_cents, hosted_invoice_url, created_at")
      .eq("profile_id", profile.id)
      .in("status", ["open", "uncollectible", "past_due"])
      .order("created_at", { ascending: false });
    const arrearsCents = (openInvoices ?? []).reduce(
      (sum: number, inv: any) => sum + Number(inv.amount_remaining_cents ?? 0),
      0,
    );
    const arrearsInvoiceUrl = (openInvoices ?? [])[0]?.hosted_invoice_url ?? null;

    return {
      state: (row?.state ?? "blocked") as "welcome" | "trial" | "grace" | "active" | "comped" | "suspended" | "blocked",
      hasAccess: Boolean(row?.has_access),
      daysLeft: row?.days_left ?? null,
      deadline: row?.deadline ?? null,
      arrearsCents,
      arrearsInvoiceUrl,
    };
  });

export const getMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getMyProfileId(context);
    const { data, error } = await context.supabase
      .from("platform_invoices")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getMyProfileId(context);

    const [{ data: sub }, { data: plans }, { data: access }] = await Promise.all([
      context.supabase
        .from("practitioner_subscriptions")
        .select("*, subscription_plans(id, name, description, amount_cents, currency, interval, kind)")
        .eq("profile_id", profile.id)
        .maybeSingle(),
      context.supabase
        .from("subscription_plans")
        .select("id, name, description, amount_cents, currency, interval, kind, active")
        .eq("active", true)
        .order("kind", { ascending: true })
        .order("amount_cents", { ascending: true }),
      context.supabase.rpc("practitioner_has_platform_access", { _profile_id: profile.id }),
    ]);

    let discountCode: { id: string; code: string; description: string | null; percent_off: number | null; amount_off_cents: number | null } | null = null;
    if (sub?.discount_code_id) {
      const { data: dc } = await context.supabase
        .from("platform_discount_codes")
        .select("id, code, description, percent_off, amount_off_cents")
        .eq("id", sub.discount_code_id)
        .maybeSingle();
      discountCode = (dc as typeof discountCode) ?? null;
    }

    return {
      profileId: profile.id,
      subscription: sub,
      plans: plans ?? [],
      hasAccess: Boolean(access),
      discountCode,
      profileCreatedAt: profile.created_at,
    };
  });

export const startBillingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { basePlanId: string; extraLocations?: number; extraPractitioners?: number; successUrl: string; cancelUrl: string }) => i)
  .handler(async ({ data, context }) => {
    const profile = await getMyProfileId(context);
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    // Load plans
    const { data: plans, error: pErr } = await context.supabase
      .from("subscription_plans")
      .select("*")
      .in("kind", ["base", "addon_location", "addon_practitioner"])
      .eq("active", true);
    if (pErr) throw pErr;

    const base = (plans ?? []).find((p: any) => p.id === data.basePlanId && p.kind === "base");
    if (!base?.stripe_price_id) throw new Error("Plan not available");

    const locAddon = (plans ?? []).find((p: any) => p.kind === "addon_location");
    const pracAddon = (plans ?? []).find((p: any) => p.kind === "addon_practitioner");

    const line_items: Array<{ price: string; quantity: number }> = [
      { price: base.stripe_price_id, quantity: 1 },
    ];
    if ((data.extraLocations ?? 0) > 0 && locAddon?.stripe_price_id) {
      line_items.push({ price: locAddon.stripe_price_id, quantity: data.extraLocations! });
    }
    if ((data.extraPractitioners ?? 0) > 0 && pracAddon?.stripe_price_id) {
      line_items.push({ price: pracAddon.stripe_price_id, quantity: data.extraPractitioners! });
    }

    // Existing subscription row / customer
    const { data: existing } = await context.supabase
      .from("practitioner_subscriptions")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | null | undefined;
    if (!customerId && profile.email) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.clinic_name || profile.full_name || profile.email,
        metadata: { profile_id: profile.id, kind: "platform_subscription" },
      });
      customerId = customer.id;
    }

    // Preserve remaining trial (if still active)
    const trialEndSec = existing?.trial_end && new Date(existing.trial_end).getTime() > Date.now()
      ? Math.floor(new Date(existing.trial_end).getTime() / 1000)
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId ?? undefined,
      line_items,
      allow_promotion_codes: true,
      subscription_data: trialEndSec ? { trial_end: trialEndSec } : undefined,
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: {
        profile_id: profile.id,
        plan_id: base.id,
        kind: "platform_subscription",
        extra_locations: String(data.extraLocations ?? 0),
        extra_practitioners: String(data.extraPractitioners ?? 0),
      },
    });

    const payload = {
      profile_id: profile.id,
      plan_id: base.id,
      stripe_customer_id: customerId,
      extra_locations: data.extraLocations ?? 0,
      extra_practitioners: data.extraPractitioners ?? 0,
    };
    if (existing) {
      await context.supabase.from("practitioner_subscriptions").update(payload).eq("id", existing.id);
    } else {
      await context.supabase.from("practitioner_subscriptions").insert({ ...payload, status: "pending" });
    }

    return { url: session.url };
  });

export const saveAddonSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { basePlanId?: string; extraLocations: number; extraPractitioners: number }) => i)
  .handler(async ({ data, context }) => {
    const profile = await getMyProfileId(context);
    const { data: existing } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    const payload: any = {
      extra_locations: Math.max(0, data.extraLocations | 0),
      extra_practitioners: Math.max(0, data.extraPractitioners | 0),
    };
    if (data.basePlanId) payload.plan_id = data.basePlanId;
    if (existing) {
      await context.supabase.from("practitioner_subscriptions").update(payload).eq("id", existing.id);
    } else {
      await context.supabase.from("practitioner_subscriptions").insert({ ...payload, profile_id: profile.id, status: "pending" });
    }
    return { ok: true };
  });

/**
 * Update the existing live Stripe subscription in place: change the base plan
 * and/or add-on quantities. Uses `proration_behavior: create_prorations` so
 * the change is added to the next scheduled direct-debit invoice rather than
 * starting a new payment schedule.
 */
export const updateMySubscriptionItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { basePlanId: string; extraLocations: number; extraPractitioners: number }) => i)
  .handler(async ({ data, context }) => {
    const profile = await getMyProfileId(context);

    const { data: sub, error: sErr } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_subscription_id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!sub?.stripe_subscription_id) throw new Error("No active subscription — start one first.");

    const { data: plans, error: pErr } = await context.supabase
      .from("subscription_plans")
      .select("id, kind, stripe_price_id, active")
      .in("kind", ["base", "addon_location", "addon_practitioner"])
      .eq("active", true);
    if (pErr) throw pErr;

    const base = (plans ?? []).find((p: any) => p.id === data.basePlanId && p.kind === "base");
    if (!base?.stripe_price_id) throw new Error("Plan not available");
    const locAddon = (plans ?? []).find((p: any) => p.kind === "addon_location");
    const pracAddon = (plans ?? []).find((p: any) => p.kind === "addon_practitioner");

    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

    // Build desired items: keep matching (updates quantity), delete others, add new.
    const wanted: Array<{ price: string; quantity: number }> = [
      { price: base.stripe_price_id, quantity: 1 },
    ];
    if (data.extraLocations > 0 && locAddon?.stripe_price_id)
      wanted.push({ price: locAddon.stripe_price_id, quantity: data.extraLocations });
    if (data.extraPractitioners > 0 && pracAddon?.stripe_price_id)
      wanted.push({ price: pracAddon.stripe_price_id, quantity: data.extraPractitioners });

    const items: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }> = [];
    const usedPriceIds = new Set<string>();
    for (const existing of current.items.data) {
      const priceId = existing.price.id;
      const match = wanted.find((w) => w.price === priceId);
      if (match) {
        items.push({ id: existing.id, quantity: match.quantity });
        usedPriceIds.add(priceId);
      } else {
        items.push({ id: existing.id, deleted: true });
      }
    }
    for (const w of wanted) {
      if (!usedPriceIds.has(w.price)) items.push({ price: w.price, quantity: w.quantity });
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items,
      proration_behavior: "create_prorations",
    });

    await context.supabase
      .from("practitioner_subscriptions")
      .update({
        plan_id: base.id,
        extra_locations: data.extraLocations,
        extra_practitioners: data.extraPractitioners,
      })
      .eq("id", sub.id);

    return { ok: true };
  });



export const openStripePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { returnUrl: string }) => i)
  .handler(async ({ data, context }) => {
    const profile = await getMyProfileId(context);
    const { data: sub } = await context.supabase
      .from("practitioner_subscriptions")
      .select("stripe_customer_id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw new Error("No Stripe customer yet — start a subscription first.");
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: data.returnUrl,
    });
    return { url: session.url };
  });

export const redeemDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { code: string }) => i)
  .handler(async ({ data, context }) => {
    const profile = await getMyProfileId(context);
    const { data: dc, error } = await context.supabase.rpc("lookup_active_discount_code", { _code: data.code.trim() });
    if (error) throw error;
    const code = Array.isArray(dc) ? dc[0] : dc;
    if (!code) return { ok: false as const, message: "Code not found or expired" };

    const { data: sub } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_subscription_id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!sub) return { ok: false as const, message: "Start a subscription first" };

    // Attach to Stripe subscription if active
    if (sub.stripe_subscription_id) {
      const { data: full } = await context.supabase
        .from("platform_discount_codes")
        .select("stripe_coupon_id")
        .eq("id", code.id)
        .maybeSingle();
      if (full?.stripe_coupon_id) {
        const { getStripe } = await import("./stripe.server");
        const stripe = getStripe();
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          discounts: [{ coupon: full.stripe_coupon_id }],
        });
      }
    }

    await context.supabase.from("practitioner_subscriptions").update({ discount_code_id: code.id }).eq("id", sub.id);
    return { ok: true as const, code: code.code };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getMyProfileId(context);
    const { data: sub, error } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_subscription_id")
      .eq("profile_id", profile.id)
      .single();
    if (error) throw error;
    if (sub.stripe_subscription_id) {
      const { getStripe } = await import("./stripe.server");
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
    }
    await context.supabase.from("practitioner_subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id);
    return { ok: true };
  });

export const resumeMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getMyProfileId(context);
    const { data: sub, error } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_subscription_id")
      .eq("profile_id", profile.id)
      .single();
    if (error) throw error;
    if (sub.stripe_subscription_id) {
      const { getStripe } = await import("./stripe.server");
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false });
    }
    await context.supabase.from("practitioner_subscriptions").update({ cancel_at_period_end: false }).eq("id", sub.id);
    return { ok: true };
  });
