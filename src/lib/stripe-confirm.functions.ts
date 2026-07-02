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

    const key =
      process.env.STRIPE_TEST_API_KEY ||
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
    const notifyIds: string[] = [];
    for (const apptId of ids) {
      const { data: cur } = await supabaseAdmin
        .from("appointments")
        .select("amount_paid_cents, payment_status")
        .eq("id", apptId)
        .maybeSingle();
      const already = cur as { amount_paid_cents?: number; payment_status?: string } | null;
      // Idempotent: if already marked paid with intent recorded, skip amount bump.
      const alreadyPaid = already?.payment_status === "paid";
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
      if (!alreadyPaid) {
        patch.amount_paid_cents = Number(already?.amount_paid_cents ?? 0) + perAppt;
      }
      const { error } = await supabaseAdmin
        .from("appointments")
        .update(patch as never)
        .eq("id", apptId);
      if (!error) {
        updated += 1;
        if (!alreadyPaid) notifyIds.push(apptId);
      }
    }

    if (notifyIds.length > 0) {
      const { sendBookingNotifications } = await import("@/lib/email/send-branded.server");
      await Promise.all(notifyIds.map((id) => sendBookingNotifications(id)));
    }

    return { ok: true as const, updated };
  });
