import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { associateBillingEnabled } from "@/lib/feature-flags";
import { FREE_EXTRA_LOCATIONS } from "@/lib/free-locations";

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

/**
 * Associates billing: the module is a flat monthly fee covering the first 5
 * associates, then every further block of 5 adds one extra seat fee.
 * Returns what should actually be charged for this clinic right now.
 */
async function computeAssociateCharge(supabase: any, profileId: string) {
  const ASSOC_BLOCK = 5;
  const [{ data: sub }, { data: profRow }, { count: assocCount }] = await Promise.all([
    supabase
      .from("practitioner_subscriptions")
      .select("waive_associates_fee, free_associates")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase.from("profiles").select("associates_enabled, slug").eq("id", profileId).maybeSingle(),
    supabase
      .from("clinic_associates")
      .select("id", { count: "exact", head: true })
      .eq("clinic_profile_id", profileId)
      .in("status", ["invited", "active"]),
  ]);
  const enabled = Boolean(profRow?.associates_enabled);
  const waived = Boolean(sub?.waive_associates_fee) || !associateBillingEnabled(profRow?.slug);
  const included = ASSOC_BLOCK + Math.max(0, Number(sub?.free_associates ?? 0));
  const used = assocCount ?? 0;
  const chargeable = enabled && !waived;
  return {
    enabled,
    waived,
    used,
    included,
    blockSize: ASSOC_BLOCK,
    moduleActive: chargeable,
    extraBlocks: chargeable ? Math.ceil(Math.max(0, used - included) / ASSOC_BLOCK) : 0,
  };
}

/**
 * Seat handling. Every clinic gets 1 free seat of each kind (location /
 * practitioner). Extra seats are never blocked — adding one automatically
 * increases the paid add-on quantity:
 *  - with a live Stripe subscription, the add-on quantity is raised in place
 *    (prorated onto the next direct-debit invoice),
 *  - during the trial / before checkout, the seat is reserved on the
 *    subscription record so it pre-fills and bills at checkout,
 *  - comped or admin-granted free seats are used up first, at no charge.
 */
export async function assertSeatAvailable(
  supabase: any,
  profileId: string,
  kind: "location" | "practitioner",
) {
  const { data: sub } = await supabase
    .from("practitioner_subscriptions")
    .select("id, status, comped, trial_end, stripe_subscription_id, plan_id, extra_locations, extra_practitioners, free_locations, free_practitioners")
    .eq("profile_id", profileId)
    .maybeSingle();

  // Locations are counted from the locations table; treating seats are counted
  // from staff members with the Practitioner role (they each get a login).
  const { count } = kind === "location"
    ? await supabase
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId)
    : await supabase
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId)
        .eq("role", "practitioner")
        .in("status", ["invited", "active"]);
  const current = count ?? 0;
  if (current < 1) return; // first seat is always free
  if (sub?.comped) return;

  const isLoc = kind === "location";
  if (isLoc && FREE_EXTRA_LOCATIONS) return; // promo: extra locations free for now
  const freeExtras = Math.max(0, Number((isLoc ? sub?.free_locations : sub?.free_practitioners) ?? 0));
  if (current < 1 + freeExtras) return; // admin-granted comped seats

  // Seats needed beyond the free allowance once this new one is created.
  const neededPaid = current + 1 - 1 - freeExtras;
  const selected = Math.max(0, Number((isLoc ? sub?.extra_locations : sub?.extra_practitioners) ?? 0));
  if (neededPaid <= selected) return; // already paying for this seat

  const patch = isLoc ? { extra_locations: neededPaid } : { extra_practitioners: neededPaid };

  if (sub?.id) {
    await supabase.from("practitioner_subscriptions").update(patch).eq("id", sub.id);
  } else {
    await supabase
      .from("practitioner_subscriptions")
      .insert({ profile_id: profileId, status: "pending", ...patch });
  }

  // If they're already on direct debit, push the new quantity to Stripe. We use
  // `proration_behavior: "none"` so nothing is charged mid-cycle — the higher
  // quantity simply bills in full from the next direct-debit cycle.
  if (sub?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(String(sub?.status))) {
    try {
      const { data: addon } = await supabase
        .from("subscription_plans")
        .select("stripe_price_id")
        .eq("kind", isLoc ? "addon_location" : "addon_practitioner")
        .eq("active", true)
        .maybeSingle();
      if (addon?.stripe_price_id) {
        const { getStripe } = await import("./stripe.server");
        const stripe = getStripe();
        const live = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        const item = live.items.data.find((i: any) => i.price.id === addon.stripe_price_id);
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          items: item
            ? [{ id: item.id, quantity: neededPaid }]
            : [{ price: addon.stripe_price_id, quantity: neededPaid }],
          proration_behavior: "none",
        });
      }

    } catch (e) {
      console.error("[billing] failed to sync extra seat to Stripe", e);
    }
  }
}


