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
  const { theme } = Route.useLoaderData();
  const [details, setDetails] = useState<EmbeddedPayment | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const brand = theme?.primary_color || "#111827";
  const accent = theme?.accent_color || brand;
  const cardBg = theme?.menu_card_bg || "#ffffff";
  const cardBorder = theme?.menu_card_border_color || "rgba(0,0,0,0.1)";
  const textColor = theme?.text_color || "inherit";
  const headingFont = theme?.heading_font || "inherit";

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

  // Release the slot immediately if the patient abandons the page before
  // confirming payment. sendBeacon survives tab close / navigation and posts
  // to our public /release endpoint, which cancels the PI on the connected
  // account and cancels the pending appointments so availability re-opens.
  useEffect(() => {
    if (!details || confirmed) return;
    const release = () => {
      try {
        const payload = JSON.stringify({
          paymentIntentId: details.paymentIntentId,
          accountId: details.connectedAccountId,
        });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/public/booking/release", blob);
        // Clear the sessionStorage entry so a re-open of /pay doesn't retry
        // the same expired PI.
        try {
          sessionStorage.removeItem(`modo:pay:${details.paymentIntentId}`);
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    };
    const onPageHide = () => release();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") release();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [details, confirmed]);


  const options = useMemo(() => {
    if (!details) return null;
    return {
      clientSecret: details.clientSecret,
      appearance: {
        theme: "stripe" as const,
        variables: {
          colorPrimary: brand,
          colorBackground: cardBg,
          colorText: textColor === "inherit" ? "#0f172a" : textColor,
          fontFamily: theme?.body_font || "system-ui, sans-serif",
          borderRadius: "8px",
        },
      },
    };
  }, [details, brand, cardBg, textColor, theme?.body_font]);

  const amountLabel = details
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: details.currency.toUpperCase(),
      }).format(details.amountCents / 100)
    : "";

  return (
    <main className="min-h-screen" style={{ color: textColor }}>
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: headingFont, color: textColor }}>
          Complete your payment
        </h1>
        <p className="mt-1 text-sm opacity-75">
          Your card will be securely saved as per this clinic's booking policy.
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
          <div
            className="mt-6 rounded-xl border p-4 shadow-sm"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-sm opacity-75">Amount</span>
              <span className="text-xl font-semibold">{amountLabel}</span>
            </div>
            <Elements stripe={stripe} options={options}>
              <CardForm returnUrl={details.returnUrl} brand={brand} accent={accent} />
            </Elements>
          </div>
        )}

        {!error && (!details || !stripe) && (
          <p className="mt-6 text-sm opacity-75">Loading secure payment form…</p>
        )}
      </div>
    </main>
  );
}

function CardForm({
  returnUrl,
  brand,
  accent,
}: {
  returnUrl: string;
  brand: string;
  accent: string;
}) {
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
      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full"
        style={{ backgroundColor: brand, color: "#ffffff", borderColor: accent }}
      >
        {submitting ? "Processing…" : "Pay now"}
      </Button>
    </form>
  );
}
