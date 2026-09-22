import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { captureReferralFromUrl } from "@/lib/referral-capture";

import { SiteHeader, SiteFooter } from "./index";
import {
  MarketingPage,
  PageHero,
  Reveal,
  CtaBand,
} from "@/components/marketing-kit";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "MODO Pricing | Simple monthly pricing for aesthetics clinics" },
      {
        name: "description",
        content:
          "MODO Solo is £39.99 a month with your first month free. MODO Collective £59.99, extra practitioners £9.99. No booking fees — your revenue stays yours.",
      },
      { property: "og:title", content: "MODO Pricing" },
      {
        property: "og:description",
        content:
          "MODO Solo £39.99/month, MODO Collective £59.99/month, +£9.99 per additional practitioner. First month free, no booking fees.",
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
  unit: string;
  perks: string[];
  highlight?: boolean;
};

const tiers: Tier[] = [
  {
    name: "MODO Solo",
    tag: "For independent practitioners",
    now: "£39.99",
    unit: "per month",
    perks: [
      "Unlimited locations",
      "1 practitioner included",
      "SMS appointment reminders",
      "Branded booking page",
      "Consultations, consent & clinical records",
      "Payments, deposits & cancellation rules",
      "Prescriber hub",
    ],
    highlight: true,
  },
  {
    name: "MODO Collective",
    tag: "For clinic owners",
    now: "£59.99",
    unit: "per month",
    perks: [
      "Everything in MODO Solo",
      "4 practitioners included",
      "Compliance suite for clinical governance",
      "Room rental & diary management",
      "Associate onboarding & permissions",
      "Training link for your training academy",
    ],
  },
  {
    name: "Additional Practitioner",
    tag: "Add-on",
    now: "£9.99",
    unit: "per practitioner / month",
    perks: [
      "Individual calendar and login",
      "Dedicated patient list and records",
      "1 practitioner included",
    ],
  },
];

function PricingPage() {
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    setRef(captureReferralFromUrl());
  }, []);

  return (
    <MarketingPage>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Pricing"
          title="Simple pricing,"
          accent="no surprises."
          blurb="One straightforward subscription for your clinic, with your first month free. Start with what you need today, then add team members as your business grows. And MODO never takes a percentage of your treatment revenue."
        >
          <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-[color:var(--ink-soft)]">
            <span className="font-semibold text-[color:var(--ink)]">
              First month free · Cancel anytime.
            </span>
          </p>
        </PageHero>

        {ref && (
          <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="border border-[color:var(--hairline)] bg-[color:var(--card)] px-5 py-4 text-sm text-[color:var(--ink-soft)]">
              Referral code <strong className="text-[color:var(--ink)]">{ref}</strong> saved — it'll
              be applied automatically on your Plan &amp; billing page when you sign up. That's 25%
              off your first 3 months.
            </div>
          </div>
        )}

        <section
          className="border-b border-[color:var(--hairline)]"
          style={{ background: "var(--grad-band)" }}
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {tiers.map((t, i) => (
                <Reveal key={t.name} delay={i * 90}>
                  <div
                    className={`lift flex h-full flex-col border p-8 ${
                      t.highlight
                        ? "border-[color:var(--ink-soft)] bg-[color:var(--ink-soft)] text-[color:var(--paper)]"
                        : "border-[color:var(--hairline)] bg-[color:var(--paper)]"
                    }`}
                  >
                    <div
                      className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                        t.highlight ? "text-[color:var(--taupe)]" : "text-[color:var(--accent)]"
                      }`}
                    >
                      {t.tag}
                    </div>
                    <h3
                      className={`mt-4 font-display text-2xl ${
                        t.highlight ? "text-[color:var(--paper)]" : "text-[color:var(--ink)]"
                      }`}
                    >
                      {t.name}
                    </h3>
                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="font-display text-4xl">{t.now}</span>
                    </div>
                    <div
                      className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${
                        t.highlight ? "text-[color:var(--paper)]/60" : "text-[color:var(--ink-soft)]"
                      }`}
                    >
                      {t.unit} — inc VAT
                    </div>
                    <ul className="mt-7 space-y-3">
                      {t.perks.map((p) => (
                        <li
                          key={p}
                          className={`flex items-start gap-3 text-sm ${
                            t.highlight
                              ? "text-[color:var(--paper)]/75"
                              : "text-[color:var(--ink-soft)]"
                          }`}
                        >
                          <span className="mt-2 h-px w-4 shrink-0 bg-[color:var(--taupe)]" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-8">
                      <Link
                        to="/auth"
                        className={`block w-full px-5 py-3 text-center text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                          t.highlight
                            ? "bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--secondary)]"
                            : "bg-[color:var(--ink-soft)] text-[color:var(--paper)] hover:bg-[color:var(--accent)]"
                        }`}
                      >
                        Start your free 30 day trial
                      </Link>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <p className="mt-12 text-center text-sm font-bold text-[color:var(--ink)]">
              Prices in GBP · Cancel anytime
            </p>
            <p className="mt-2 text-center text-sm text-[color:var(--ink-soft)]">
              Your paid subscription begins automatically at the end of your 30-day free trial unless cancelled.
            </p>

          </div>
        </section>


        <CtaBand
          title="Start your first month free."
          blurb="Create your account, set up your clinic and take your first booking today. No card details, no booking fees, cancel anytime."
        />
      </main>
      <SiteFooter />
    </MarketingPage>
  );
}
