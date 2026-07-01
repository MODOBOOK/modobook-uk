import Stripe from "stripe";

export type StripePlatformSetupErrorCode = "connect_not_enabled" | "missing_secret" | "stripe_error";

export class StripePlatformSetupError extends Error {
  code: StripePlatformSetupErrorCode;

  constructor(message: string, code: StripePlatformSetupErrorCode = "stripe_error") {
    super(message);
    this.name = "StripePlatformSetupError";
    this.code = code;
  }
}

function normaliseStripeError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Stripe could not start onboarding.";
  if (message.includes("signed up for Connect") || message.includes("dashboard.stripe.com/connect")) {
    throw new StripePlatformSetupError(
      "Stripe Connect is not enabled on this sandbox platform account yet.",
      "connect_not_enabled",
    );
  }
  throw new StripePlatformSetupError(message, "stripe_error");
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_PLATFORM_SECRET_KEY;
  if (!key) {
    throw new StripePlatformSetupError("Stripe sandbox secret key is missing.", "missing_secret");
  }
  return new Stripe(key, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}

export async function createConnectAccount(email: string) {
  const stripe = getStripe();
  try {
    return await stripe.accounts.create({
      type: "express",
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: { schedule: { interval: "manual" } },
      },
    });
  } catch (error) {
    normaliseStripeError(error);
  }
}

export async function createConnectOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string) {
  const stripe = getStripe();
  try {
    return await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
  } catch (error) {
    normaliseStripeError(error);
  }
}

export async function getAccount(accountId: string) {
  const stripe = getStripe();
  return stripe.accounts.retrieve(accountId);
}

export async function createCheckoutSession(params: {
  accountId: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  paymentMethodTypes?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
  metadata?: Record<string, string>;
}) {
  const stripe = getStripe();
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: params.paymentMethodTypes ?? ["card"],
      line_items: params.lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: params.metadata,
    },
    { stripeAccount: params.accountId },
  );
}

export async function createRefund(paymentIntentId: string, accountId: string, amount?: number) {
  const stripe = getStripe();
  const params: Stripe.RefundCreateParams = { payment_intent: paymentIntentId };
  if (amount !== undefined) params.amount = Math.round(amount * 100);
  return stripe.refunds.create(params, { stripeAccount: accountId });
}

export async function createConnectedPaymentLink(params: {
  accountId: string;
  amountCents: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  const stripe = getStripe();
  const opts = { stripeAccount: params.accountId } as const;
  const product = await stripe.products.create(
    { name: params.description.slice(0, 250) || "Payment" },
    opts,
  );
  const price = await stripe.prices.create(
    {
      product: product.id,
      currency: params.currency.toLowerCase(),
      unit_amount: params.amountCents,
    },
    opts,
  );
  const link = await stripe.paymentLinks.create(
    {
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: params.metadata,
    },
    opts,
  );
  return { id: link.id, url: link.url };
}

export async function retrievePaymentLink(accountId: string, id: string) {
  const stripe = getStripe();
  return stripe.paymentLinks.retrieve(id, {}, { stripeAccount: accountId });
}


export async function deactivatePaymentLink(accountId: string, id: string) {
  const stripe = getStripe();
  return stripe.paymentLinks.update(id, { active: false }, { stripeAccount: accountId });
}


