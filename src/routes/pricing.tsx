import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { captureReferralFromUrl } from "@/lib/referral-capture";

import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "./index";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "MODO Pricing | Simple monthly pricing for aesthetics clinics" },
      {
        name: "description",
        content:
          "MODO is £39.99/month — £29.99/month for founding clinics on our launch list. Add team members from £9.99 and additional locations from £4.99.",
      },
      { property: "og:title", content: "MODO Pricing" },
      {
        property: "og:description",
        content:
          "Founding-clinic pricing: £29.99/month, +£9.99 per extra team member, extra locations free for a limited time. No booking fees.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/pricing" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/pricing" }],
  }),
  component: PricingPage,
});

type Tier = {
  name: string;
  tag: string;
  now: string;
  was: string;
  unit: string;
  blurb: string;
  perks: string[];
  cta: string;
  highlight?: boolean;
};

const tiers: Tier[] = [
  {
    name: "MODO Clinic",
    tag: "Core subscription",
    now: "£29.99",
    was: "£39.99",
    unit: "per month",
    blurb:
      "Everything you need to run an aesthetics clinic — bookings, medical records, consent, face mapping, payments and the prescriber hub.",
    perks: [
      "First month free — no card required",
      "Unlimited patients & appointments",
      "0% booking fees — keep 100% of your revenue",
      "Full clinical records, consent & face mapping",
      "AI photo uploads, face mapping & consultation notes",
      "Marketing automations & email templates",
      "Prescriber hub included",
    ],

    cta: "Create your account",
    highlight: true,
  },
  {
    name: "Extra team member",
    tag: "Add-on",
    now: "£9.99",
    was: "£14.99",
    unit: "per member / month",
    blurb:
      "Give each practitioner their own calendar, login and clinical record permissions.",
    perks: [
      "Individual practitioner calendar",
      "Personal login & permissions",
      "Own patient list & notes",
      "Included in main subscription: 1 practitioner",
    ],
    cta: "Create your account",
  },
  {
    name: "Extra location",
    tag: "Limited-time offer",
    now: "FREE",
    was: "£4.99",
    unit: "per location / month — free for a limited time",
    blurb:
      "Run multiple rooms, clinics or venues from one MODO account with their own hours and bookings.",
    perks: [
      "Separate opening hours & availability",
      "Location-specific booking links",
      "Shared patient records across sites",
      "Included in main subscription: 1 location",
    ],
    cta: "Create your account",
  },
];

function PricingPage() {
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    setRef(captureReferralFromUrl());
  }, []);
  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />
      <main>
        {ref && (
          <div className="mx-auto mt-4 max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--ink)]/[0.04] px-4 py-3 text-sm">
              Referral code <strong>{ref}</strong> saved — it'll be applied automatically on your
              Plan &amp; billing page when you sign up. That's 25% off your first 3 months.
            </div>
          </div>
        )}

        <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-16 pb-8 text-center lg:px-8 lg:pt-24">
          <div className="eyebrow">§ Pricing</div>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Simple pricing.
            <br />
            <span className="text-[color:var(--ink-soft)]">Founding-clinic rates.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[color:var(--ink-soft)]">
            One flat subscription for your clinic. Add team members and extra locations only if
            you need them. Founding clinics on our launch list lock in the discounted rates
            below for life.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
              First month free · No card required
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hairline)] bg-white px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink)]">
              Launching in the next few weeks
            </div>
          </div>

        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`flex flex-col rounded-3xl border p-7 ${
                  t.highlight
                    ? "border-[color:var(--ink)] bg-white shadow-md"
                    : "border-[color:var(--hairline)] bg-white/60"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                  {t.tag}
                </div>
                <h2 className="mt-2 text-xl font-semibold">{t.name}</h2>
                <div className="mt-5 flex items-end gap-2">
                  <div className="text-4xl font-bold tracking-tight">{t.now}</div>
                  <div className="pb-1 text-sm text-[color:var(--ink-soft)] line-through">
                    {t.was}
                  </div>
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
                  {t.unit}
                </div>
                <p className="mt-4 text-sm text-[color:var(--ink-soft)]">{t.blurb}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  <Link to="/auth" className="block">
                    <span
                      className={`inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-colors ${
                        t.highlight
                          ? "bg-[color:var(--ink)] text-white hover:bg-[color:var(--ink)]/90"
                          : "border border-[color:var(--hairline)] bg-white text-[color:var(--ink)] hover:bg-[color:var(--muted)]"
                      }`}
                    >
                      {t.cta} <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 tile p-6 text-sm text-[color:var(--ink-soft)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              What's included
            </div>
            <p className="mt-2">
              All prices are in GBP and exclude VAT where applicable. Founding-clinic pricing is
              locked in as long as your subscription remains active. Cancel any time. No booking
              fees are ever charged on top of your subscription — your revenue is yours.
            </p>
          </div>
        </section>

        <section className="border-t border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16 text-center lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Lock in founding-clinic pricing
            </h2>
            <p className="mt-3 text-[color:var(--ink-soft)]">
              MODO is rolling out over the next few weeks. Create your account and keep the
              discounted rates above for the life of your account.
            </p>
            <Link to="/auth" className="mt-6 inline-block">
              <span className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--ink)] px-8 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90">
                Create your account <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
