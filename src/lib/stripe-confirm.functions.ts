import { createServerFn } from "@tanstack/react-start";

/**
 * Reconcile a completed Stripe Checkout Session with our appointments.
 *
 * This is a webhook-independent fallback: after Stripe redirects the patient
 * back to the success URL we call this from the browser with the session id.
 * It fetches the session from the connected account, verifies it is paid,
 * and applies the same appointment patch our webhook would.
 *
 * Safe to call publicly — it only mutates appointments referenced in the
 * session metadata, and only when Stripe confirms the session is paid.
 */
export const confirmCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((i: { sessionId: string; slug: string }) => i)
  .handler(async ({ data }) => {
    const { sessionId, slug } = data;
    if (!sessionId || !slug) return { ok: false, reason: "missing_input" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_connect_account_id")
      .eq("slug", slug)
      .maybeSingle();
    const accountId = (profile as { stripe_connect_account_id?: string | null } | null)
      ?.stripe_connect_account_id;
    if (!accountId) return { ok: false, reason: "no_connected_account" as const };

    const isLiveSession = sessionId.startsWith("cs_live_");
    const key = isLiveSession
      ? process.env.STRIPE_LIVE_API_KEY ||
        process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_PLATFORM_SECRET_KEY
      : process.env.STRIPE_TEST_API_KEY ||
        process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_PLATFORM_SECRET_KEY;
    if (!key) return { ok: false, reason: "no_key" as const };

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia", typescript: true });

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(
        sessionId,
        { expand: ["payment_intent"] },
        { stripeAccount: accountId },
      );
    } catch (e) {
      console.error("[confirmCheckoutSession] retrieve failed", e);
      return { ok: false, reason: "retrieve_failed" as const };
    }

    if (session.payment_status !== "paid") {
      return { ok: false, reason: "not_paid" as const, status: session.payment_status };
    }

    const metadata = session.metadata ?? {};
    const idsRaw = metadata.appointment_ids ?? "";
    const ids = String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return { ok: false, reason: "no_appointments" as const };

    const surchargeCents = Number(metadata.surcharge_cents ?? 0) || 0;
    const totalCents = Number(session.amount_total ?? 0) || 0;
    const treatmentPaidCents = Math.max(0, totalCents - surchargeCents);
    const perAppt = Math.round(treatmentPaidCents / ids.length);
    const kind = metadata.kind || "deposit";
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    let updated = 0;
    const confirmedAppointmentIds: string[] = [];
    for (const apptId of ids) {
      const { data: cur } = await supabaseAdmin
        .from("appointments")
        .select("amount_paid_cents, payment_status, total_amount, stripe_payment_intent_id")
        .eq("id", apptId)
        .maybeSingle();
      const already = cur as {
        amount_paid_cents?: number;
        payment_status?: string;
        total_amount?: number | null;
        stripe_payment_intent_id?: string | null;
      } | null;
      // Idempotent: if already marked paid with intent recorded, skip amount bump.
      const alreadyPaid = already?.payment_status === "paid";
      const samePayment = Boolean(paymentIntentId && already?.stripe_payment_intent_id === paymentIntentId);
      const patch: Record<string, unknown> = {
        status: "confirmed",
        payment_hold_expires_at: null,
        payment_status: "paid",
        stripe_payment_intent_id: paymentIntentId,
      };
      if (kind === "deposit") {
        patch.deposit_paid_at = new Date().toISOString();
      } else {
        patch.payment_method = "stripe_link";
        patch.checkout_completed_at = new Date().toISOString();
      }
      if (!alreadyPaid && !samePayment) {
        const appointmentTotal = Math.round(Number(already?.total_amount ?? 0) * 100);
        patch.amount_paid_cents = Math.min(
          appointmentTotal,
          Number(already?.amount_paid_cents ?? 0) + perAppt,
        );
      }
      const { error } = await supabaseAdmin
        .from("appointments")
        .update(patch as never)
        .eq("id", apptId);
      if (!error) {
        updated += 1;
        confirmedAppointmentIds.push(apptId);
      }
    }

    if (metadata.save_card_on_file === "1" && paymentIntentId) {
      const { saveCardOnFileFromPaymentIntent } = await import("./card-on-file.server");
      await saveCardOnFileFromPaymentIntent({
        stripe,
        accountId,
        paymentIntentId,
        patientEmail: metadata.patient_email ?? session.customer_details?.email ?? null,
        patientName: session.customer_details?.name ?? null,
        appointmentId: confirmedAppointmentIds[0] ?? null,
        profileId: (profile as { id?: string } | null)?.id ?? null,
      });
    }

    if (confirmedAppointmentIds.length > 0) {
      try {
        const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
        await sendBookingConfirmationEmails(confirmedAppointmentIds);
      } catch (e) {
        console.error("[confirmCheckoutSession] confirmation email failed", e);
      }
    }

    return { ok: true as const, updated };

  });

