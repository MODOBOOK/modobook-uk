import { createFileRoute, useSearch, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { getPractitionerBio } from "@/lib/practitioner-public.functions";

// Embedded Payment Element flow used only when the practitioner has
// "Save card on file" enabled. The booking server function returned an
// EmbeddedPayment object into sessionStorage; we load it here and render a
// Stripe Payment Element with Apple Pay, Google Pay, and Link explicitly
// suppressed so the patient must enter card details manually — the resulting
// PaymentMethod is then reusable for later off-session charges (no-show /
// late-cancel fees).

type EmbeddedPayment = {
  clientSecret: string;
  paymentIntentId: string;
  publishableKey: string;
  connectedAccountId: string;
  amountCents: number;
  currency: string;
  returnUrl: string;
};

type Search = { pi?: string };

export const Route = createFileRoute("/m/$slug/pay")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    pi: typeof search.pi === "string" ? search.pi : undefined,
  }),
  ssr: false,
  loader: async ({ params }) => {
    const { theme } = await getPractitionerBio({ data: { slug: params.slug } });
    return { theme };
  },
  component: PayPage,
});

function PayPage() {
  const { slug } = useParams({ from: "/m/$slug/pay" });
  const { pi } = useSearch({ from: "/m/$slug/pay" });
  const [details, setDetails] = useState<EmbeddedPayment | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pi) {
      setError("Missing payment reference.");
      return;
    }
    try {
      const raw = sessionStorage.getItem(`modo:pay:${pi}`);
      if (!raw) {
        setError("This payment session has expired. Please book again.");
        return;
      }
      const parsed = JSON.parse(raw) as EmbeddedPayment;
      setDetails(parsed);
    } catch {
      setError("Could not load payment details.");
    }
  }, [pi]);

  useEffect(() => {
    if (!details) return;
    let cancelled = false;
    loadStripe(details.publishableKey, { stripeAccount: details.connectedAccountId })
      .then((s) => {
        if (!cancelled) setStripe(s);
      })
      .catch(() => {
        if (!cancelled) setError("Could not connect to Stripe.");
      });
    return () => {
      cancelled = true;
    };
  }, [details]);

  const options = useMemo(() => {
    if (!details) return null;
    return {
      clientSecret: details.clientSecret,
      appearance: { theme: "stripe" as const },
    };
  }, [details]);

  const amountLabel = details
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: details.currency.toUpperCase(),
      }).format(details.amountCents / 100)
    : "";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-semibold">Complete your payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your card details below. Your card will also be securely saved
          for any future no-show or late-cancellation fees, as per this
          clinic's booking policy.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <a href={`/m/${slug}`}>Back to booking</a>
              </Button>
            </div>
          </div>
        )}

        {!error && details && stripe && options && (
          <div className="mt-6 rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-xl font-semibold">{amountLabel}</span>
            </div>
            <Elements stripe={stripe} options={options}>
              <CardForm returnUrl={details.returnUrl} />
            </Elements>
          </div>
        )}

        {!error && (!details || !stripe) && (
          <p className="mt-6 text-sm text-muted-foreground">Loading secure payment form…</p>
        )}
      </div>
    </main>
  );
}

function CardForm({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMessage(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    // If confirmPayment returns without redirecting, an error occurred.
    if (error) {
      setMessage(error.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
          // Hide Apple Pay, Google Pay and Link explicitly — the practitioner
          // opted into card-on-file capture, and wallet / Link tokens are not
          // consistently reusable off-session.
          wallets: { applePay: "never", googlePay: "never" },
          fields: { billingDetails: { address: "auto" } },
          paymentMethodOrder: ["card"],
        }}
      />
      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? "Processing…" : "Pay & save card"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Your card is stored securely by Stripe. It will only be charged
        automatically for balances your clinic has authorised (e.g. no-show
        fees).
      </p>
    </form>
  );
}
