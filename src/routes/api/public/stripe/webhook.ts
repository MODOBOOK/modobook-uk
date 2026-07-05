import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

function getWebhookSecrets() {
  return [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECTED_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter((secret): secret is string => Boolean(secret));
}

async function parseStripeWebhook(params: {
  stripe: Stripe;
  rawBody: string;
  signature: string;
  secrets: string[];
}) {
  // Peek at the payload to decide which parser Stripe expects. v2 core events
  // (Workbench "Event destinations") include `"type":"v2.core..."` and MUST be
  // parsed with parseEventNotificationAsync; classic events use constructEventAsync.
  let isV2 = false;
  try {
    const preview = JSON.parse(params.rawBody) as { type?: string };
    isV2 = typeof preview.type === "string" && preview.type.startsWith("v2.");
  } catch {
    // fall through — treat as classic
  }

  let lastError: unknown;
  for (const secret of params.secrets) {
    try {
      if (isV2) {
        return {
          kind: "notification" as const,
          event: await params.stripe.parseEventNotificationAsync(
            params.rawBody,
            params.signature,
            secret,
          ),
        };
      }
      return {
        kind: "classic" as const,
        event: await params.stripe.webhooks.constructEventAsync(
          params.rawBody,
          params.signature,
          secret,
        ),
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("invalid signature");
}

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secrets = getWebhookSecrets();
        if (secrets.length === 0) return new Response("Webhook secret not configured", { status: 500 });

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const rawBody = await request.text();
        const isLiveEvent = rawBody.includes('"livemode":true');
        const key = isLiveEvent
          ? process.env.STRIPE_LIVE_API_KEY ||
            process.env.STRIPE_SECRET_KEY ||
            process.env.STRIPE_PLATFORM_SECRET_KEY
          : process.env.STRIPE_TEST_API_KEY ||
            process.env.STRIPE_SECRET_KEY ||
            process.env.STRIPE_PLATFORM_SECRET_KEY;
        if (!key) return new Response("Stripe key not configured", { status: 500 });

        const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia", typescript: true });

        let parsed: Awaited<ReturnType<typeof parseStripeWebhook>>;
        try {
          parsed = await parseStripeWebhook({ stripe, rawBody, signature, secrets });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "invalid signature";
          return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
        }

        if (parsed.kind === "notification") {
          // Stripe Workbench's new Event Destinations send v2.core.event notifications.
          // They are account/status updates, not Checkout payment confirmations, so
          // acknowledge them to stop retries while classic checkout webhooks below
          // continue to update appointments after payment.
          return new Response("ok", { status: 200 });
        }

        const event = parsed.event;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const connectedAccountId = (event as unknown as { account?: string }).account ?? null;

        // Collect appointment IDs paid by this Stripe event so we can send
        // branded booking-confirmation emails once the money's in.
        const paidAppointmentIds: string[] = [];

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
                  paidAppointmentIds.push(apptId);
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
                    paidAppointmentIds.push(apptId);
                  }
                }
              }

              // Card-on-file capture (GDPR: only when the practitioner has
              // opted in and the patient paid with card). We store the Stripe
              // Customer + PaymentMethod on clinic_clients so no-show / late
              // cancel fees can be charged later off-session.
              if (metadata.save_card_on_file === "1" && connectedAccountId) {
                try {
                  const full = await stripe.checkout.sessions.retrieve(
                    session.id,
                    { expand: ["payment_intent", "payment_intent.payment_method"] },
                    { stripeAccount: connectedAccountId },
                  );
                  const pi = full.payment_intent as Stripe.PaymentIntent | null;
                  const pm = pi?.payment_method as Stripe.PaymentMethod | null;
                  const customerId = typeof full.customer === "string"
                    ? full.customer
                    : full.customer?.id ?? null;
                  const card = pm?.card;
                  const email = (metadata.patient_email || full.customer_details?.email || "").toLowerCase();
                  if (customerId && pm?.id && card && email) {
                    // Look up profile_id from the first paid appointment.
                    let profileId: string | null = null;
                    if (paidAppointmentIds[0]) {
                      const { data: appt } = await supabaseAdmin
                        .from("appointments")
                        .select("profile_id")
                        .eq("id", paidAppointmentIds[0])
                        .maybeSingle();
                      profileId = (appt as { profile_id?: string } | null)?.profile_id ?? null;
                    }
                    if (profileId) {
                      const { data: existing } = await supabaseAdmin
                        .from("clinic_clients")
                        .select("id")
                        .eq("profile_id", profileId)
                        .ilike("email", email)
                        .maybeSingle();
                      const patch = {
                        stripe_customer_id: customerId,
                        stripe_payment_method_id: pm.id,
                        card_brand: card.brand,
                        card_last4: card.last4,
                        card_exp_month: card.exp_month,
                        card_exp_year: card.exp_year,
                        card_saved_at: new Date().toISOString(),
                        card_save_consent_at: new Date().toISOString(),
                      };
                      if (existing?.id) {
                        await supabaseAdmin
                          .from("clinic_clients")
                          .update(patch as never)
                          .eq("id", existing.id);
                      } else {
                        await supabaseAdmin
                          .from("clinic_clients")
                          .insert({
                            profile_id: profileId,
                            email,
                            full_name: full.customer_details?.name || email,
                            ...patch,
                          } as never);
                      }
                    }
                  }
                } catch (e) {
                  console.error("[stripe/webhook] card-on-file capture failed", e);
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

            case "account.application.deauthorized": {
              // Practitioner revoked MODO's access from inside their own Stripe dashboard.
              const accountId = connectedAccountId;
              if (accountId) {
                await supabaseAdmin
                  .from("profiles")
                  .update({
                    stripe_connect_account_id: null,
                    stripe_connect_onboarding_status: "not_started",
                    stripe_connect_type: null,
                  } as never)
                  .eq("stripe_connect_account_id", accountId);
              }
              break;
            }

          }
        } catch (err) {
          console.error("[stripe-webhook] handler error", event.type, err);
          return new Response("Handler error", { status: 500 });
        }

        // Send branded booking-confirmation emails for appointments paid in
        // this event. Non-blocking — never fail the webhook because email
        // rendering failed. Idempotent via message_id = booking-confirm-<id>.
        if (paidAppointmentIds.length > 0) {
          try {
            const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
            await sendBookingConfirmationEmails(paidAppointmentIds);
          } catch (e) {
            console.error("[stripe-webhook] confirmation email failed", e);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
