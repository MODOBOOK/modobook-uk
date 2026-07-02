import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startStripeStandardConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data, context }) => {
    const { buildStripeOAuthAuthorizeUrl, getStripeMode } = await import("./stripe.server");
    const { supabase, userId, claims } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("user_id", userId)
      .single();
    if (error) throw error;

    try {
      // Generate a single-use state token, valid 15 minutes.
      const state = crypto.randomUUID() + "-" + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await supabase
        .from("profiles")
        .update({
          stripe_oauth_state: state,
          stripe_oauth_state_expires_at: expiresAt,
        } as never)
        .eq("id", profile.id);

      const email = profile.email || (claims as { email?: string })?.email || undefined;
      const redirectOrigin = "https://modo-book.lovable.app";
      const redirectUri = `${redirectOrigin}/api/public/stripe/oauth-callback`;
      const url = buildStripeOAuthAuthorizeUrl({ state, redirectUri, email });

      return { ok: true as const, url, mode: getStripeMode() };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start Stripe connect.";
      const code = typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : "stripe_error";
      return { ok: false as const, code, message };
    }
  });

export const checkStripeConnectSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getStripeSetupSummary, getStripe } = await import("./stripe.server");
    const setup = getStripeSetupSummary();

    try {
      const stripe = getStripe();
      await stripe.balance.retrieve();
      const modeMatchesKey =
        (setup.mode === "live" && setup.secretKeyType === "live") ||
        (setup.mode === "sandbox" && setup.secretKeyType === "test");

      return {
        ok: modeMatchesKey && setup.connectClientIdType === "connect",
        ...setup,
        stripeReachable: true,
        message: modeMatchesKey && setup.connectClientIdType === "connect"
          ? "MODO can reach Stripe and the key mode looks correct. If Stripe still spins, the selected Stripe account is likely blocked, restricted, or already connected to another platform."
          : "Stripe is reachable, but the saved Stripe mode, key, or Connect client ID does not match.",
      };
    } catch (e) {
      return {
        ok: false as const,
        ...setup,
        stripeReachable: false,
        message: e instanceof Error ? e.message : "MODO could not reach Stripe with the saved key.",
      };
    }
  });

export const disconnectStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deauthorizeStripeAccount } = await import("./stripe.server");
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, stripe_connect_account_id")
      .eq("user_id", userId)
      .single();
    if (error) throw error;

    if (profile.stripe_connect_account_id) {
      try {
        await deauthorizeStripeAccount(profile.stripe_connect_account_id);
      } catch {
        // Continue and clear the DB even if Stripe rejects (already revoked, etc.).
      }
    }

    await supabase
      .from("profiles")
      .update({
        stripe_connect_account_id: null,
        stripe_connect_onboarding_status: "not_started",
        stripe_connect_type: null,
      } as never)
      .eq("id", profile.id);

    return { ok: true as const };
  });

export const refreshStripeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAccount, ensureDailyPayoutSchedule } = await import("./stripe.server");

    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, stripe_connect_account_id")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    if (!profile.stripe_connect_account_id) return { status: "not_started" as const };
    let account;
    try {
      account = await getAccount(profile.stripe_connect_account_id);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "stripe_error";
      if (code !== "stale_connect_account") throw error;
      await supabase
        .from("profiles")
        .update({
          stripe_connect_account_id: null,
          stripe_connect_onboarding_status: "not_started",
          stripe_connect_type: null,
        } as never)
        .eq("id", profile.id);
      return { status: "not_started" as const, reset: true as const };
    }
    const status = account.charges_enabled ? "active" : account.details_submitted ? "pending" : "incomplete";
    if (account.payouts_enabled) {
      await ensureDailyPayoutSchedule(profile.stripe_connect_account_id);
    }
    await supabase
      .from("profiles")
      .update({ stripe_connect_onboarding_status: status } as never)
      .eq("id", profile.id);

    return {
      status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  });

export const getStripePayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectBalance, listConnectPayouts } = await import("./stripe.server");
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    if (!profile.stripe_connect_account_id) {
      return { ok: false as const, code: "not_connected", message: "Connect Stripe to view payouts." };
    }
    try {
      const [balance, payouts] = await Promise.all([
        getConnectBalance(profile.stripe_connect_account_id),
        listConnectPayouts(profile.stripe_connect_account_id, 20),
      ]);
      const sum = (arr: Array<{ amount: number; currency: string }> | undefined) =>
        (arr ?? []).reduce<Record<string, number>>((acc, b) => {
          acc[b.currency] = (acc[b.currency] ?? 0) + b.amount;
          return acc;
        }, {});
      return {
        ok: true as const,
        available: sum(balance?.available),
        pending: sum(balance?.pending),
        instantAvailable: sum(balance?.instant_available ?? []),
        payouts: (payouts?.data ?? []).map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          arrivalDate: p.arrival_date,
          created: p.created,
          method: p.method,
          description: p.description,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load payouts.";
      const code = typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : "stripe_error";
      return { ok: false as const, code, message };
    }
  });

export const refundAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string; amount?: number }) => input)
  .handler(async ({ data, context }) => {
    const { createRefund } = await import("./stripe.server");
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, stripe_connect_account_id")
      .eq("user_id", userId)
      .single();
    if (pErr) throw pErr;
    if (!profile.stripe_connect_account_id) {
      return { ok: false as const, message: "Connect Stripe to process refunds." };
    }

    const { data: appt, error: aErr } = await supabase
      .from("appointments")
      .select("id, profile_id, stripe_payment_intent_id, amount_paid_cents, amount_refunded_cents")
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id)
      .single();
    if (aErr) throw aErr;
    if (!appt.stripe_payment_intent_id) {
      return { ok: false as const, message: "No Stripe payment on this booking to refund." };
    }

    const paid = Number(appt.amount_paid_cents ?? 0);
    const alreadyRefunded = Number(appt.amount_refunded_cents ?? 0);
    const maxRefundable = Math.max(0, paid - alreadyRefunded);
    if (maxRefundable <= 0) {
      return { ok: false as const, message: "This booking has already been fully refunded." };
    }
    const refundAmount = data.amount != null ? Math.min(data.amount, maxRefundable / 100) : undefined;

    try {
      const refund = await createRefund(
        appt.stripe_payment_intent_id,
        profile.stripe_connect_account_id,
        refundAmount,
      );
      const refundedCents = Number(refund.amount ?? (refundAmount ? Math.round(refundAmount * 100) : maxRefundable));
      const newRefunded = alreadyRefunded + refundedCents;
      const fullyRefunded = newRefunded >= paid;
      await supabase
        .from("appointments")
        .update({
          amount_refunded_cents: newRefunded,
          payment_status: fullyRefunded ? "refunded" : "paid",
        })
        .eq("id", appt.id);
      return { ok: true as const, refundedCents, fullyRefunded };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : "Refund failed." };
    }
  });
