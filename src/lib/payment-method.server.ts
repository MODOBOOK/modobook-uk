import type Stripe from "stripe";

/**
 * Map a Stripe payment method type to the short label we store on
 * appointments/payments so the diary can show how a client paid.
 */
export function labelFromStripeType(type?: string | null): string {
  switch (type) {
    case "klarna":
      return "klarna";
    case "afterpay_clearpay":
      return "clearpay";
    case "card":
      return "card";
    case "link":
      return "stripe_link";
    default:
      return type || "stripe_link";
  }
}

/**
 * Look up how a PaymentIntent was actually paid (card, Klarna, Clearpay…).
 * Falls back to "stripe_link" when the method cannot be read.
 */
export async function paymentMethodLabelForIntent(
  stripe: Stripe,
  accountId: string | null,
  intentId: string | null,
): Promise<string> {
  if (!intentId) return "stripe_link";
  try {
    const pi = await stripe.paymentIntents.retrieve(
      intentId,
      { expand: ["payment_method"] },
      accountId ? { stripeAccount: accountId } : undefined,
    );
    const pm = pi.payment_method as Stripe.PaymentMethod | null;
    return labelFromStripeType(pm?.type);
  } catch (e) {
    console.error("[payment-method] lookup failed", e);
    return "stripe_link";
  }
}
