import Stripe from "stripe";

export type StripePlatformSetupErrorCode =
  | "connect_not_enabled"
  | "invalid_secret_mode"
  | "missing_secret"
  | "stale_connect_account"
  | "stripe_error";

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
  const lowerMessage = message.toLowerCase();
  const stripeError = error as { code?: string; param?: string; raw?: { code?: string; param?: string } };
  const code = stripeError.code || stripeError.raw?.code;
  const param = stripeError.param || stripeError.raw?.param;

  if (message.includes("signed up for Connect") || message.includes("dashboard.stripe.com/connect")) {
    throw new StripePlatformSetupError(
      "Stripe Connect is not enabled on your platform account yet. Activate Connect in your Stripe dashboard.",
      "connect_not_enabled",
    );
  }
  if (lowerMessage.includes("managing losses") || lowerMessage.includes("platform-profile") || lowerMessage.includes("loss liability") || lowerMessage.includes("liability")) {
    throw new StripePlatformSetupError(
      "Your Stripe platform profile needs the 'loss liability' step completed. In Stripe: Connect → Settings → Platform profile → choose who is responsible for negative balances on connected accounts.",
      "connect_not_enabled",
    );
  }
  if (lowerMessage.includes("stripe_dashboard[type]=express") || lowerMessage.includes("negative balances")) {
    throw new StripePlatformSetupError(
      "Stripe Express onboarding needs platform responsibility enabled in your Stripe Connect settings.",
      "connect_not_enabled",
    );
  }
  if (
    code === "account_invalid" ||
    code === "resource_missing" ||
    param === "account" ||
    message.includes("No such account") ||
    message.includes("does not have access to account") ||
    lowerMessage.includes("live mode") && lowerMessage.includes("test mode") ||
    lowerMessage.includes("test mode") && lowerMessage.includes("live mode")
  ) {
    throw new StripePlatformSetupError(
      "This Stripe account was created under a different mode. We will create a fresh live connection.",
      "stale_connect_account",
    );
  }
  throw new StripePlatformSetupError(message, "stripe_error");
}

export function getStripeMode() {
  return process.env.STRIPE_MODE === "live" ? "live" : "sandbox";
}

function getStripeSecretKey() {
  const mode = getStripeMode();
  if (mode === "sandbox") {
    return (
      process.env.STRIPE_TEST_API_KEY ||
      process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_PLATFORM_SECRET_KEY
    );
  }
  return (
    process.env.STRIPE_LIVE_API_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_PLATFORM_SECRET_KEY
  );
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new StripePlatformSetupError("Stripe sandbox secret key is missing.", "missing_secret");
  }
  if (key.startsWith("pk_")) {
    throw new StripePlatformSetupError(
      "Stripe needs the secret key for server payments, not the publishable key.",
      "invalid_secret_mode",
    );
  }
  if (key.startsWith("rk_")) {
    throw new StripePlatformSetupError(
      "Stripe Connect onboarding needs your test secret key that starts with sk_test_. A restricted key will not create practitioner Connect accounts unless it has the required Connect account permissions.",
      "invalid_secret_mode",
    );
  }
  if (getStripeMode() === "sandbox" && !key.startsWith("sk_test_")) {
    throw new StripePlatformSetupError(
      "Sandbox mode needs your Stripe test secret key, which starts with sk_test_.",
      "invalid_secret_mode",
    );
  }
  if (getStripeMode() === "live" && !key.startsWith("sk_live_")) {
    throw new StripePlatformSetupError(
      "Live mode needs your Stripe live secret key, which starts with sk_live_.",
      "invalid_secret_mode",
    );
  }
  return new Stripe(key, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}

export function getStripeConnectClientId() {
  const id = process.env.STRIPE_CONNECT_CLIENT_ID?.trim();
  if (!id) {
    throw new StripePlatformSetupError(
      "Stripe Connect client ID is not configured. Add STRIPE_CONNECT_CLIENT_ID (starts with ca_...).",
      "missing_secret",
    );
  }
  if (!id.startsWith("ca_")) {
    const hint = id.startsWith("acct_")
      ? " You entered a connected account ID (acct_...). Use the platform Connect Client ID instead."
      : id.startsWith("pk_") || id.startsWith("sk_")
        ? " You entered a Stripe API key. Use the platform Connect Client ID instead."
        : "";
    throw new StripePlatformSetupError(
      `STRIPE_CONNECT_CLIENT_ID must be the Connect client ID from Stripe (starts with ca_).${hint}`,
      "invalid_secret_mode",
    );
  }
  return id;
}

