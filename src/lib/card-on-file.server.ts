import type Stripe from "stripe";

/**
 * Persist the card used on a PaymentIntent onto the clinic_clients record so
 * the practitioner can charge no-show / late-cancel fees off-session later.
 *
 * Shared by the Stripe webhook and the browser-side reconciliation fallback,
 * so a missing connected-account webhook no longer means a lost card on file.
 * Idempotent — re-running just rewrites the same values.
 */
export async function saveCardOnFileFromPaymentIntent(params: {
  stripe: Stripe;
  accountId: string;
  paymentIntentId: string;
  patientEmail?: string | null;
  patientName?: string | null;
  appointmentId?: string | null;
  profileId?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const pi = await params.stripe.paymentIntents.retrieve(
      params.paymentIntentId,
      { expand: ["payment_method", "latest_charge"] },
      { stripeAccount: params.accountId },
    );

    let pm = pi.payment_method as Stripe.PaymentMethod | string | null;
    if (typeof pm === "string") {
      pm = await params.stripe.paymentMethods.retrieve(pm, {}, { stripeAccount: params.accountId });
    }
    let customerId = typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;

    // Fall back to the charge's generated payment method (Stripe creates a
    // fresh reusable PM when setup_future_usage is set).
    if (!pm) {
      const charge = pi.latest_charge as Stripe.Charge | string | null;
      const chargeObj =
        typeof charge === "string"
          ? await params.stripe.charges.retrieve(charge, {}, { stripeAccount: params.accountId })
          : charge;
      const generated = chargeObj?.payment_method_details?.card?.__typename as unknown;
      void generated;
      if (chargeObj?.payment_method) {
        pm = await params.stripe.paymentMethods.retrieve(
          chargeObj.payment_method as string,
          {},
          { stripeAccount: params.accountId },
        );
      }
      if (!customerId && chargeObj?.customer) {
        customerId = typeof chargeObj.customer === "string" ? chargeObj.customer : chargeObj.customer.id;
      }
    }

    const card = (pm as Stripe.PaymentMethod | null)?.card;
    const pmId = (pm as Stripe.PaymentMethod | null)?.id;
    const email = (params.patientEmail || pi.metadata?.patient_email || pi.receipt_email || "")
      .toLowerCase()
      .trim();
    if (!pmId || !card || !email) return { ok: false, reason: "missing_card_or_email" as const };

    // The PM must be attached to a Customer to be chargeable off-session.
    if (!customerId) {
      const existing = await params.stripe.customers.list(
        { email, limit: 1 },
        { stripeAccount: params.accountId },
      );
      customerId =
        existing.data[0]?.id ??
        (await params.stripe.customers.create({ email }, { stripeAccount: params.accountId })).id;
    }
    if ((pm as Stripe.PaymentMethod).customer == null) {
      try {
        await params.stripe.paymentMethods.attach(
          pmId,
          { customer: customerId },
          { stripeAccount: params.accountId },
        );
      } catch (e) {
        console.warn("[card-on-file] attach failed", e);
      }
    }

    let profileId = params.profileId ?? null;
    if (!profileId && params.appointmentId) {
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select("profile_id")
        .eq("id", params.appointmentId)
        .maybeSingle();
      profileId = (appt as { profile_id?: string } | null)?.profile_id ?? null;
    }
    if (!profileId) return { ok: false, reason: "no_profile" as const };

    const patch = {
      stripe_customer_id: customerId,
      stripe_payment_method_id: pmId,
      card_brand: card.brand,
      card_last4: card.last4,
      card_exp_month: card.exp_month,
      card_exp_year: card.exp_year,
      card_saved_at: new Date().toISOString(),
      card_save_consent_at: new Date().toISOString(),
    };

    const { data: existingClient } = await supabaseAdmin
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", profileId)
      .ilike("email", email)
      .maybeSingle();

    if ((existingClient as { id?: string } | null)?.id) {
      await supabaseAdmin
        .from("clinic_clients")
        .update(patch as never)
        .eq("id", (existingClient as { id: string }).id);
    } else {
      await supabaseAdmin
        .from("clinic_clients")
        .insert({
          profile_id: profileId,
          email,
          full_name: params.patientName || email,
          ...patch,
        } as never);
    }
    return { ok: true as const, last4: card.last4 };
  } catch (e) {
    console.error("[card-on-file] capture failed", e);
    return { ok: false, reason: "error" as const };
  }
}
