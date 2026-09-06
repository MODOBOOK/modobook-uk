import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { membershipsEnabled } from "@/lib/feature-flags";

const NOT_LIVE = "Memberships are not available for this clinic yet.";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, slug, clinic_name, full_name, stripe_connect_account_id")
    .eq("id", await __activeProfileId(supabase, userId))
    .single();
  return data as {
    id: string;
    slug: string | null;
    clinic_name: string | null;
    full_name: string | null;
    stripe_connect_account_id: string | null;
  } | null;
}

const planSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).nullish(),
  priceCents: z.number().int().min(100),
  interval: z.enum(["month", "year"]).default("month"),
  creditCents: z.number().int().min(0).default(0),
  spendMode: z.enum(["any", "restricted", "manual"]).default("any"),
  eligibleTreatmentIds: z.array(z.string().uuid()).nullish(),
  includedTreatments: z
    .array(z.object({ treatment_id: z.string().uuid(), quantity: z.number().int().min(1) }))
    .default([]),
  discountPercent: z.number().min(0).max(100).nullish(),
  perks: z.string().max(2000).nullish(),
  active: z.boolean().default(true),
});

// ============= Practitioner: plan management =============

export const listMembershipPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile || !membershipsEnabled(profile.slug)) return [];
    const { data, error } = await context.supabase
      .from("membership_plans")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const saveMembershipPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) throw new Error("Profile not found");
    if (!membershipsEnabled(profile.slug)) throw new Error(NOT_LIVE);
    if (!profile.stripe_connect_account_id) {
      throw new Error("Connect your Stripe account first (Dashboard → Payments).");
    }
    if (data.spendMode === "restricted" && !(data.eligibleTreatmentIds ?? []).length) {
      throw new Error("Pick which treatments the credit can be spent on.");
    }

    const row = {
      profile_id: profile.id,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price_cents: Math.round(data.priceCents),
      interval: data.interval,
      credit_cents: Math.round(data.creditCents),
      spend_mode: data.spendMode,
      eligible_treatment_ids: data.spendMode === "restricted" ? (data.eligibleTreatmentIds ?? []) : null,
      included_treatments: data.includedTreatments,
      discount_percent: data.discountPercent ?? null,
      perks: data.perks?.trim() || null,
      active: data.active,
    };

    let planId = data.id;
    if (planId) {
      const { error } = await context.supabase
        .from("membership_plans")
        .update(row as never)
        .eq("id", planId)
        .eq("profile_id", profile.id);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await context.supabase
        .from("membership_plans")
        .insert(row as never)
        .select("id")
        .single();
      if (error) throw error;
      planId = (inserted as { id: string }).id;
    }

    // Sync the recurring price on the connected account.
    const { ensureMembershipPrice } = await import("./stripe.server");
    const priceId = await ensureMembershipPrice({
      accountId: profile.stripe_connect_account_id,
      planId: planId!,
      name: data.name.trim(),
      amountCents: data.priceCents,
      interval: data.interval,
    });
    await context.supabase
      .from("membership_plans")
      .update({ stripe_price_id: priceId } as never)
      .eq("id", planId!)
      .eq("profile_id", profile.id);

    return { id: planId, stripe_price_id: priceId };
  });

export const deleteMembershipPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) throw new Error("Profile not found");
    if (!membershipsEnabled(profile.slug)) throw new Error(NOT_LIVE);
    // Soft-delete so existing subscribers keep their history; the plan just
    // stops being sold.
    const { error } = await context.supabase
      .from("membership_plans")
      .update({ active: false } as never)
      .eq("id", data.id)
      .eq("profile_id", profile.id);
    if (error) throw error;
    return { ok: true };
  });

// ============= Practitioner: member management =============

export const listMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile || !membershipsEnabled(profile.slug)) return [];
    const { data, error } = await context.supabase
      .from("patient_memberships")
      .select("*, membership_plans(name, price_cents, interval, credit_cents)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const setMembershipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "pause" | "resume" | "cancel" }) => input)
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) throw new Error("Profile not found");
    if (!membershipsEnabled(profile.slug)) throw new Error(NOT_LIVE);
    const { data: m } = await context.supabase
      .from("patient_memberships")
      .select("id, status, stripe_subscription_id")
      .eq("id", data.id)
      .eq("profile_id", profile.id)
      .maybeSingle();
    const membership = m as { id: string; status: string; stripe_subscription_id: string | null } | null;
    if (!membership) throw new Error("Membership not found");

    const accountId = profile.stripe_connect_account_id;
    if (membership.stripe_subscription_id && accountId) {
      const stripe = await import("./stripe.server");
      if (data.action === "cancel") {
        await stripe.cancelConnectedSubscription(accountId, membership.stripe_subscription_id);
      } else if (data.action === "pause") {
        await stripe.pauseConnectedSubscription(accountId, membership.stripe_subscription_id);
      } else {
        await stripe.resumeConnectedSubscription(accountId, membership.stripe_subscription_id);
      }
    }

    const status = data.action === "cancel" ? "cancelled" : data.action === "pause" ? "paused" : "active";
    const { error } = await context.supabase
      .from("patient_memberships")
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("profile_id", profile.id);
    if (error) throw error;
    return { ok: true, status };
  });