export const getMyBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("id, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) {
      // Staff members (receptionists / clinic admins) have no clinic profile of
      // their own — bill against the clinic they actually work for so they are
      // never locked out by a missing personal subscription.
      const { resolveClinicAccess } = await import("./clinic-context.server");
      const access = await resolveClinicAccess(context.supabase, context.userId);
      if (access.profileId) {
        const { data: clinic } = await context.supabase
          .from("profiles")
          .select("id, email")
          .eq("id", access.profileId)
          .maybeSingle();
        profile = clinic ?? null;
      }
    }
    if (!profile) return { state: "blocked", hasAccess: false, daysLeft: 0, deadline: null, arrearsCents: 0, arrearsInvoiceUrl: null };

    const readStatus = async () => {
      const { data, error } = await context.supabase.rpc("practitioner_billing_status", { _profile_id: profile.id });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    };
    let row = await readStatus();

    // Locked out? A paid subscription may exist in Stripe that a missed webhook
    // never mirrored here — reconcile before blocking access.
    if (!row?.has_access) {
      const { reconcileSubscriptionFromStripe } = await import("./billing-reconcile.server");
      const healed = await reconcileSubscriptionFromStripe(context.supabase, profile.id, profile.email);
      if (healed) row = await readStatus();
    }


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

    // Webhooks can arrive a few seconds after Stripe redirects back (and older
    // webhook configurations may not include subscription events). Reconcile
    // the practitioner's own Stripe customer on every billing-page load so a
    // successfully created direct debit is shown immediately.
    const { data: currentSub } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_customer_id, stripe_subscription_id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (currentSub?.stripe_customer_id) {
      try {
        const { getStripe } = await import("./stripe.server");
        const stripe = getStripe();
        const subscriptions = await stripe.subscriptions.list({
          customer: currentSub.stripe_customer_id,
          status: "all",
          limit: 10,
        });
        const live = subscriptions.data.find((s) =>
          ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(s.status),
        );
        if (live) {
          const patch = {
            stripe_subscription_id: live.id,
            status: live.status,
            cancel_at_period_end: live.cancel_at_period_end,
            current_period_end: (live as any).current_period_end
              ? new Date((live as any).current_period_end * 1000).toISOString()
              : null,
            trial_end: live.trial_end ? new Date(live.trial_end * 1000).toISOString() : null,
            stripe_addon_items: live.items.data.map((item) => ({
              id: item.id,
              price: item.price.id,
              quantity: item.quantity,
            })),
          };
          await context.supabase
            .from("practitioner_subscriptions")
            .update(patch as any)
            .eq("id", currentSub.id);
        }
      } catch (err) {
        // Keep the billing page usable during a temporary Stripe failure.
        console.error("[getMyBilling] Stripe reconciliation failed", err);
      }
      // Keep the live direct debit in step with what's on the account.
      try {
        const { syncSubscriptionSeats } = await import("./billing-sync.server");
        await syncSubscriptionSeats(context.supabase, profile.id);
      } catch (err) {
        console.error("[getMyBilling] seat sync failed", err);
      }
    }

    const [{ data: sub }, { data: plans }, { data: access }, { count: locCount }, { count: pracCount }] = await Promise.all([
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
      context.supabase.from("locations").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
      context.supabase
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("role", "practitioner")
        .in("status", ["invited", "active"]),
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

    const associates = await computeAssociateCharge(context.supabase, profile.id);

    return {
      profileId: profile.id,
      subscription: sub,
      plans: plans ?? [],
      hasAccess: Boolean(access),
      discountCode,
      profileCreatedAt: profile.created_at,
      associates,
      usage: {
        locations: locCount ?? 0,
        practitioners: pracCount ?? 0,
        associates: associates.used,
      },
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
      .in("kind", ["base", "addon_location", "addon_practitioner", "addon_associates_module", "addon_associate"])
      .eq("active", true);
    if (pErr) throw pErr;

    const base = (plans ?? []).find((p: any) => p.id === data.basePlanId && p.kind === "base");
    if (!base?.stripe_price_id) throw new Error("Plan not available");

    const locAddon = (plans ?? []).find((p: any) => p.kind === "addon_location");
    const pracAddon = (plans ?? []).find((p: any) => p.kind === "addon_practitioner");
    const assocModule = (plans ?? []).find((p: any) => p.kind === "addon_associates_module");
    const assocAddon = (plans ?? []).find((p: any) => p.kind === "addon_associate");
    const associates = await computeAssociateCharge(context.supabase, profile.id);

    const line_items: Array<{ price: string; quantity: number }> = [
      { price: base.stripe_price_id, quantity: 1 },
    ];
    if ((data.extraLocations ?? 0) > 0 && locAddon?.stripe_price_id) {
      line_items.push({ price: locAddon.stripe_price_id, quantity: data.extraLocations! });
    }
    if ((data.extraPractitioners ?? 0) > 0 && pracAddon?.stripe_price_id) {
      line_items.push({ price: pracAddon.stripe_price_id, quantity: data.extraPractitioners! });
    }
    const { ensurePlanPrice } = await import("./plan-prices.server");
    if (associates.moduleActive) {
      const priceId = await ensurePlanPrice(assocModule);
      if (priceId) line_items.push({ price: priceId, quantity: 1 });
    }
    if (associates.extraBlocks > 0) {
      const priceId = await ensurePlanPrice(assocAddon);
      if (priceId) line_items.push({ price: priceId, quantity: associates.extraBlocks });
    }

    // Existing subscription row / customer
    const { data: existing } = await context.supabase
      .from("practitioner_subscriptions")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | null | undefined;
    // Validate the stored customer still exists in the current Stripe mode.
    // A stale customer (e.g. created in test while we're now live, or deleted
    // in Stripe) makes checkout.sessions.create fail silently — recreate it.
    if (customerId) {
      try {
        const c: any = await stripe.customers.retrieve(customerId);
        if (!c || c.deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }
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

    // Carry any code redeemed on the Plan & billing page into checkout, so the
    // practitioner never has to re-enter it on Stripe's screen.
    let redeemedCouponId: string | null = null;
    if ((existing as any)?.discount_code_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: full } = await supabaseAdmin
        .from("platform_discount_codes")
        .select("id, code, description, percent_off, amount_off_cents, duration, duration_in_months, stripe_coupon_id")
        .eq("id", (existing as any).discount_code_id)
        .maybeSingle();
      if (full) {
        const { ensureStripeCoupon } = await import("./discount-codes.server");
        redeemedCouponId = await ensureStripeCoupon(full as any);
      }
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId ?? undefined,
        line_items,
        ...(redeemedCouponId
          ? { discounts: [{ coupon: redeemedCouponId }] }
          : { allow_promotion_codes: true }),

        // This Checkout session is created directly on MODO's Stripe account.
        // Card is currently enabled there and is saved for recurring billing;
        // explicitly requesting Bacs makes Stripe reject the whole session
        // until that payment method has completed account activation.
        payment_method_types: ["card"],
        subscription_data: {
          ...(trialEndSec ? { trial_end: trialEndSec } : {}),
          metadata: {
            profile_id: profile.id,
            plan_id: base.id,
            kind: "platform_subscription",
            extra_locations: String(data.extraLocations ?? 0),
            extra_practitioners: String(data.extraPractitioners ?? 0),
          },
        },
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe checkout failed";
      console.error("[startBillingCheckout] stripe error", msg);
      throw new Error(`Could not open Stripe checkout: ${msg}`);
    }

    const payload = {
      profile_id: profile.id,
      plan_id: base.id,
      stripe_customer_id: customerId,
      extra_locations: data.extraLocations ?? 0,
      extra_practitioners: data.extraPractitioners ?? 0,
      cancel_at_period_end: false,
    };
    if (existing) {
      await context.supabase.from("practitioner_subscriptions").update(payload).eq("id", existing.id);
    } else {
      await context.supabase.from("practitioner_subscriptions").insert({ ...payload, status: "pending" });
    }

    if (!session.url) throw new Error("Stripe returned no checkout URL. Please try again.");
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
 * Seat summary for the Practitioners / Locations pages so the UI can explain
 * exactly why an add is blocked and offer the right next step.
 */
export const getSeatSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getMyProfileId(context);
    const [{ data: sub }, { count: locCount }, { count: pracCount }, { data: plans }, { data: profRow }, { count: assocCount }] =
      await Promise.all([
      context.supabase
        .from("practitioner_subscriptions")
        .select(
          "status, comped, trial_end, current_period_end, stripe_subscription_id, plan_id, custom_price_cents, extra_locations, extra_practitioners, free_locations, free_practitioners, waive_associates_fee, free_associates, discount_percent, discount_amount_cents, discount_code_id",
        )
        .eq("profile_id", profile.id)
        .maybeSingle(),
      context.supabase.from("locations").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
      context.supabase
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("role", "practitioner")
        .in("status", ["invited", "active"]),
      context.supabase
        .from("subscription_plans")
        .select("id, kind, name, amount_cents, currency, interval, active")
        .eq("active", true),
      context.supabase.from("profiles").select("associates_enabled, slug").eq("id", profile.id).maybeSingle(),
      context.supabase
        .from("clinic_associates")
        .select("id", { count: "exact", head: true })
        .eq("clinic_profile_id", profile.id)
        .in("status", ["invited", "active"]),
    ]);

    const trialActive = Boolean(sub?.trial_end && new Date(sub.trial_end as string).getTime() > Date.now());
    const liveSub = Boolean(sub?.stripe_subscription_id && ["active", "trialing"].includes(String(sub?.status)));

    const list = (plans ?? []) as any[];
    const base = list.find((p) => p.id === sub?.plan_id) ?? list.find((p) => p.kind === "base") ?? null;
    const locAddon = list.find((p) => p.kind === "addon_location") ?? null;
    const pracAddon = list.find((p) => p.kind === "addon_practitioner") ?? null;
    const assocModule = list.find((p) => p.kind === "addon_associates_module") ?? null;
    const assocAddon = list.find((p) => p.kind === "addon_associate") ?? null;

    const freeLocs = Math.max(0, Number(sub?.free_locations ?? 0));
    const freePracs = Math.max(0, Number(sub?.free_practitioners ?? 0));
    const usedLocs = locCount ?? 0;
    const usedPracs = pracCount ?? 0;

    // Chargeable seats are derived from what actually exists on the account —
    // this is what the plan price is collated from, not a manual selection.
    const billableLocs = FREE_EXTRA_LOCATIONS ? 0 : Math.max(0, usedLocs - 1 - freeLocs);
    const billablePracs = Math.max(0, usedPracs - 1 - freePracs);

    // Associates: the service itself is a flat monthly add-on that covers the
    // first 5 associates, then every further block of 5 associates adds one
    // extra seat fee (6–10 = +1 block, 11–15 = +2 blocks, and so on).
    // Admins can waive the module fee and/or grant extra complimentary seats.
    // Charging for the Associates module is currently limited to pilot accounts.
    const ASSOC_BLOCK = 5;
    const assocBilling = associateBillingEnabled((profRow as any)?.slug);
    const assocWaived = Boolean((sub as any)?.waive_associates_fee) || !assocBilling;
    const freeAssoc = Math.max(0, Number((sub as any)?.free_associates ?? 0));
    const ASSOC_INCLUDED = ASSOC_BLOCK + freeAssoc;
    const associatesEnabled = Boolean((profRow as any)?.associates_enabled);
    const usedAssoc = assocCount ?? 0;
    const assocModuleCents = associatesEnabled && !assocWaived ? Number(assocModule?.amount_cents ?? 0) : 0;
    const billableAssoc =
      associatesEnabled && !assocWaived
        ? Math.ceil(Math.max(0, usedAssoc - ASSOC_INCLUDED) / ASSOC_BLOCK)
        : 0;


    const baseCents = Number(sub?.custom_price_cents ?? base?.amount_cents ?? 0);
    const currency = (base?.currency ?? locAddon?.currency ?? "gbp") as string;
    const interval = (base?.interval ?? "month") as string;
    const grossCents =
      baseCents +
      billableLocs * Number(locAddon?.amount_cents ?? 0) +
      billablePracs * Number(pracAddon?.amount_cents ?? 0) +
      assocModuleCents +
      billableAssoc * Number(assocAddon?.amount_cents ?? 0);

    // Admin-set standing discount on the collated monthly fee.
    const discountPercent = Math.max(0, Math.min(100, Number((sub as any)?.discount_percent ?? 0)));
    const discountAmountCents = Math.max(0, Number((sub as any)?.discount_amount_cents ?? 0));

    // A redeemed platform discount code also comes off the MODO plan total.
    let codeRow: { id: string; code: string; percent_off: number | null; amount_off_cents: number | null } | null = null;
    if ((sub as any)?.discount_code_id) {
      const { data: dc } = await context.supabase
        .from("platform_discount_codes")
        .select("id, code, percent_off, amount_off_cents")
        .eq("id", (sub as any).discount_code_id)
        .maybeSingle();
      codeRow = (dc as typeof codeRow) ?? null;
    }
    const { computeCodeDiscountCents } = await import("./discount-codes.server");
    const codeDiscountCents = sub?.comped ? 0 : computeCodeDiscountCents(grossCents, codeRow);

    const discountCents = sub?.comped
      ? 0
      : Math.min(
          grossCents,
          Math.round((grossCents * discountPercent) / 100) + discountAmountCents + codeDiscountCents,
        );
    const monthlyTotalCents = sub?.comped ? 0 : Math.max(0, grossCents - discountCents);

    return {
      comped: Boolean(sub?.comped),
      trialActive,
      liveSub,
      currency,
      interval,
      nextBillingDate: (sub?.current_period_end as string | null) ?? (sub?.trial_end as string | null) ?? null,
      basePlan: base ? { id: base.id, name: base.name, amount_cents: baseCents } : null,
      grossMonthlyCents: grossCents,
      discountCents,
      discountPercent,
      discountAmountCents,
      discountCode: codeRow,
      codeDiscountCents,
      monthlyTotalCents,

      practitioners: {
        used: usedPracs,
        allowed: 1 + Math.max(0, Number(sub?.extra_practitioners ?? 0)) + freePracs,
        freeExtras: freePracs,
        billable: billablePracs,
        addonCents: Number(pracAddon?.amount_cents ?? 0),
      },
      locations: {
        used: usedLocs,
        allowed: 1 + Math.max(0, Number(sub?.extra_locations ?? 0)) + freeLocs,
        freeExtras: freeLocs,
        billable: billableLocs,
        addonCents: Number(locAddon?.amount_cents ?? 0),
      },
      associates: {
        enabled: associatesEnabled,
        used: usedAssoc,
        included: ASSOC_INCLUDED,
        blockSize: ASSOC_BLOCK,
        /** Seats already paid for (included + purchased blocks of 5). */
        covered: ASSOC_INCLUDED + billableAssoc * ASSOC_BLOCK,
        /** Number of extra 5-seat blocks being charged. */
        billable: billableAssoc,
        waived: assocWaived,
        moduleCents: assocModuleCents,
        moduleActive: associatesEnabled && assocModuleCents > 0,
        addonCents: associatesEnabled && !assocWaived ? Number(assocAddon?.amount_cents ?? 0) : 0,
      },
    };


  });


/**
 * During the free trial a practitioner can reserve an extra seat instantly —
 * it is recorded on their subscription and billed when checkout completes.
 * Once a live Stripe subscription exists, quantities must go through
 * `updateMySubscriptionItems` on the billing page instead.
 */
export const reserveExtraSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind: "location" | "practitioner" }) => i)
  .handler(async ({ data, context }) => {
    const profile = await getMyProfileId(context);
    const { data: existing } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, status, trial_end, stripe_subscription_id, extra_locations, extra_practitioners")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const trialActive = Boolean(
      existing?.trial_end && new Date(existing.trial_end as string).getTime() > Date.now(),
    );
    if (existing?.stripe_subscription_id && ["active", "trialing"].includes(String(existing.status))) {
      throw new Error("You have a live subscription — change your add-on quantities in Plan & billing.");
    }
    if (!trialActive) {
      throw new Error("Your free trial has ended. Set up your MODO direct debit in Plan & billing to add seats.");
    }

    const isLoc = data.kind === "location";
    const currentVal = Number(
      (isLoc ? existing?.extra_locations : existing?.extra_practitioners) ?? 0,
    );
    const next = Math.max(0, currentVal) + 1;
    const patch = isLoc ? { extra_locations: next } : { extra_practitioners: next };
    if (existing) {
      await context.supabase
        .from("practitioner_subscriptions")
        .update(patch)
        .eq("id", existing.id);
    } else {
      await context.supabase
        .from("practitioner_subscriptions")
        .insert({ profile_id: profile.id, status: "pending", ...patch });
    }
    return { ok: true, reserved: next };
  });

