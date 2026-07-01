import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startStripeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { returnUrl: string; refreshUrl: string }) => input)
  .handler(async ({ data, context }) => {
    const { createConnectAccount, createConnectOnboardingLink, getStripeMode } = await import("./stripe.server");
    const { supabase, userId, claims } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, stripe_connect_account_id")
      .eq("user_id", userId)
      .single();
    if (error) throw error;

    try {
      let accountId = profile.stripe_connect_account_id;
      if (!accountId) {
        const email = profile.email || (claims as { email?: string })?.email || "";
        const account = await createConnectAccount(email);
        accountId = account.id;
        await supabase
          .from("profiles")
          .update({
            stripe_connect_account_id: accountId,
            stripe_connect_onboarding_status: "pending",
          })
          .eq("id", profile.id);
      }

      try {
        const link = await createConnectOnboardingLink(accountId, data.refreshUrl, data.returnUrl);
        return { ok: true as const, url: link.url, mode: getStripeMode() };
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "stripe_error";
        if (code !== "stale_connect_account") throw error;

        const email = profile.email || (claims as { email?: string })?.email || "";
        const account = await createConnectAccount(email);
        accountId = account.id;
        await supabase
          .from("profiles")
          .update({
            stripe_connect_account_id: accountId,
            stripe_connect_onboarding_status: "pending",
          })
          .eq("id", profile.id);
        const link = await createConnectOnboardingLink(accountId, data.refreshUrl, data.returnUrl);
        return { ok: true as const, url: link.url, mode: getStripeMode(), recovered: true as const };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe onboarding could not be started.";
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "stripe_error";
      if (code === "connect_not_enabled") {
        return {
          ok: false as const,
          code,
          message,
          actionUrl: "https://dashboard.stripe.com/test/connect/overview",
        };
      }
      if (code === "invalid_secret_mode") {
        return {
          ok: false as const,
          code,
          message,
        };
      }
      if (code === "missing_secret") {
        return {
          ok: false as const,
          code,
          message: "Stripe sandbox keys are not available to the server yet.",
        };
      }
      return { ok: false as const, code, message };
    }
  });

export const refreshStripeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAccount } = await import("./stripe.server");
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
        .update({ stripe_connect_account_id: null, stripe_connect_onboarding_status: "not_started" })
        .eq("id", profile.id);
      return { status: "not_started" as const, reset: true as const };
    }
    const status = account.charges_enabled ? "active" : account.details_submitted ? "pending" : "incomplete";
    await supabase
      .from("profiles")
      .update({ stripe_connect_onboarding_status: status })
      .eq("id", profile.id);
    return {
      status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  });

function extractStripeConnectAccountId(value: string) {
  const trimmed = value.trim();
  const direct = trimmed.match(/acct_[A-Za-z0-9]+/);
  if (direct) return direct[0];

  try {
    const url = new URL(trimmed);
    const encodedAccount = url.pathname
      .split("/")
      .find((part) => part.startsWith("YWNjdF8"));
    if (!encodedAccount) return null;
    const decoded = atob(encodedAccount.replace(/-/g, "+").replace(/_/g, "/"));
    return decoded.match(/^acct_[A-Za-z0-9]+$/) ? decoded : null;
  } catch {
    return null;
  }
}

export const pairExistingStripeConnectLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stripeConnectLink: string }) => input)
  .handler(async ({ data, context }) => {
    const { getAccount } = await import("./stripe.server");
    const { supabase, userId } = context;
    const accountId = extractStripeConnectAccountId(data.stripeConnectLink);

    if (!accountId) {
      return {
        ok: false as const,
        message: "Paste the full Stripe Connect setup link, or an account ID that starts with acct_.",
      };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (error) throw error;

    try {
      const account = await getAccount(accountId);
      const status = account.charges_enabled ? "active" : account.details_submitted ? "pending" : "incomplete";
      await supabase
        .from("profiles")
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_onboarding_status: status,
        })
        .eq("id", profile.id);

      return {
        ok: true as const,
        accountId,
        status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe account could not be paired.";
      return {
        ok: false as const,
        message,
      };
    }
  });