// Manually adjust a patient's credit pot (top-up, goodwill, correction).
export const adjustPatientCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { patientUserId: string; deltaCents: number; note?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) throw new Error("Profile not found");
    if (!membershipsEnabled(profile.slug)) throw new Error(NOT_LIVE);
    const delta = Math.round(data.deltaCents);
    if (!delta) throw new Error("Enter a non-zero amount");
    if (Math.abs(delta) > 1_000_000) throw new Error("Amount too large");

    // Guard: the patient must have a membership or credit history with this clinic.
    const { data: link } = await context.supabase
      .from("patient_memberships")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("patient_user_id", data.patientUserId)
      .limit(1);
    const { data: ledgerRows } = await context.supabase
      .from("patient_credit_ledger")
      .select("id")
      .eq("clinic_profile_id", profile.id)
      .eq("patient_user_id", data.patientUserId)
      .limit(1);
    if (!(link ?? []).length && !(ledgerRows ?? []).length) {
      throw new Error("This patient has no membership or credit with your clinic yet.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("patient_credit_ledger").insert({
      patient_user_id: data.patientUserId,
      clinic_profile_id: profile.id,
      delta_pennies: delta,
      reason: "membership_adjustment",
      note: data.note?.trim() || "Manual adjustment by clinic",
    } as never);
    if (error) throw error;
    return { ok: true };
  });

export const getPatientCreditForClinic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { patientUserId: string }) => input)
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile || !membershipsEnabled(profile.slug)) return { balanceCents: 0 };
    const { data: rows } = await context.supabase
      .from("patient_credit_ledger")
      .select("delta_pennies")
      .eq("clinic_profile_id", profile.id)
      .eq("patient_user_id", data.patientUserId);
    const balance = (rows ?? []).reduce(
      (s: number, r: { delta_pennies: number }) => s + Number(r.delta_pennies),
      0,
    );
    return { balanceCents: balance };
  });

// ============= Patient: browse & subscribe =============

export const listPublicMembershipPlans = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const { createClient } = await import("@supabase/supabase-js");
    const pub = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: profile } = await pub
      .from("profiles")
      .select("id, clinic_name, full_name")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) return { clinicName: null as string | null, plans: [] as never[] };
    const { data: plans } = await pub
      .from("membership_plans")
      .select("id, name, description, price_cents, interval, credit_cents, spend_mode, discount_percent, perks, included_treatments")
      .eq("profile_id", (profile as { id: string }).id)
      .eq("active", true)
      .order("price_cents", { ascending: true });
    return {
      clinicName:
        (profile as { clinic_name?: string | null; full_name?: string | null }).clinic_name ??
        (profile as { full_name?: string | null }).full_name ??
        null,
      plans: (plans ?? []) as never[],
    };
  });

// The signed-in patient's memberships + credit balance for one clinic slug.
export const getMyMembershipForClinic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) return { memberships: [], balanceCents: 0 };
    const profileId = (profile as { id: string }).id;

    const [{ data: memberships }, { data: ledger }] = await Promise.all([
      supabase
        .from("patient_memberships")
        .select("id, status, current_period_end, created_at, membership_plans(name, price_cents, interval, credit_cents, perks, discount_percent)")
        .eq("profile_id", profileId)
        .eq("patient_user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("patient_credit_ledger")
        .select("delta_pennies")
        .eq("clinic_profile_id", profileId)
        .eq("patient_user_id", userId),
    ]);
    const balanceCents = (ledger ?? []).reduce(
      (s: number, r: { delta_pennies: number }) => s + Number(r.delta_pennies),
      0,
    );
    return { memberships: memberships ?? [], balanceCents };
  });