/**
 * Update the existing live Stripe subscription in place: change the base plan
 * and/or add-on quantities. Uses `proration_behavior: "none"` so nothing is
 * charged mid-cycle — the new amount is collected from the next direct-debit
 * invoice, keeping the existing payment schedule.

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
      .select("id, kind, name, amount_cents, stripe_price_id, active")
      .in("kind", ["base", "addon_location", "addon_practitioner", "addon_associates_module", "addon_associate"])
      .eq("active", true);
    if (pErr) throw pErr;

    const base = (plans ?? []).find((p: any) => p.id === data.basePlanId && p.kind === "base");
    if (!base?.stripe_price_id) throw new Error("Plan not available");
    const locAddon = (plans ?? []).find((p: any) => p.kind === "addon_location");
    const pracAddon = (plans ?? []).find((p: any) => p.kind === "addon_practitioner");
    const assocModule = (plans ?? []).find((p: any) => p.kind === "addon_associates_module");
    const assocAddon = (plans ?? []).find((p: any) => p.kind === "addon_associate");
    const associates = await computeAssociateCharge(context.supabase, profile.id);

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
    const { ensurePlanPrice } = await import("./plan-prices.server");
    if (associates.moduleActive) {
      const priceId = await ensurePlanPrice(assocModule);
      if (priceId) wanted.push({ price: priceId, quantity: 1 });
    }
    if (associates.extraBlocks > 0) {
      const priceId = await ensurePlanPrice(assocAddon);
      if (priceId) wanted.push({ price: priceId, quantity: associates.extraBlocks });
    }

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
      proration_behavior: "none",
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

    // The subscription row may not exist yet (brand-new account) — a code can
    // still be redeemed against the plan, it simply applies to the total the
    // Plan & billing page collates.
    let { data: sub } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_subscription_id, stripe_customer_id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!sub) {
      const { data: created, error: cErr } = await context.supabase
        .from("practitioner_subscriptions")
        .insert({ profile_id: profile.id, status: "trialing" } as any)
        .select("id, stripe_subscription_id, stripe_customer_id")
        .single();
      if (cErr) throw cErr;
      sub = created as unknown as typeof sub;
    }

    // platform_discount_codes is admin-only under RLS — read the full row with
    // the service client so we can reuse / create the matching Stripe coupon.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: full } = await supabaseAdmin
      .from("platform_discount_codes")
      .select("id, code, description, percent_off, amount_off_cents, duration, duration_in_months, stripe_coupon_id")
      .eq("id", code.id)
      .maybeSingle();

    const isFullyFree = (full?.percent_off ?? code.percent_off ?? 0) >= 100;

    // Mirror onto the live direct debit when there is one, so the amount that
    // is actually collected matches the discounted plan total. Stripe problems
    // never block the code — it still applies on the MODO plan.
    if (sub!.stripe_subscription_id) {
      try {
        const { getStripeStable } = await import("./stripe.server");
        const stripe = getStripeStable();
        if (isFullyFree) {
          // 100% off — cancel the direct debit; no charges will be attempted.
          await stripe.subscriptions.cancel(sub!.stripe_subscription_id, {
            invoice_now: false,
            prorate: false,
          } as any);
        } else if (full) {
          const { ensureStripeCoupon } = await import("./discount-codes.server");
          const couponId = await ensureStripeCoupon(full as any);
          if (couponId) {
            await stripe.subscriptions.update(sub!.stripe_subscription_id, {
              discounts: [{ coupon: couponId }],
            } as any);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stripe error";
        console.error("[redeemDiscountCode] stripe error", msg);
      }
    }

    // Persist locally. If 100% off, mark as active/free and clear the Stripe subscription id.
    const update: Record<string, unknown> = { discount_code_id: code.id };
    if (isFullyFree) {
      update.status = "active";
      update.cancel_at_period_end = false;
      update.stripe_subscription_id = null;
    }
    await context.supabase.from("practitioner_subscriptions").update(update as any).eq("id", sub!.id);

    // If this was another practitioner's referral code, record the introduction
    // so they bank their reward once this clinic starts paying.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("record_practitioner_referral" as never, {
        _referred_profile_id: profile.id,
        _discount_code_id: code.id,
      } as never);
    } catch (err) {
      console.error("[redeemDiscountCode] referral link failed", err instanceof Error ? err.message : err);
    }

    return { ok: true as const, code: code.code, fullyFree: isFullyFree };

  });

/** Remove a redeemed code from the plan (and from the live direct debit). */
export const removeDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getMyProfileId(context);
    const { data: sub } = await context.supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_subscription_id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!sub) return { ok: true as const };
    if (sub.stripe_subscription_id) {
      try {
        const { getStripeStable } = await import("./stripe.server");
        const stripe = getStripeStable();
        await stripe.subscriptions.update(sub.stripe_subscription_id, { discounts: [] } as any);
      } catch (err) {
        console.error("[removeDiscountCode] stripe error", err instanceof Error ? err.message : err);
      }
    }
    await context.supabase
      .from("practitioner_subscriptions")
      .update({ discount_code_id: null } as any)
      .eq("id", sub.id);
    return { ok: true as const };
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
