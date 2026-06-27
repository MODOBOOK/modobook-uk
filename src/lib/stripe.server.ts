import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_PLATFORM_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_PLATFORM_SECRET_KEY");
  return new Stripe(key, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}

export async function createConnectAccount(email: string) {
  const stripe = getStripe();
  return stripe.accounts.create({
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
}

export async function createConnectOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string) {
  const stripe = getStripe();
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
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
  return stripe.paymentLinks.retrieve(id, { stripeAccount: accountId });
}

export async function deactivatePaymentLink(accountId: string, id: string) {
  const stripe = getStripe();
  return stripe.paymentLinks.update(id, { active: false }, { stripeAccount: accountId });
}


