import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter, IconTile } from "./index";
import tabletBooking from "@/assets/modo-tablet-booking.png.asset.json";

import {
  Gift, Sparkles, Users, Share2, Coins, Trophy, ArrowRight,
  Settings2, BarChart3, Wallet, HeartHandshake, Target, Sliders,
} from "lucide-react";

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
    <div className="modo-marketing flex min-h-screen flex-col bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[color:var(--hairline)] bg-[color:var(--paper)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 py-14 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/25 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                <Gift className="h-3.5 w-3.5" /> Built for practitioners
              </div>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Your own referral & loyalty programme — without the spreadsheets.
              </h1>
              <p className="mt-5 max-w-lg text-base text-[color:var(--ink-soft)] sm:text-lg">
                Turn on rewards in a couple of clicks. You set the offers, the values and the rules —
                MODO tracks referrals, awards points, redeems credit and shows you what's working.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full rounded-full bg-[color:var(--ink)] px-8 text-white hover:bg-[color:var(--ink)]/90 sm:w-auto">
                    Open my dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#how-it-works" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full rounded-full border-[color:var(--hairline)] bg-white px-8 sm:w-auto">
                    See how it works
                  </Button>
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <IconTile icon={Share2} label="Referrals" />
                <IconTile icon={Coins} label="Loyalty points" />
                <IconTile icon={Trophy} label="Reward tiers" />
                <IconTile icon={BarChart3} label="Full analytics" />
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)]">
              <img src={tabletBooking.url} alt="MODO rewards on a practitioner's dashboard" className="aspect-[4/5] w-full object-cover" loading="lazy" />
            </div>
          </div>
        </section>

        {/* Why it matters */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                <Target className="h-3.5 w-3.5" /> Why practitioners run rewards
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Retention and referrals, on autopilot</h2>
              <p className="mt-3 text-muted-foreground">
                A returning patient is worth far more than a first-time visitor — and a referred patient books
                faster, trusts you sooner and stays longer. Rewards give you a repeatable way to grow both.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
              <StatCard n="3×" label="More likely to rebook" text="Patients enrolled in a loyalty programme return significantly more often than one-off bookers." />
              <StatCard n="↓ CAC" label="Cheaper than ads" text="Referrals are your lowest-cost, highest-trust channel. Pay only when a real appointment completes." />
              <StatCard n="100%" label="Yours to control" text="You choose the offer, the value, the rules and whether it shows on your public page." />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — practitioner side */}
        <section id="how-it-works" className="border-b bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
                <Settings2 className="h-3.5 w-3.5" /> Set-up in minutes
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Design the programme, MODO runs it</h2>
              <p className="mt-3 text-muted-foreground">
                Everything lives in <strong>Dashboard → Rewards</strong>. Toggle each piece on independently.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
              <FeatureCard
                icon={Share2}
                title="Referral offers"
                text="Set the reward for the referrer and the friend independently — £ off, % off, credit or points. Every patient gets their own 6-char code automatically."
              />
              <FeatureCard
                icon={Coins}
                title="Loyalty points"
                text="Choose points per £ spent, per booking, or per treatment category. Points show in each patient's rewards tab and convert to credit at the rate you set."
              />
              <FeatureCard
                icon={Trophy}
                title="Reward tiers"
                text="Publish a catalogue — e.g. 500 pts = a free add-on, 1,000 pts = an upgrade. Patients redeem the moment they hit the threshold."
              />
              <FeatureCard
                icon={Sliders}
                title="Rules that fit your clinic"
                text="Stacking with promos, minimum spend, first-appointment-only, category exclusions and expiry — all optional, all controlled by you."
              />
              <FeatureCard
                icon={Wallet}
                title="Automatic payouts"
                text="Referral rewards post the moment your patient's first paid appointment finishes. No forms, no chasing, no manual credits."
              />
              <FeatureCard
                icon={BarChart3}
                title="Analytics that matter"
                text="See who's referring, which offers convert, redemption rates and how much revenue the programme is actually generating."
              />
            </div>
          </div>
        </section>

        {/* Setup steps */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" /> Get live in 5 minutes
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Three steps to launch</h2>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
              <StepCard n={1} icon={Settings2} title="Pick your offers" text="Choose whether to run referrals, loyalty, tiers — or all three. Set the values in £ or points." />
              <StepCard n={2} icon={Users} title="Publish to your page" text="Toggle the public rewards banner on your MODO booking page so new patients see the incentive." />
              <StepCard n={3} icon={BarChart3} title="Watch it work" text="Track sign-ups, redemptions and revenue from the Rewards analytics tab. Tweak values anytime." />
            </div>

            <div className="mx-auto mt-10 max-w-3xl">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <HeartHandshake className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">Rewards are optional — turn them off any time.</p>
                    <p className="text-sm text-muted-foreground">
                      Pause the programme, change the values or hide it from your public page without affecting past bookings or existing balances.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-b from-background to-primary/10">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8 lg:py-20">
            <h2 className="font-serif text-3xl sm:text-4xl">Ready to grow the programme?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Sign in to your MODO dashboard and open Rewards — you'll be live before your next appointment.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg">Open my dashboard <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
              <Link to="/faq">
                <Button size="lg" variant="outline">Read the FAQ</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function StepCard({
  n, icon: Icon, title, text,
}: { n: number; icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {n}
          </div>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="pt-2 text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{text}</CardDescription>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  icon: Icon, title, text,
}: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="pt-3 text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{text}</CardDescription>
      </CardContent>
    </Card>
  );
}

function StatCard({ n, label, text }: { n: string; label: string; text: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="font-serif text-4xl text-[color:var(--accent)]">{n}</div>
        <CardTitle className="pt-1 text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{text}</CardDescription>
      </CardContent>
    </Card>
  );
}
