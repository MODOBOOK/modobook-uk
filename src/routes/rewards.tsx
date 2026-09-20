import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "./index";
import {
  MarketingPage,
  PageHero,
  SectionHead,
  HairlineGrid,
  GridCard,
  StepRow,
  Reveal,
  CtaBand,
  SolidLink,
  OutlineLink,
} from "@/components/marketing-kit";

import { Share2, Coins, Trophy, Sliders, Wallet, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards & Referrals for Practitioners | MODO" },
      {
        name: "description",
        content:
          "Turn on referrals, loyalty points and reward tiers in your MODO clinic. Grow retention and word-of-mouth with a programme you fully control.",
      },
      { property: "og:title", content: "Rewards & Referrals for Practitioners | MODO" },
      {
        property: "og:description",
        content:
          "Design your own referral offers, loyalty points and reward tiers — MODO handles the tracking, payouts and reporting for you.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/rewards" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/rewards" }],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  return (
    <MarketingPage>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Rewards & referrals"
          title="Your own loyalty programme,"
          accent="without the spreadsheets."
          blurb="Turn rewards on in a couple of clicks. You set the offers, the values and the rules — MODO tracks referrals, awards points, redeems credit and shows you what's working."
        >
          <div className="mt-11 flex flex-col justify-center gap-3 sm:flex-row">
            <SolidLink to="/auth">Open my dashboard</SolidLink>
            <OutlineLink to="/features">See all features</OutlineLink>
          </div>
        </PageHero>

        {/* Why it matters */}
        <section
          className="border-b border-[color:var(--hairline)]"
          style={{ background: "var(--grad-band)" }}
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <SectionHead
              eyebrow="Why practitioners run rewards"
              title="Retention and referrals, on autopilot."
              blurb="A returning patient is worth far more than a first-time visitor — and a referred patient books faster, trusts you sooner and stays longer."
            />
            <div className="grid gap-10 sm:grid-cols-3">
              {[
                { k: "Rebooking", v: "Loyalty members return more often than one-off bookers." },
                { k: "Low cost", v: "Referrals reward only when a real appointment completes." },
                { k: "Yours", v: "You choose the offer, the value and the rules — always optional." },
              ].map((s, i) => (
                <Reveal key={s.k} delay={i * 90}>
                  <div className="group">
                    <div className="font-display text-3xl text-[color:var(--ink)] sm:text-4xl">
                      {s.k}
                    </div>
                    <div className="mt-3 h-px w-8 bg-[color:var(--taupe)] transition-all duration-500 group-hover:w-16" />
                    <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">{s.v}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* What you can run */}
        <section id="how-it-works" className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHead
              eyebrow="Set up in minutes"
              title="Design the programme, MODO runs it."
              blurb="Everything lives in Dashboard → Rewards. Switch each piece on independently."
            />
            <HairlineGrid cols={2}>
              <GridCard icon={Share2} title="Referral offers" desc="Set the reward for the referrer and the friend independently — £ off, % off, credit or points. Every patient gets their own code automatically." />
              <GridCard icon={Coins} title="Loyalty points" desc="Points per £ spent, per booking, or per treatment category. Points show in each patient's rewards tab and convert to credit at the rate you set." />
              <GridCard icon={Trophy} title="Reward tiers" desc="Publish a catalogue — 500 points for a free add-on, 1,000 for an upgrade. Patients redeem the moment they hit the threshold." />
              <GridCard icon={Sliders} title="Rules that fit your clinic" desc="Stacking with promos, minimum spend, first-appointment-only, category exclusions and expiry — all optional, all controlled by you." />
              <GridCard icon={Wallet} title="Automatic payouts" desc="Referral rewards post the moment your patient's first paid appointment finishes. No forms, no chasing, no manual credits." />
              <GridCard icon={BarChart3} title="Analytics that matter" desc="See who's referring, which offers convert, redemption rates and how much revenue the programme is actually generating." />
            </HairlineGrid>
          </div>
        </section>

        {/* Steps */}
        <section
          className="border-b border-[color:var(--hairline)]"
          style={{ background: "var(--grad-band)" }}
        >
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <SectionHead eyebrow="Get live in five minutes" title="Three steps to launch." />
            <StepRow n={1} title="Pick your offers" desc="Choose whether to run referrals, loyalty, tiers — or all three. Set the values in pounds or points." />
            <StepRow n={2} title="Publish to your page" desc="Switch the public rewards banner on your MODO booking page so new patients see the incentive." />
            <StepRow n={3} title="Watch it work" desc="Track sign-ups, redemptions and revenue from the Rewards analytics tab. Change the values any time." />
            <Reveal>
              <p className="mt-8 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                Rewards are optional — pause the programme, change the values or hide it from your
                public page without affecting past bookings or existing balances.
              </p>
            </Reveal>
          </div>
        </section>

        <CtaBand
          title="Ready to grow the programme?"
          blurb="Sign in to your MODO dashboard and open Rewards — you'll be live before your next appointment."
        />
      </main>
      <SiteFooter />
    </MarketingPage>
  );
}
