import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });

        const key =
          process.env.STRIPE_TEST_API_KEY ||
          process.env.STRIPE_SECRET_KEY ||
          process.env.STRIPE_PLATFORM_SECRET_KEY;
        if (!key) return new Response("Stripe key not configured", { status: 500 });

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const rawBody = await request.text();
        const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia", typescript: true });

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "invalid signature";
          return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const connectedAccountId = (event as unknown as { account?: string }).account ?? null;

        try {
          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded": {
              const session = event.data.object as Stripe.Checkout.Session;
              if (session.payment_status !== "paid") break;
              const paymentLinkId =
                typeof session.payment_link === "string"
                  ? session.payment_link
                  : session.payment_link?.id;
              const metadata = session.metadata ?? {};
              const paymentIntentId =
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id ?? null;

              // Amount actually paid toward the treatment (exclude the platform
              // surcharge we added as a separate line item so the practitioner
              // sees the true paid-vs-outstanding balance).
              const surchargeCents = Number(metadata.surcharge_cents ?? 0) || 0;
              const totalCents = Number(session.amount_total ?? 0) || 0;
              const treatmentPaidCents = Math.max(0, totalCents - surchargeCents);

              const buildApptPatch = (kind: string) => {
                const patch: Record<string, unknown> = {
                  status: "confirmed",
                  payment_hold_expires_at: null,
                  stripe_payment_intent_id: paymentIntentId,
                };
                if (kind === "deposit") {
                  patch.deposit_paid_at = new Date().toISOString();
                  patch.payment_status = "paid";
                } else {
                  patch.payment_status = "paid";
                  patch.payment_method = "stripe_link";
                  patch.checkout_completed_at = new Date().toISOString();
                }
                return patch;
              };

              if (paymentLinkId) {
                const { data: pl } = await supabaseAdmin
                  .from("payment_links")
                  .update({
                    status: "paid",
                    paid_at: new Date().toISOString(),
                    stripe_payment_intent_id: paymentIntentId,
                  } as never)
                  .eq("stripe_payment_link_id", paymentLinkId)
                  .select("id, appointment_id, kind, profile_id")
                  .maybeSingle();

                const apptId = pl?.appointment_id || metadata.appointment_id;
                if (apptId) {
                  const kind = pl?.kind || metadata.kind || "deposit";
                  const patch = buildApptPatch(kind);
                  // Increment amount_paid_cents by the treatment portion of this charge.
                  const { data: cur } = await supabaseAdmin
                    .from("appointments")
                    .select("amount_paid_cents")
                    .eq("id", apptId)
                    .maybeSingle();
                  patch.amount_paid_cents = Number((cur as { amount_paid_cents?: number } | null)?.amount_paid_cents ?? 0) + treatmentPaidCents;
                  await supabaseAdmin
                    .from("appointments")
                    .update(patch as never)
                    .eq("id", apptId);
                }
              } else if (metadata.appointment_ids) {
                // Checkout Session created directly for a booking (deposit / full)
                const ids = String(metadata.appointment_ids).split(",").map((s) => s.trim()).filter(Boolean);
                if (ids.length > 0) {
                  const kind = metadata.kind || "deposit";
                  const perAppt = Math.round(treatmentPaidCents / ids.length);
                  for (const apptId of ids) {
                    const patch = buildApptPatch(kind);
                    const { data: cur } = await supabaseAdmin
                      .from("appointments")
                      .select("amount_paid_cents")
                      .eq("id", apptId)
                      .maybeSingle();
                    patch.amount_paid_cents = Number((cur as { amount_paid_cents?: number } | null)?.amount_paid_cents ?? 0) + perAppt;
                    await supabaseAdmin
                      .from("appointments")
                      .update(patch as never)
                      .eq("id", apptId);
                  }
                }
              }
              break;

            }

            case "checkout.session.expired": {
              // Patient abandoned the checkout — release the slot immediately.
              const session = event.data.object as Stripe.Checkout.Session;
              const metadata = session.metadata ?? {};
              if (metadata.appointment_ids) {
                const ids = String(metadata.appointment_ids).split(",").map((s) => s.trim()).filter(Boolean);
                if (ids.length > 0) {
                  await supabaseAdmin
                    .from("appointments")
                    .update({ status: "cancelled", payment_hold_expires_at: null } as never)
                    .in("id", ids)
                    .eq("payment_status", "pending");
                }
              }
              break;
            }

            case "checkout.session.async_payment_failed": {
              const session = event.data.object as Stripe.Checkout.Session;
              const paymentLinkId =
                typeof session.payment_link === "string"
                  ? session.payment_link
                  : session.payment_link?.id;
              if (paymentLinkId) {
                await supabaseAdmin
                  .from("payment_links")
                  .update({ status: "failed" } as never)
                  .eq("stripe_payment_link_id", paymentLinkId);
              }
              break;
            }


            case "charge.refunded": {
              const charge = event.data.object as Stripe.Charge;
              const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
              if (pi) {
                await supabaseAdmin
                  .from("payment_links")
                  .update({ status: "refunded" } as never)
                  .eq("stripe_payment_intent_id", pi);
              }
              break;
            }

            case "account.updated": {
              const account = event.data.object as Stripe.Account;
              const accountId = account.id ?? connectedAccountId;
              if (accountId) {
                const status = account.charges_enabled
                  ? "active"
                  : account.details_submitted
                    ? "pending"
                    : "incomplete";
                await supabaseAdmin
                  .from("profiles")
                  .update({ stripe_connect_onboarding_status: status } as never)
                  .eq("stripe_connect_account_id", accountId);
              }
              break;
            }
          }
        } catch (err) {
          console.error("[stripe-webhook] handler error", event.type, err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
