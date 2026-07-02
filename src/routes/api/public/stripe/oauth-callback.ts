import { createFileRoute } from "@tanstack/react-router";

// Stripe redirects the practitioner here after they approve/deny the
// "Connect with Stripe" (Standard OAuth) prompt. We verify the state token,
// exchange the code for the practitioner's account id, and save it.
export const Route = createFileRoute("/api/public/stripe/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        const dashboardUrl = new URL("/dashboard/payments", url.origin);

        if (errorParam) {
          dashboardUrl.searchParams.set("stripe_error", errorDescription || errorParam);
          return Response.redirect(dashboardUrl.toString(), 302);
        }

        if (!code || !state) {
          dashboardUrl.searchParams.set("stripe_error", "Missing code or state from Stripe.");
          return Response.redirect(dashboardUrl.toString(), 302);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Look up the profile that started this OAuth flow via the state token.
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, stripe_oauth_state_expires_at")
          .eq("stripe_oauth_state", state)
          .maybeSingle();

        if (!profile) {
          dashboardUrl.searchParams.set("stripe_error", "Session expired. Please try connecting again.");
          return Response.redirect(dashboardUrl.toString(), 302);
        }

        const expiresAt = (profile as { stripe_oauth_state_expires_at?: string | null })
          .stripe_oauth_state_expires_at;
        if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
          await supabaseAdmin
            .from("profiles")
            .update({ stripe_oauth_state: null, stripe_oauth_state_expires_at: null } as never)
            .eq("id", profile.id);
          dashboardUrl.searchParams.set("stripe_error", "Connection link expired. Please try again.");
          return Response.redirect(dashboardUrl.toString(), 302);
        }

        try {
          const { exchangeStripeOAuthCode, getAccount } = await import("@/lib/stripe.server");
          const token = await exchangeStripeOAuthCode(code);
          const accountId = token?.stripe_user_id;
          if (!accountId) throw new Error("Stripe did not return an account id.");

          let status = "pending";
          try {
            const account = await getAccount(accountId);
            status = account?.charges_enabled
              ? "active"
              : account?.details_submitted
                ? "pending"
                : "incomplete";
          } catch {
            // Account details fetch is best-effort.
          }

          await supabaseAdmin
            .from("profiles")
            .update({
              stripe_connect_account_id: accountId,
              stripe_connect_onboarding_status: status,
              stripe_connect_type: "standard",
              stripe_oauth_state: null,
              stripe_oauth_state_expires_at: null,
            } as never)
            .eq("id", profile.id);

          dashboardUrl.searchParams.set("connected", "1");
          return Response.redirect(dashboardUrl.toString(), 302);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Stripe connection failed.";
          await supabaseAdmin
            .from("profiles")
            .update({ stripe_oauth_state: null, stripe_oauth_state_expires_at: null } as never)
            .eq("id", profile.id);
          dashboardUrl.searchParams.set("stripe_error", message);
          return Response.redirect(dashboardUrl.toString(), 302);
        }
      },
    },
  },
});
