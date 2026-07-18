import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter, IconTile } from "./index";
import consultationPhoto from "@/assets/modo-consultation.png.asset.json";
import tabletBooking from "@/assets/modo-tablet-booking.png.asset.json";

import {
  Gift, Sparkles, Users, Share2, PartyPopper, Coins, Trophy, ArrowRight,
  CheckCircle2, HelpCircle, Wallet, HeartHandshake,
} from "lucide-react";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards & Referrals | MODO — earn credit when friends book" },
      {
        name: "description",
        content:
          "How MODO's built-in referrals and loyalty work. Share your practitioner's code, both of you get rewarded, and rack up points on every paid visit.",
      },
      { property: "og:title", content: "Rewards & Referrals | MODO" },
      {
        property: "og:description",
        content:
          "Refer a friend, earn credit at your clinic, and collect loyalty points on every paid appointment — powered by MODO.",
      },
    ],
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
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/25 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                <Gift className="h-3.5 w-3.5" /> Built into every MODO clinic
              </div>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Refer friends. Earn rewards. Simple as that.
              </h1>
              <p className="mt-5 max-w-lg text-base text-[color:var(--ink-soft)] sm:text-lg">
                Every MODO clinic can run its own referral and loyalty programme. Share a friend's code
                when you book, or hand out your own — you both benefit when they attend.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full rounded-full bg-[color:var(--ink)] px-8 text-white hover:bg-[color:var(--ink)]/90 sm:w-auto">
                    Find your clinic <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#how-it-works" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full rounded-full border-[color:var(--hairline)] bg-white px-8 sm:w-auto">
                    How it works
                  </Button>
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <IconTile icon={Gift} label="Referral rewards" />
                <IconTile icon={Coins} label="Loyalty credit" />
                <IconTile icon={Sparkles} label="Points on every visit" />
                <IconTile icon={Trophy} label="Reward tiers" />
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)]">
              <img src={tabletBooking.url} alt="MODO booking with rewards" className="aspect-[4/5] w-full object-cover" loading="lazy" />
            </div>
          </div>
        </section>

        {/* SECTION 1 — New patients */}
        <section id="new-patients" className="border-b border-[color:var(--hairline)]">

          <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                <PartyPopper className="h-3.5 w-3.5" /> New to your clinic
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Money off your first booking</h2>
              <p className="mt-3 text-muted-foreground">
                If a friend already goes to a MODO clinic, ask them for their referral code.
                Enter it on the booking page and their practitioner's welcome offer applies to you.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
              <StepCard
                n={1}
                icon={Users}
                title="Get a friend's code"
                text="Ask them to share the 6-character code from their MODO account."
              />
              <StepCard
                n={2}
                icon={Wallet}
                title="Enter it at checkout"
                text="On the clinic's booking page, paste the code into the 'Referral code' box."
              />
              <StepCard
                n={3}
                icon={CheckCircle2}
                title="Turn up"
                text="Your welcome discount is applied. Your friend gets their reward once you attend."
              />
            </div>

            <div className="mx-auto mt-10 max-w-3xl">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <HeartHandshake className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">Every practitioner sets their own offer.</p>
                    <p className="text-sm text-muted-foreground">
                      Rewards, points and tiers are chosen by the clinic — some offer £-off first bookings, some percentages, some loyalty points. The booking page shows exactly what you'll get.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* SECTION 2 — Existing patients */}
        <section id="how-it-works" className="border-b bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" /> Already a patient
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Earn every time you visit — and every time you share</h2>
              <p className="mt-3 text-muted-foreground">
                Sign into your patient account on any MODO clinic and you'll find your rewards dashboard:
                your personal referral code, credit balance, points and available reward tiers.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
              <FeatureCard
                icon={Share2}
                title="Your referral code"
                text="A 6-character code, unique to you at each clinic you visit. Share it however you like — text, WhatsApp, social — and both of you get rewarded when they attend."
              />
              <FeatureCard
                icon={Gift}
                title="Referral rewards"
                text="When your friend's first paid appointment finishes, your reward posts automatically to your account. No forms, no chasing."
              />
              <FeatureCard
                icon={Coins}
                title="Loyalty points"
                text="Optional at each clinic. Where turned on, you earn points on every paid booking — points show in your rewards tab and can convert to credit or tier rewards."
              />
              <FeatureCard
                icon={Trophy}
                title="Reward tiers"
                text="Some clinics publish a rewards catalogue — e.g. 500 points = a free add-on. Redeem as soon as you hit the threshold."
              />
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-xl border bg-background p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Find your rewards under <strong>My account → Rewards</strong> on your clinic's MODO page.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b">
          <div className="mx-auto max-w-4xl px-4 py-16 lg:px-8 lg:py-20">
            <div className="mb-8 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                <HelpCircle className="h-3.5 w-3.5" /> FAQs
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Common questions</h2>
            </div>

            <div className="space-y-4">
              <Faq
                q="Do all clinics on MODO offer rewards?"
                a="No — each practitioner chooses whether to run referrals and loyalty. If a clinic has rewards turned on you'll see it on their booking page and in your patient account. If it's off, the referral field simply won't appear."
              />
              <Faq
                q="When do I actually get my reward?"
                a="Referral rewards pay out after your friend's first paid appointment is completed. Loyalty points post when your booking is paid. Neither is manual — MODO handles it in the background."
              />
              <Faq
                q="Can I use a referral code and a discount code together?"
                a="A referral code isn't a discount code — it identifies the friend who sent you. Whether it stacks with a promo depends on the clinic's rules; the booking page will show your total either way."
              />
              <Faq
                q="Do points or credit expire?"
                a="MODO doesn't expire them by default. Individual clinics may set their own rules — check your rewards tab for their programme details."
              />
              <Faq
                q="I'm a practitioner — how do I turn this on?"
                a="Sign into your MODO dashboard and open Rewards. Toggle the programme on, set your referrer and friend rewards, add loyalty and tiers if you want them, then optionally show it on your public booking page."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-b from-background to-primary/10">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8 lg:py-20">
            <h2 className="font-serif text-3xl sm:text-4xl">Ready to start earning?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Head to your practitioner's MODO page, sign in and grab your code — or, if you run a clinic, turn rewards on from your dashboard.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg">Sign in <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
              <Link to="/features">
                <Button size="lg" variant="outline">Explore MODO features</Button>
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

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-lg border bg-background p-4 open:shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between font-medium">
        {q}
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}