export function buildStripeOAuthAuthorizeUrl(params: {
  state: string;
  redirectUri: string;
  email?: string;
}) {
  const clientId = getStripeConnectClientId();
  const url = new URL("https://connect.stripe.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "read_write");
  url.searchParams.set("state", params.state);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("stripe_user[country]", "GB");
  if (params.email) url.searchParams.set("stripe_user[email]", params.email);
  return url.toString();
}

export async function exchangeStripeOAuthCode(code: string) {
  const stripe = getStripe();
  try {
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });
    return response;
  } catch (error) {
    normaliseStripeError(error);
  }
}

export function getStripeSetupSummary() {
  const mode = getStripeMode();
  const key = getStripeSecretKey()?.trim();
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID?.trim();
  const redirectUri = "https://modobook.uk/api/public/stripe/oauth-callback";

  return {
    mode,
    hasSecretKey: !!key,
    secretKeyType: key?.startsWith("sk_test_")
      ? "test"
      : key?.startsWith("sk_live_")
        ? "live"
        : key?.startsWith("pk_")
          ? "publishable"
          : key?.startsWith("rk_")
            ? "restricted"
            : key
              ? "unknown"
              : "missing",
    hasConnectClientId: !!clientId,
    connectClientIdType: clientId?.startsWith("ca_") ? "connect" : clientId ? "invalid" : "missing",
    redirectUri,
  } as const;
}

export async function deauthorizeStripeAccount(accountId: string) {
  const stripe = getStripe();
  const clientId = getStripeConnectClientId();
  try {
    return await stripe.oauth.deauthorize({
      client_id: clientId,
      stripe_user_id: accountId,
    });
  } catch (error) {
    // If the practitioner already revoked from Stripe's side, treat as success.
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("not connected") || message.includes("does not have access")) {
      return { stripe_user_id: accountId };
    }
    normaliseStripeError(error);
  }
}


export async function getAccount(accountId: string) {
  const stripe = getStripe();
  try {
    return await stripe.accounts.retrieve(accountId);
  } catch (error) {
    normaliseStripeError(error);
  }
}

export async function ensureDailyPayoutSchedule(accountId: string) {
  const stripe = getStripe();
  try {
    const account = await stripe.accounts.retrieve(accountId);
    const interval = account.settings?.payouts?.schedule?.interval;
    if (interval === "daily") return { changed: false as const };
    await stripe.accounts.update(accountId, {
      settings: { payouts: { schedule: { interval: "daily" } } },
    });
    return { changed: true as const };
  } catch {
    // Non-fatal — payout schedule sync is best-effort.
    return { changed: false as const };
  }
}


export async function createCheckoutSession(params: {
  accountId: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  paymentMethodTypes?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
  metadata?: Record<string, string>;
  expiresInMinutes?: number;
  // When true, forces card-only and saves the resulting card as a reusable
  // PaymentMethod on a Stripe Customer for later off-session charges
  // (no-shows, late-cancel fees). Wallets (Apple/Google Pay) are excluded
  // because their tokens are not consistently reusable off-session.
  saveCardOnFile?: boolean;
}) {
  const stripe = getStripe();
  // Stripe requires expires_at to be at least 30 minutes ahead — used so
  // abandoned checkouts release the slot hold in a timely manner.
  const minutes = Math.max(30, params.expiresInMinutes ?? 30);
  const expiresAt = Math.floor(Date.now() / 1000) + minutes * 60;

  const create: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: params.saveCardOnFile
      ? ["card"]
      : (params.paymentMethodTypes ?? ["card"]),
    line_items: params.lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    metadata: params.metadata,
    expires_at: expiresAt,
  };

  if (params.saveCardOnFile) {
    // Force a Customer on the connected account so the PaymentMethod
    // returned from this Checkout is attached and reusable off-session.
    create.customer_creation = "always";
    create.payment_intent_data = {
      setup_future_usage: "off_session",
      metadata: params.metadata,
    };
    // Exclude wallets — Apple/Google Pay tokens are not reliably reusable.
    create.payment_method_options = {
      card: { request_three_d_secure: "automatic" },
    };
  }

  return stripe.checkout.sessions.create(create, { stripeAccount: params.accountId });
}

