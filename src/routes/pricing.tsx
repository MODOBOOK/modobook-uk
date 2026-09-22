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
          "MODO is £29.99 a month with your first month free and no booking fees. Extra team members £9.99, and extra locations are free for a limited time.",
      },
      { property: "og:title", content: "MODO Pricing" },
      {
        property: "og:description",
        content:
          "£29.99/month, first month free, 0% booking fees. +£9.99 per extra team member, extra locations free for a limited time.",
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
      "Built-in AI for descriptions, forms & aftercare",
      "Marketing automations & email templates",
      "Prescriber hub included",
    ],
    highlight: true,
  },
  {
    name: "Extra team member",
    tag: "Add-on",
    now: "£9.99",
    was: "£14.99",
    unit: "per member / month",
    blurb: "Give each practitioner their own calendar, login and clinical record permissions.",
    perks: [
      "Individual practitioner calendar",
      "Personal login & permissions",
      "Own patient list & notes",
      "1 practitioner included in the main subscription",
    ],
  },
  {
    name: "Extra location",
    tag: "Limited-time offer",
    now: "Free",
    was: "£4.99",
    unit: "per location / month",
    blurb:
      "Run multiple rooms, clinics or venues from one MODO account, each with their own hours and bookings.",
    perks: [
      "Separate opening hours & availability",
      "Location-specific booking links",
      "Shared patient records across sites",
      "1 location included in the main subscription",
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
          blurb="One flat subscription for your clinic, with your first month free. Add team members and extra locations only if you need them — and keep 100% of what your patients pay you."
        >
          <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-[color:var(--ink-soft)]">
            <span className="font-semibold text-[color:var(--ink)]">
              First month free · No card details required.
            </span>{" "}
            Open to every UK aesthetics practitioner today. Cancel anytime.
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
                        ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--paper)]"
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
                    <h2
                      className={`mt-4 font-display text-2xl ${
                        t.highlight ? "text-[color:var(--paper)]" : "text-[color:var(--ink)]"
                      }`}
                    >
                      {t.name}
                    </h2>
                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="font-display text-4xl">{t.now}</span>
                      <span
                        className={`text-sm line-through ${
                          t.highlight
                            ? "text-[color:var(--paper)]/45"
                            : "text-[color:var(--ink-soft)]/60"
                        }`}
                      >
                        {t.was}
                      </span>
                    </div>
                    <div
                      className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${
                        t.highlight ? "text-[color:var(--paper)]/60" : "text-[color:var(--ink-soft)]"
                      }`}
                    >
                      {t.unit}
                    </div>
                    <p
                      className={`mt-5 text-sm leading-relaxed ${
                        t.highlight ? "text-[color:var(--paper)]/75" : "text-[color:var(--ink-soft)]"
                      }`}
                    >
                      {t.blurb}
                    </p>
                    <ul className="mt-6 flex-1 space-y-3">
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
                    <Link
                      to="/auth"
                      className={`mt-8 inline-flex h-13 items-center justify-center px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                        t.highlight
                          ? "bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--taupe)]"
                          : "border border-[color:var(--ink)] text-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)]"
                      }`}
                    >
                      Create your account
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <div className="mt-10 border border-[color:var(--hairline)] bg-[color:var(--paper)] p-8 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                  What's included
                </div>
                <p className="mt-3">
                  All prices are in GBP and exclude VAT where applicable. Your discounted rate stays
                  in place for as long as your subscription remains active. Cancel any time. No
                  booking fees are ever charged on top of your subscription — your revenue is yours.
                </p>
              </div>
            </Reveal>
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