/**
 * Reconcile an embedded Payment Element payment (our own card flow, which has
 * no Checkout Session) and capture the card on file when the practitioner has
 * save-card-on-file enabled. Webhook-independent fallback; idempotent.
 */
export const confirmBookingPaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((i: { paymentIntentId: string; slug: string }) => i)
  .handler(async ({ data }) => {
    const { paymentIntentId, slug } = data;
    if (!paymentIntentId || !slug) return { ok: false, reason: "missing_input" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_connect_account_id")
      .eq("slug", slug)
      .maybeSingle();
    const prof = profile as { id?: string; stripe_connect_account_id?: string | null } | null;
    const accountId = prof?.stripe_connect_account_id;
    if (!accountId) return { ok: false, reason: "no_connected_account" as const };

    const Stripe = (await import("stripe")).default;
    // PaymentIntent IDs do not identify whether they belong to live or test
    // mode. Try the configured live key first, then test, instead of guessing
    // from the `pi_` value (the previous heuristic always classified every PI
    // as live and could not reconcile test-mode payments).
    const candidateKeys = [
      process.env.STRIPE_LIVE_API_KEY,
      process.env.STRIPE_TEST_API_KEY,
      process.env.STRIPE_SECRET_KEY,
      process.env.STRIPE_PLATFORM_SECRET_KEY,
    ].filter((key, index, keys): key is string => Boolean(key) && keys.indexOf(key) === index);
    if (candidateKeys.length === 0) return { ok: false, reason: "no_key" as const };

    let stripe: InstanceType<typeof Stripe> | null = null;
    let pi: Awaited<ReturnType<InstanceType<typeof Stripe>["paymentIntents"]["retrieve"]>> | null = null;
    let lastRetrieveError: unknown;
    for (const key of candidateKeys) {
      const candidate = new Stripe(key, { apiVersion: "2026-06-24.dahlia", typescript: true });
      try {
        pi = await candidate.paymentIntents.retrieve(paymentIntentId, {}, { stripeAccount: accountId });
        stripe = candidate;
        break;
      } catch (error) {
        lastRetrieveError = error;
      }
    }
    if (!stripe || !pi) {
      console.error("[confirmBookingPaymentIntent] retrieve failed", lastRetrieveError);
      return { ok: false, reason: "retrieve_failed" as const };
    }
    if (pi.status !== "succeeded") return { ok: false, reason: "not_paid" as const, status: pi.status };

    const metadata = pi.metadata ?? {};
    const ids = String(metadata.appointment_ids ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const surchargeCents = Number(metadata.surcharge_cents ?? 0) || 0;
    const totalCents = Number(pi.amount_received ?? pi.amount ?? 0) || 0;
    const treatmentPaidCents = Math.max(0, totalCents - surchargeCents);
    const perAppt = ids.length > 0 ? Math.round(treatmentPaidCents / ids.length) : 0;
    const kind = metadata.kind || "deposit";

    const confirmedAppointmentIds: string[] = [];
    for (const apptId of ids) {
      const { data: cur } = await supabaseAdmin
        .from("appointments")
        .select("amount_paid_cents, payment_status")
        .eq("id", apptId)
        .maybeSingle();
      const already = cur as { amount_paid_cents?: number; payment_status?: string } | null;
      const patch: Record<string, unknown> = {
        status: "confirmed",
        payment_hold_expires_at: null,
        payment_status: "paid",
        stripe_payment_intent_id: pi.id,
      };
      if (kind === "deposit") patch.deposit_paid_at = new Date().toISOString();
      else {
        patch.payment_method = "stripe_link";
        patch.checkout_completed_at = new Date().toISOString();
      }
      if (already?.payment_status !== "paid") {
        patch.amount_paid_cents = Number(already?.amount_paid_cents ?? 0) + perAppt;
      }
      const { error } = await supabaseAdmin
        .from("appointments")
        .update(patch as never)
        .eq("id", apptId);
      if (!error) confirmedAppointmentIds.push(apptId);
    }

    let cardSaved = false;
    if (metadata.save_card_on_file === "1") {
      const { saveCardOnFileFromPaymentIntent } = await import("./card-on-file.server");
      const res = await saveCardOnFileFromPaymentIntent({
        stripe,
        accountId,
        paymentIntentId: pi.id,
        patientEmail: metadata.patient_email ?? null,
        appointmentId: confirmedAppointmentIds[0] ?? null,
        profileId: prof?.id ?? null,
      });
      cardSaved = res.ok;
    }

    if (confirmedAppointmentIds.length > 0) {
      try {
        const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
        await sendBookingConfirmationEmails(confirmedAppointmentIds);
      } catch (e) {
        console.error("[confirmBookingPaymentIntent] confirmation email failed", e);
      }
    }

    return { ok: true as const, updated: confirmedAppointmentIds.length, cardSaved };
  });
