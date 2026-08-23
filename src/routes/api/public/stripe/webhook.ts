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
        // Stripe's JSON formatting is not stable (it may emit either
        // `"livemode":true` or `"livemode": true`). Parse the envelope
        // instead of doing an exact substring match; the old check caused
        // live PaymentIntents to be retrieved with the test key, so card-on-
        // file persistence failed even though the payment itself succeeded.
        let isLiveEvent = false;
        try {
          const envelope = JSON.parse(rawBody) as { livemode?: boolean };
          isLiveEvent = envelope.livemode === true;
        } catch {
          return new Response("Invalid webhook payload", { status: 400 });
        }
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
              const metadata = session.metadata ?? {};

              // Card capture: no money moves. The patient saved a card against
              // the clinic's Stripe account, so store it on the appointment and
              // confirm the booking.
              if (session.mode === "setup" && metadata.kind === "card_capture") {
                const ids = String(metadata.appointment_ids ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                let paymentMethodId: string | null = null;
                let customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
                try {
                  const setupIntentId = typeof session.setup_intent === "string"
                    ? session.setup_intent
                    : session.setup_intent?.id;
                  if (setupIntentId) {
                    const si = await stripe.setupIntents.retrieve(
                      setupIntentId,
                      {},
                      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
                    );
                    paymentMethodId = typeof si.payment_method === "string"
                      ? si.payment_method
                      : si.payment_method?.id ?? null;
                    customerId = customerId ?? (typeof si.customer === "string" ? si.customer : si.customer?.id ?? null);
                  }
                } catch (e) {
                  console.error("[stripe webhook] card_capture setup intent lookup failed", e);
                }
                for (const apptId of ids) {
                  await supabaseAdmin
                    .from("appointments")
                    .update({
                      status: "confirmed",
                      card_captured_at: new Date().toISOString(),
                      stripe_customer_id: customerId,
                      stripe_payment_method_id: paymentMethodId,
                    } as never)
                    .eq("id", apptId);
                  paidAppointmentIds.push(apptId);
                }
                break;
              }


              // Platform subscriptions commonly return `no_payment_required`
              // while the free trial is active. Link them immediately rather
              // than treating them like an unpaid patient booking.
              if (session.mode === "subscription" && metadata.kind === "platform_subscription") {
                const subscriptionId = typeof session.subscription === "string"
                  ? session.subscription
                  : session.subscription?.id;
                const customerId = typeof session.customer === "string"
                  ? session.customer
                  : session.customer?.id;
                if (subscriptionId && customerId) {
                  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                  const patch = {
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscription.id,
                    status: subscription.status,
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    current_period_end: (subscription as any).current_period_end
                      ? new Date((subscription as any).current_period_end * 1000).toISOString()
                      : null,
                    trial_end: subscription.trial_end
                      ? new Date(subscription.trial_end * 1000).toISOString()
                      : null,
                    stripe_addon_items: subscription.items.data.map((item) => ({
                      id: item.id, price: item.price.id, quantity: item.quantity,
                    })),
                  };
                  await supabaseAdmin
                    .from("practitioner_subscriptions")
                    .update(patch as never)
                    .eq("profile_id", metadata.profile_id);
                }
                break;
              }

              // Gift card purchases: activate the code and email it once paid.
              if (metadata.kind === "gift_card_purchase" && metadata.gift_card_purchase_id) {
                if (session.payment_status !== "paid") break;
                try {
                  const { data: purchase } = await supabaseAdmin
                    .from("gift_card_purchases")
                    .select("*, gift_cards(name)")
                    .eq("id", metadata.gift_card_purchase_id)
                    .maybeSingle();
                  const p = purchase as any;
                  if (p && p.status !== "active") {
                    await supabaseAdmin
                      .from("gift_card_purchases")
                      .update({ status: "active" })
                      .eq("id", p.id);
                    const to = p.delivery === "buyer" ? p.buyer_email : p.recipient_email;
                    if (to) {
                      const { enqueueAppEmail } = await import("@/lib/email/send.server");
                      await enqueueAppEmail({
                        templateName: "gift-card-delivery",
                        recipientEmail: to,
                        messageId: `gift-card-${p.id}`,
                        templateData: {
                          recipientName: p.recipient_name,
                          buyerName: p.buyer_name,
                          code: p.code,
                          cardName: p.gift_cards?.name ?? "Gift card",
                          amount: p.kind === "value" ? Number(p.initial_amount) : null,
                          expiresAt: p.expires_at,
                          message: p.message,
                          profileId: p.profile_id,
                        },
                      });
                    }
                  }
                } catch (e) {
                  console.error("[stripe-webhook] gift card activation failed", e);
                }
                break;
              }

              // Training courses: confirm the booking (and its calendar entry)
              // once payment lands.
              if (metadata.kind === "training_booking" && metadata.training_booking_id) {
                if (session.payment_status !== "paid") break;
                try {
                  const { data: tb } = await supabaseAdmin
                    .from("training_bookings")
                    .update({
                      payment_status: "paid",
                      status: "confirmed",
                      amount_paid: (session.amount_total ?? 0) / 100,
                      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
                    })
                    .eq("id", metadata.training_booking_id)
                    .select("appointment_id")
                    .maybeSingle();
                  if (tb?.appointment_id) {
                    await supabaseAdmin
                      .from("appointments")
                      .update({ payment_status: "paid", status: "confirmed" })
                      .eq("id", tb.appointment_id);
                  }
                } catch (e) {
                  console.error("[stripe-webhook] training booking payment failed", e);
                }
                break;
              }

              // Room rental: only confirm the booking once the money lands.
              if (metadata.kind === "room_rental_booking" && metadata.rental_booking_id) {
                if (session.payment_status !== "paid") break;
                try {
                  await supabaseAdmin
                    .from("rental_bookings")
                    .update({ payment_status: "paid", status: "confirmed" })
                    .eq("id", metadata.rental_booking_id);
                  const { sendRentalInvoiceForBooking } = await import("@/lib/room-rental.functions");
                  await sendRentalInvoiceForBooking(String(metadata.rental_booking_id));
                } catch (e) {
                  console.error("[stripe-webhook] rental booking payment failed", e);
                }
                break;
              }

              if (session.payment_status !== "paid") break;
              const paymentLinkId =
                typeof session.payment_link === "string"
                  ? session.payment_link
                  : session.payment_link?.id;
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
                    .select("amount_paid_cents, total_amount, stripe_payment_intent_id")
                    .eq("id", apptId)
                    .maybeSingle();
                  const current = cur as {
                    amount_paid_cents?: number;
                    total_amount?: number | null;
                    stripe_payment_intent_id?: string | null;
                  } | null;
                  if (!paymentIntentId || current?.stripe_payment_intent_id !== paymentIntentId) {
                    const appointmentTotal = Math.round(Number(current?.total_amount ?? 0) * 100);
                    patch.amount_paid_cents = Math.min(
                      appointmentTotal,
                      Number(current?.amount_paid_cents ?? 0) + treatmentPaidCents,
                    );
                  }
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
                      .select("amount_paid_cents, total_amount, stripe_payment_intent_id")
                      .eq("id", apptId)
                      .maybeSingle();
                    const current = cur as {
                      amount_paid_cents?: number;
                      total_amount?: number | null;
                      stripe_payment_intent_id?: string | null;
                    } | null;
                    if (!paymentIntentId || current?.stripe_payment_intent_id !== paymentIntentId) {
                      const appointmentTotal = Math.round(Number(current?.total_amount ?? 0) * 100);
                      patch.amount_paid_cents = Math.min(
                        appointmentTotal,
                        Number(current?.amount_paid_cents ?? 0) + perAppt,
                      );
                    }
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


            case "payment_intent.succeeded": {
              // Embedded card payments use our own Payment Element instead of
              // Stripe hosted Checkout. There is no checkout.session.completed
              // event to hook into — this payment_intent.succeeded fires on
              // the connected account when the patient pays.
              const pi = event.data.object as Stripe.PaymentIntent;
              const metadata = pi.metadata ?? {};
              if (!metadata.appointment_ids) break;
              if (!connectedAccountId) break;

              const surchargeCents = Number(metadata.surcharge_cents ?? 0) || 0;
              const totalCents = Number(pi.amount_received ?? pi.amount ?? 0) || 0;
              const treatmentPaidCents = Math.max(0, totalCents - surchargeCents);
              const kind = metadata.kind || "deposit";

              const buildApptPatch = () => {
                const patch: Record<string, unknown> = {
                  status: "confirmed",
                  payment_hold_expires_at: null,
                  stripe_payment_intent_id: pi.id,
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

              const ids = String(metadata.appointment_ids)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const perAppt = ids.length > 0 ? Math.round(treatmentPaidCents / ids.length) : 0;
              for (const apptId of ids) {
                const patch = buildApptPatch();
                const { data: cur } = await supabaseAdmin
                  .from("appointments")
                  .select("amount_paid_cents")
                  .eq("id", apptId)
                  .maybeSingle();
                patch.amount_paid_cents =
                  Number((cur as { amount_paid_cents?: number } | null)?.amount_paid_cents ?? 0) + perAppt;
                await supabaseAdmin
                  .from("appointments")
                  .update(patch as never)
                  .eq("id", apptId);
                paidAppointmentIds.push(apptId);
              }

              // Persist the saved PaymentMethod onto clinic_clients only when
              // the practitioner has enabled save-card-on-file. Embedded card
              // deposit payments still confirm here, but do not store cards.
              if (metadata.save_card_on_file === "1") {
                try {
                  const full = await stripe.paymentIntents.retrieve(
                    pi.id,
                    { expand: ["payment_method"] },
                    { stripeAccount: connectedAccountId },
                  );
                  const pm = full.payment_method as Stripe.PaymentMethod | null;
                  const customerId =
                    typeof full.customer === "string"
                      ? full.customer
                      : full.customer?.id ?? null;
                  const card = pm?.card;
                  const email = (metadata.patient_email || "").toLowerCase();
                  if (customerId && pm?.id && card && email && paidAppointmentIds[0]) {
                    const { data: appt } = await supabaseAdmin
                      .from("appointments")
                      .select("profile_id")
                      .eq("id", paidAppointmentIds[0])
                      .maybeSingle();
                    const profileId = (appt as { profile_id?: string } | null)?.profile_id ?? null;
                    if (profileId) {
                      const { data: existing } = await supabaseAdmin
                        .from("clinic_clients")
                        .select("id, full_name")
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
                            full_name: email,
                            ...patch,
                          } as never);
                      }
                    }
                  }
                } catch (e) {
                  console.error("[stripe/webhook] embedded card-on-file capture failed", e);
                }
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

            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              const s = event.data.object as Stripe.Subscription;
              const isPlatform = (s.metadata?.kind === "platform_subscription") ||
                !connectedAccountId; // platform-level events have no connect account
              if (!isPlatform) break;

              const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
              if (!customerId) break;

              const patch: Record<string, unknown> = {
                stripe_subscription_id: s.id,
                status: s.status,
                cancel_at_period_end: s.cancel_at_period_end,
                current_period_end: (s as any).current_period_end
                  ? new Date((s as any).current_period_end * 1000).toISOString()
                  : null,
                trial_end: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
                stripe_addon_items: s.items?.data?.map((it) => ({
                  id: it.id, price: it.price?.id, quantity: it.quantity,
                })) ?? [],
              };
              if (event.type === "customer.subscription.deleted") {
                patch.status = "canceled";
              }
              const profileId = s.metadata?.profile_id;
              const query = supabaseAdmin
                .from("practitioner_subscriptions")
                .update({ ...patch, stripe_customer_id: customerId } as never);
              if (profileId) await query.eq("profile_id", profileId);
              else await query.eq("stripe_customer_id", customerId);
              break;
            }

            case "invoice.created":
            case "invoice.finalized":
            case "invoice.updated":
            case "invoice.paid":
            case "invoice.payment_succeeded":
            case "invoice.payment_failed":
            case "invoice.voided":
            case "invoice.marked_uncollectible": {
              const inv = event.data.object as Stripe.Invoice;
              // Only mirror platform (MODO) subscription invoices — skip
              // connected-account invoices for practitioners' own patients.
              if (connectedAccountId) break;
              const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
              if (!customerId) break;

              // Locate the practitioner this invoice belongs to.
              const { data: subRow } = await supabaseAdmin
                .from("practitioner_subscriptions")
                .select("profile_id")
                .eq("stripe_customer_id", customerId)
                .maybeSingle();
              const profileId = (subRow as { profile_id?: string } | null)?.profile_id;
              if (!profileId) break;

              const anyInv = inv as unknown as {
                period_start?: number; period_end?: number; due_date?: number | null;
                status_transitions?: { paid_at?: number | null };
                last_finalization_error?: { message?: string } | null;
                subscription?: string | { id?: string } | null;
              };
              const subId =
                typeof anyInv.subscription === "string" ? anyInv.subscription :
                (anyInv.subscription && "id" in anyInv.subscription ? anyInv.subscription.id : null) ?? null;
              const paidAt = anyInv.status_transitions?.paid_at
                ? new Date(anyInv.status_transitions.paid_at * 1000).toISOString()
                : null;

              const row = {
                profile_id: profileId,
                stripe_invoice_id: inv.id!,
                stripe_customer_id: customerId,
                stripe_subscription_id: subId,
                number: inv.number ?? null,
                status: inv.status ?? "open",
                currency: (inv.currency ?? "gbp").toLowerCase(),
                amount_due_cents: Number(inv.amount_due ?? 0),
                amount_paid_cents: Number(inv.amount_paid ?? 0),
                amount_remaining_cents: Number(inv.amount_remaining ?? 0),
                attempt_count: Number(inv.attempt_count ?? 0),
                hosted_invoice_url: inv.hosted_invoice_url ?? null,
                invoice_pdf: inv.invoice_pdf ?? null,
                period_start: anyInv.period_start ? new Date(anyInv.period_start * 1000).toISOString() : null,
                period_end: anyInv.period_end ? new Date(anyInv.period_end * 1000).toISOString() : null,
                due_date: anyInv.due_date ? new Date(anyInv.due_date * 1000).toISOString() : null,
                paid_at: paidAt,
                last_payment_error:
                  event.type === "invoice.payment_failed"
                    ? (anyInv.last_finalization_error?.message ?? "Payment failed")
                    : null,
              };

              await supabaseAdmin
                .from("platform_invoices")
                .upsert(row as never, { onConflict: "stripe_invoice_id" });

              if (event.type === "invoice.payment_failed") {
                await supabaseAdmin
                  .from("practitioner_subscriptions")
                  .update({ status: "past_due" } as never)
                  .eq("stripe_customer_id", customerId);
                // Fire arrears email (non-blocking).
                try {
                  const { sendPlatformArrearsEmail } = await import("@/lib/email/send.server");
                  await sendPlatformArrearsEmail({
                    profileId,
                    stripeInvoiceId: inv.id!,
                    amountDueCents: Number(inv.amount_due ?? 0),
                    currency: (inv.currency ?? "gbp").toLowerCase(),
                    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
                    attemptCount: Number(inv.attempt_count ?? 0),
                  });
                } catch (e) {
                  console.error("[stripe-webhook] arrears email failed", e);
                }
              } else if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
                // Clear past_due when the outstanding invoice is settled.
                await supabaseAdmin
                  .from("practitioner_subscriptions")
                  .update({ status: "active" } as never)
                  .eq("stripe_customer_id", customerId)
                  .eq("status", "past_due");
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
