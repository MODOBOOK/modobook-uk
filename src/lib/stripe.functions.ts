import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startStripeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { returnUrl: string; refreshUrl: string }) => input)
  .handler(async ({ data, context }) => {
    const { createConnectAccount, createConnectOnboardingLink } = await import("./stripe.server");
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

      const link = await createConnectOnboardingLink(accountId, data.refreshUrl, data.returnUrl);
      return { ok: true as const, url: link.url };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe onboarding could not be started.";
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "stripe_error";
      if (code === "connect_not_enabled") {
        return {
          ok: false as const,
          code,
          message: "Stripe Connect is not enabled on this sandbox platform account yet.",
          actionUrl: "https://dashboard.stripe.com/test/connect/overview",
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
    const account = await getAccount(profile.stripe_connect_account_id);
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