export const subscribeToMembershipPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; planId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, slug, clinic_name, full_name, stripe_connect_account_id")
      .eq("slug", data.slug)
      .maybeSingle();
    const p = profile as {
      id: string; slug: string | null; clinic_name: string | null;
      full_name: string | null; stripe_connect_account_id: string | null;
    } | null;
    if (!p?.stripe_connect_account_id) throw new Error("This clinic can't take memberships yet.");

    const { data: planRow } = await supabase
      .from("membership_plans")
      .select("id, name, price_cents, interval, stripe_price_id, active")
      .eq("id", data.planId)
      .eq("profile_id", p.id)
      .maybeSingle();
    const plan = planRow as {
      id: string; name: string; price_cents: number;
      interval: "month" | "year"; stripe_price_id: string | null; active: boolean;
    } | null;
    if (!plan?.active) throw new Error("This plan is no longer available.");

    // Already subscribed to this plan?
    const { data: existing } = await supabase
      .from("patient_memberships")
      .select("id, status")
      .eq("plan_id", plan.id)
      .eq("patient_user_id", userId)
      .in("status", ["active", "paused"])
      .maybeSingle();
    if (existing) throw new Error("You're already subscribed to this plan.");

    let priceId = plan.stripe_price_id;
    if (!priceId) {
      const { ensureMembershipPrice } = await import("./stripe.server");
      priceId = await ensureMembershipPrice({
        accountId: p.stripe_connect_account_id,
        planId: plan.id,
        name: plan.name,
        amountCents: plan.price_cents,
        interval: plan.interval,
      });
      await supabase
        .from("membership_plans")
        .update({ stripe_price_id: priceId } as never)
        .eq("id", plan.id);
    }

    const email = (context.claims as { email?: string } | undefined)?.email ?? undefined;
    const origin = `https://modobook.uk`;
    const { createMembershipCheckoutSession } = await import("./stripe.server");
    const session = await createMembershipCheckoutSession({
      accountId: p.stripe_connect_account_id,
      priceId,
      successUrl: `${origin}/m/${data.slug}/memberships?joined=1`,
      cancelUrl: `${origin}/m/${data.slug}/memberships`,
      customerEmail: email,
      metadata: {
        kind: "membership",
        plan_id: plan.id,
        profile_id: p.id,
        patient_user_id: userId,
      },
    });
    return { url: session.url };
  });

// ============= Checkout: credit preview & redemption =============

// How much of the signed-in patient's credit pot can be applied to this
// booking. Respects the plan's spend mode (any / restricted / manual).
export const previewMembershipCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; treatmentIds: string[]; totalCents: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) return { applicableCents: 0, balanceCents: 0, mode: null as string | null };
    const profileId = (profile as { id: string }).id;

    const { data: ledger } = await supabase
      .from("patient_credit_ledger")
      .select("delta_pennies")
      .eq("clinic_profile_id", profileId)
      .eq("patient_user_id", userId);
    const balance = (ledger ?? []).reduce(
      (s: number, r: { delta_pennies: number }) => s + Number(r.delta_pennies),
      0,
    );
    if (balance <= 0) return { applicableCents: 0, balanceCents: 0, mode: null as string | null };

    // Most permissive active plan wins: any > restricted (if matching) > manual.
    const { data: memberships } = await supabase
      .from("patient_memberships")
      .select("membership_plans(spend_mode, eligible_treatment_ids)")
      .eq("profile_id", profileId)
      .eq("patient_user_id", userId)
      .eq("status", "active");

    let mode: "any" | "restricted" | "manual" | null = null;
    let eligible: string[] = [];
    for (const m of memberships ?? []) {
      const plan = (m as { membership_plans?: { spend_mode: string; eligible_treatment_ids: string[] | null } | null })
        .membership_plans;
      if (!plan) continue;
      if (plan.spend_mode === "any") {
        mode = "any";
        break;
      }
      if (plan.spend_mode === "restricted") {
        const ids = plan.eligible_treatment_ids ?? [];
        if (data.treatmentIds.some((t) => ids.includes(t))) {
          mode = "restricted";
          eligible = ids;
        }
      } else if (!mode) {
        mode = "manual"; // manual pots are applied in-clinic, not online
      }
    }
    if (mode === "manual") {
      return { applicableCents: 0, balanceCents: balance, mode };
    }
    const applicableCents = mode ? Math.min(balance, Math.max(0, Math.round(data.totalCents))) : 0;
    return { applicableCents, balanceCents: balance, mode };
  });

// Deduct credit after a booking is confirmed. Idempotent on appointment id.
export const redeemMembershipCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { slug: string; appointmentId: string; amountCents: number }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = Math.round(data.amountCents);
    if (amount <= 0) return { ok: true, applied: 0 };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) throw new Error("Clinic not found");
    const profileId = (profile as { id: string }).id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Idempotency: already redeemed for this appointment?
    const { data: existing } = await supabaseAdmin
      .from("patient_credit_ledger")
      .select("id")
      .eq("ref_type", "appointment")
      .eq("ref_id", data.appointmentId)
      .eq("reason", "membership_spend")
      .limit(1);
    if ((existing ?? []).length) return { ok: true, applied: 0 };

    // Re-check balance server-side before deducting.
    const { data: ledgerRows } = await supabaseAdmin
      .from("patient_credit_ledger")
      .select("delta_pennies")
      .eq("clinic_profile_id", profileId)
      .eq("patient_user_id", userId);
    const balance = (ledgerRows ?? []).reduce(
      (s: number, r: { delta_pennies: number }) => s + Number(r.delta_pennies),
      0,
    );
    const applied = Math.min(amount, Math.max(0, balance));
    if (applied <= 0) return { ok: true, applied: 0 };

    const { error } = await supabaseAdmin.from("patient_credit_ledger").insert({
      patient_user_id: userId,
      clinic_profile_id: profileId,
      delta_pennies: -applied,
      reason: "membership_spend",
      ref_type: "appointment",
      ref_id: data.appointmentId,
      note: "Membership credit used on booking",
    } as never);
    if (error) throw error;
    return { ok: true, applied };
  });
