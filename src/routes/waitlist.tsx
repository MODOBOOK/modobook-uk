import { createFileRoute, Link } from "@tanstack/react-router";
import { WaitlistForm } from "@/components/WaitlistForm";
import { SiteHeader, SiteFooter } from "./index";
import wordmark from "@/assets/modo-wordmark.png.asset.json";
import { ArrowRight, Sparkles, Calendar, Users, CreditCard, FileSignature } from "lucide-react";

export const Route = createFileRoute("/waitlist")({
  head: () => ({
    meta: [
      { title: "MODO launch list closed · MODO Book is now open" },
      {
        name: "description",
        content:
          "The MODO Book launch list is closed — MODO is now open to founding clinics. If you joined the list, create your account and start taking bookings today.",
      },
      {
        property: "og:title",
        content: "MODO launch list closed · MODO Book is now open",
      },
      {
        property: "og:description",
        content:
          "The MODO Book launch list is closed. Founding clinics on the list can create their account now.",
      },
    ],
  }),
  component: WaitlistPage,
});

const PERKS = [
  {
    icon: Sparkles,
    title: "Founding-clinic pricing",
    body: "£29.99/month (usually £39.99) — first month free, no card required.",
  },
  {
    icon: Calendar,
    title: "First in line",
    body: "Get your account ready before we open publicly in the coming weeks.",
  },
  {
    icon: Users,
    title: "Onboarding support",
    body: "We'll help you import patients, set up your page and go live smoothly.",
  },
  {
    icon: CreditCard,
    title: "No booking fees",
    body: "Founding members keep 100% of booking revenue.",
  },
  {
    icon: FileSignature,
    title: "Built by clinicians",
    body: "Designed by aesthetics practitioners who still run clinics themselves.",
  },
];

function WaitlistPage() {
  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
            {/* Left copy */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--clinical-blue-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                <span className="pulse-dot" />
                Launch list closed
              </div>

              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-[color:var(--ink)] sm:text-5xl lg:text-6xl">
                MODO is open
                <br />
                <span className="text-[color:var(--ink-soft)]">for founding clinics.</span>
              </h1>

              <p className="mt-6 max-w-md text-base leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
                Our launch list is now closed. If you joined it, you can create your MODO
                account today and start taking bookings straight away.
              </p>

              <div className="mt-8 hidden lg:block">
                <img
                  src={wordmark.url}
                  alt="MODO"
                  className="h-12 w-auto object-contain opacity-80"
                />
              </div>
            </div>

            {/* Right form */}
            <div className="rounded-3xl border border-[color:var(--hairline)] bg-white p-6 shadow-sm sm:p-8 lg:p-10">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight">Already on the list?</h2>
                <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                  Create your clinic account with the email you signed up with.
                </p>
              </div>
              <WaitlistForm />
            </div>
          </div>
        </section>

        {/* Perks */}
        <section className="border-y border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
            <div className="mb-10 text-center">
              <div className="eyebrow">§ Why join early</div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                Founding clinics get more.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PERKS.map((perk) => (
                <div
                  key={perk.title}
                  className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--paper)] p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--clinical-blue-soft)] text-[color:var(--clinical-blue)]">
                    <perk.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{perk.title}</h3>
                  <p className="mt-2 text-sm text-[color:var(--ink-soft)]">{perk.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto max-w-4xl px-5 py-20 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Want to see what's coming first?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[color:var(--ink-soft)]">
            Explore the platform features, pricing and prescriber hub before you join.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/features" className="w-full sm:w-auto">
              <span className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--ink)] px-8 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90 sm:w-auto">
                See features <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </Link>
            <Link to="/pricing" className="w-full sm:w-auto">
              <span className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[color:var(--hairline)] bg-white px-8 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)] sm:w-auto">
                View pricing
              </span>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