// Create a PaymentIntent for the save-card-on-file flow.
// We render an embedded Stripe Elements form on our own page so we can hide
// Apple Pay, Google Pay and Link (which Stripe hosted Checkout re-adds even
// when payment_method_types is ['card']). The returned client_secret drives
// the client-side Payment Element; on success the connected-account webhook
// fires `payment_intent.succeeded` and captures the card details onto the
// clinic_clients row so no-show / late-cancel fees can be charged later.
export async function createSaveCardPaymentIntent(params: {
  accountId: string;
  amountCents: number;
  currency?: string;
  customerEmail: string;
  customerName?: string | null;
  description: string;
  metadata?: Record<string, string>;
  saveForFutureUse?: boolean;
}) {
  const stripe = getStripe();
  const currency = params.currency ?? "gbp";

  // Reuse an existing Customer on the connected account when the patient has
  // already been captured, so the saved PaymentMethod stays associated with
  // the same clinic-client identity.
  let customerId: string | null = null;
  try {
    const existing = await stripe.customers.list(
      { email: params.customerEmail, limit: 1 },
      { stripeAccount: params.accountId },
    );
    customerId = existing.data[0]?.id ?? null;
  } catch {
    customerId = null;
  }
  if (!customerId) {
    const created = await stripe.customers.create(
      {
        email: params.customerEmail,
        name: params.customerName ?? undefined,
      },
      { stripeAccount: params.accountId },
    );
    customerId = created.id;
  }

  const pi = await stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency,
      customer: customerId,
      description: params.description,
      // Card-only. No wallets, no Link — those are hidden by the client-side
      // Payment Element options as well, but locking method types here means
      // Stripe rejects wallet confirmation attempts server-side too.
      payment_method_types: ["card"],
      // Explicitly suppress Link (the "fast checkout with Link" banner) —
      // Stripe's Payment Element re-injects it even when it's not in
      // payment_method_types unless we tell the intent to never display it.
      payment_method_options: {
        link: { display: "never" },
      } as unknown as Stripe.PaymentIntentCreateParams.PaymentMethodOptions,
      // Save the resulting PaymentMethod for later off-session charges.
      setup_future_usage: "off_session",
      metadata: {
        ...(params.metadata ?? {}),
        save_card_on_file: "1",
      },
      receipt_email: params.customerEmail,
    },
    { stripeAccount: params.accountId },
  );

  return {
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    customerId,
  };
}

// Retrieve a completed Checkout Session with the PI + PM expanded so we can
// read the saved card details (brand, last4, exp) after checkout.session.completed.
export async function retrieveCheckoutSessionWithPaymentMethod(
  accountId: string,
  sessionId: string,
) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(
    sessionId,
    { expand: ["payment_intent", "payment_intent.payment_method"] },
    { stripeAccount: accountId },
  );
}

// Charge a saved card on file off-session (no-show / late-cancel fees).
export async function chargeSavedCardOffSession(params: {
  accountId: string;
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  currency?: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  const stripe = getStripe();
  return stripe.paymentIntents.create(
    {
      amount: Math.round(params.amountCents),
      currency: (params.currency ?? "gbp").toLowerCase(),
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      off_session: true,
      confirm: true,
      description: params.description,
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
  surchargeCents?: number;
}) {
  const stripe = getStripe();
  const opts = { stripeAccount: params.accountId } as const;
  const currency = params.currency.toLowerCase();

  const product = await stripe.products.create(
    { name: params.description.slice(0, 250) || "Payment" },
    opts,
  );
  const price = await stripe.prices.create(
    { product: product.id, currency, unit_amount: params.amountCents },
    opts,
  );
  const lineItems: Stripe.PaymentLinkCreateParams.LineItem[] = [
    { price: price.id, quantity: 1 },
  ];

  // Add the practitioner's platform / processing fee as a visible second
  // line item so the patient sees the breakdown and pays the combined total.
  if (params.surchargeCents && params.surchargeCents > 0) {
    const feeProduct = await stripe.products.create(
      { name: "Platform fee" },
      opts,
    );
    const feePrice = await stripe.prices.create(
      { product: feeProduct.id, currency, unit_amount: Math.round(params.surchargeCents) },
      opts,
    );
    lineItems.push({ price: feePrice.id, quantity: 1 });
  }

  const link = await stripe.paymentLinks.create(
    { line_items: lineItems, metadata: params.metadata },
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

export async function getConnectBalance(accountId: string) {
  const stripe = getStripe();
  try {
    return await stripe.balance.retrieve({}, { stripeAccount: accountId });
  } catch (error) {
    normaliseStripeError(error);
  }
}

export async function listConnectPayouts(accountId: string, limit = 10) {
  const stripe = getStripe();
  try {
    return await stripe.payouts.list({ limit }, { stripeAccount: accountId });
  } catch (error) {
    normaliseStripeError(error);
  }
}



