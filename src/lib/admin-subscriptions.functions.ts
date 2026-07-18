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
  .inputValidator((i: { id: string; active?: boolean; description?: string | null; name?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: { active?: boolean; description?: string | null; name?: string } = {};
    if (data.active !== undefined) patch.active = data.active;
    if (data.description !== undefined) patch.description = data.description;
    if (data.name !== undefined) patch.name = data.name;
    const { error } = await context.supabase
      .from("subscription_plans")
      .update(patch)
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
