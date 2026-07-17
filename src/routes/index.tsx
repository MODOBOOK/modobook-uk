import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";


import {
  Calendar,
  Link2,
  Palette,
  ShieldCheck,
  CreditCard,
  Star,
  Stethoscope,
  Sparkles,
  Users,
  ClipboardList,
  Camera,
  Bell,
  MessageSquare,
  FileSignature,
  PoundSterling,
  Layers,
  CheckCircle2,
  HeartHandshake,
  Lock,
  Pill,
  Microscope,
  GraduationCap,
  Network,
  Syringe,
  HandshakeIcon,
  ArrowRight,
  Mail,
  ExternalLink,
} from "lucide-react";

// Icon-led visuals — no AI imagery used in hero blocks for now.

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MODO | The aesthetics-only booking & clinical platform — built by Nurse Prescribers" },
      {
        name: "description",
        content:
          "MODO is the UK booking, consultation and clinical platform built only for aesthetics — for HCPs and non-HCPs alike. Designed by two practising Nurse Prescribers for patient safety and collaborative working.",
      },
      { property: "og:title", content: "MODO — The aesthetics-only platform, built by Nurse Prescribers" },
      {
        property: "og:description",
        content:
          "Booking, consultations, consent, face mapping, payments and a prescriber hub — in one platform built only for aesthetics.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  // If launched from Home Screen (PWA standalone) and a session is present,
  // send practitioners straight to their dashboard so a force-close feels like
  // "still logged in" rather than dropping onto the marketing page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        navigate({ to: "/dashboard" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      {/* Clinical top nav — precision, thin, product-forward */}
      <nav className="sticky top-0 z-50 w-full border-b border-[color:var(--hairline)] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold uppercase tracking-tighter">
              MODO
            </Link>
            <div className="hidden gap-6 text-sm font-medium text-[color:var(--ink-soft)] lg:flex">
              <Link to="/features" className="transition-colors hover:text-[color:var(--clinical-blue)]">Features</Link>
              <Link to="/prescriber-hub" className="transition-colors hover:text-[color:var(--clinical-blue)]">Prescriber Hub</Link>
              <Link to="/rewards" className="transition-colors hover:text-[color:var(--clinical-blue)]">Rewards</Link>
              <Link to="/who-its-for" className="transition-colors hover:text-[color:var(--clinical-blue)]">Who it's for</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden text-sm font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] sm:inline">
              Sign in
            </Link>
            <Link to="/auth">
              <Button className="rounded-full bg-[color:var(--ink)] px-5 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* HERO — centred, clinical, product-forward */}
        <header className="relative px-5 pb-16 pt-16 text-center lg:px-8 lg:pt-28">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--clinical-blue)]/20 bg-[color:var(--clinical-blue-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--clinical-blue)]">
              <span className="pulse-dot" />
              The clinical standard for aesthetics
            </div>

            <h1 className="text-4xl font-bold leading-[1.03] tracking-tight text-[color:var(--ink)] sm:text-6xl lg:text-[4.5rem]">
              Aesthetics practice,
              <br className="hidden sm:block" />{" "}
              <span className="text-[color:var(--ink-soft)]">elevated to clinical excellence.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
              The UK platform for aesthetics practitioners. Bookings, consultations,
              consent, photos, prescribing and payments — one calm, medical-grade
              workflow, designed by two practising Nurse Prescribers.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-[color:var(--ink)] px-8 text-sm font-medium text-white shadow-sm hover:bg-[color:var(--ink)]/90 sm:w-auto"
                >
                  Start free
                </Button>
              </Link>
              <Link to="/features" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-[color:var(--hairline)] bg-white px-8 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)] sm:w-auto"
                >
                  Tour the platform <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <p className="mt-5 text-xs text-[color:var(--ink-soft)]">
              No card required · 0% booking fees · UK/EU data residency
            </p>
          </div>
        </header>

        {/* FEATURE PILLS — four clinical tiles */}
        <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { icon: Calendar, label: "Bookings" },
              { icon: ClipboardList, label: "Consultations" },
              { icon: FileSignature, label: "Consent" },
              { icon: CreditCard, label: "Payments" },
            ].map((t) => (
              <div
                key={t.label}
                className="group flex flex-col items-center justify-center rounded-2xl border border-[color:var(--hairline)] bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--clinical-blue)]/40 hover:shadow-xl hover:shadow-[color:var(--clinical-blue)]/5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--muted)] text-[color:var(--ink)] transition-colors group-hover:bg-[color:var(--clinical-blue)] group-hover:text-white">
                  <t.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold tracking-tight">{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* THE GAP — dark clinical band */}
        <section className="my-12 flex items-center justify-center bg-[color:var(--ink)] px-5 py-24 lg:px-8">
          <div className="max-w-4xl text-center">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-[color:var(--clinical-blue)]">
              The clinical void
            </h2>
            <p className="mt-6 text-3xl font-medium leading-snug text-white md:text-5xl">
              Bridging the gap between aesthetic artistry and medical protocol.
              <span className="text-white/60"> Precision at every appointment.</span>
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "0%", v: "Booking fees" },
                { k: "5–8h", v: "Saved / week" },
                { k: "1 link", v: "Whole clinic" },
                { k: "UK/EU", v: "Data residency" },
              ].map((s) => (
                <div key={s.v} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
                  <div className="text-2xl font-bold tracking-tight text-white">{s.k}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR — two spec-sheet cards */}
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mb-12 text-center">
            <div className="eyebrow">§ Who it's for</div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
              Designed for practitioners.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[color:var(--ink-soft)]">
              One clinical standard for the whole industry — for HCPs, for non-HCPs,
              for solo practitioners and multi-location clinics.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ClinicalWhoCard
              tag="HCPs"
              icon={Syringe}
              title="Nurses, Doctors, Dentists, Pharmacists, Paramedics & Midwives"
              blurb="Prescriber-grade consultation notes, medical screening, and integrated prescribing — with the Prescriber Hub for the non-HCPs you support."
              points={[
                "Prescriber-grade consultation notes & treatment plans",
                "Photo, social and marketing consent split out properly",
                "Prescriber Hub — support the non-HCPs you work with",
                "Multi-location, multi-practitioner clinics supported",
              ]}
              accent
            />
            <ClinicalWhoCard
              tag="Non-HCPs"
              icon={Sparkles}
              title="Aesthetics Practitioners, Skin & Other Injectors"
              blurb="Streamlined bookings, medical screening and consent, plus a Prescriber Hub link to refer to the clinicians who cover you."
              points={[
                "Full medical screening & consent before every appointment",
                "Refer in your prescriber via the Prescriber Hub",
                "Photo consent, aftercare and review periods built in",
                "Look every bit as professional as a full clinic",
              ]}
            />
          </div>
        </section>

        {/* FEATURES GRID — clinical rows */}
        <section className="border-t border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
            <div className="mb-12 max-w-2xl">
              <div className="eyebrow">§ The platform</div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything a clinic runs on — <span className="text-[color:var(--ink-soft)]">in one calm system.</span>
              </h2>
              <p className="mt-4 text-[color:var(--ink-soft)]">
                Replace five or six tools with one workflow, designed around how
                aesthetics actually works.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ClinicalFeature icon={Palette} title="Fully branded page" desc="Your colours, fonts, hero, logo and welcome — looks like your brand, not ours." />
              <ClinicalFeature icon={Link2} title="Your own MODO link" desc="modobook.uk/your-clinic. One link for Instagram, TikTok, web and Google." />
              <ClinicalFeature icon={Calendar} title="Smart availability" desc="Schedules, buffers, daily caps, lead times and model slots." />
              <ClinicalFeature icon={ClipboardList} title="8-step consultation" desc="Screening, assessment, plan, consent, photos, product log, invoice." />
              <ClinicalFeature icon={FileSignature} title="Consent & medical" desc="Build your own or use ours. Auto-sent, auto-signed, auto-filed." />
              <ClinicalFeature icon={Camera} title="Face mapping & photos" desc="Pin-drop product tags with units and before/after imagery." />
              <ClinicalFeature icon={Users} title="Patient records" desc="History, allergies, notes, photos, forms and messages in one place." />
              <ClinicalFeature icon={Layers} title="Packages & courses" desc="Bundles, top-ups, add-ons and split payments — without the spreadsheet." />
              <ClinicalFeature icon={CreditCard} title="Payments your way" desc="Card, deposits, pay-in-clinic, Klarna, Clearpay — fees can be passed on." />
              <ClinicalFeature icon={Bell} title="Reminders that work" desc="Email, SMS and WhatsApp. Cancellation rules enforced automatically." />
              <ClinicalFeature icon={MessageSquare} title="Marketing built-in" desc="Email your list, follow up after treatment, drive rebooks and reviews." />
              <ClinicalFeature icon={Lock} title="GDPR-ready storage" desc="Encrypted at rest, UK/EU residency, granular photo & marketing consent." />
            </div>

            <div className="mt-10">
              <Link to="/features" className="group inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--clinical-blue)]">
                See every feature
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* PRESCRIBER HUB */}
        <section className="border-y border-[color:var(--hairline)] bg-[color:var(--paper)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8">
            <div>
              <div className="eyebrow">§ Prescriber Hub</div>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Prescribers and practitioners, <span className="text-[color:var(--ink-soft)]">on the same record.</span>
              </h2>
              <p className="mt-5 max-w-md text-[color:var(--ink-soft)]">
                One safe, traceable place for prescribers and the practitioners they
                support. Shared patient records and collaborative notes — linked to
                the booking that started it.
              </p>
              <div className="mt-8">
                <Link to="/prescriber-hub">
                  <Button
                    size="lg"
                    className="rounded-full bg-[color:var(--clinical-blue)] px-8 text-sm font-medium text-white hover:bg-[color:var(--clinical-blue)]/90"
                  >
                    Learn about the Hub <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: ClipboardList, title: "Shared record", desc: "Medical form, consultation, photos — with consent." },
                { icon: Network, title: "Connected teams", desc: "Prescribers support many; practitioners refer to many." },
                { icon: HandshakeIcon, title: "Collaborative care", desc: "One workflow for HCPs and non-HCPs alike." },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl border border-[color:var(--hairline)] bg-white p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--clinical-blue-soft)] text-[color:var(--clinical-blue)]">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div className="text-base font-semibold">{c.title}</div>
                  <p className="mt-2 text-sm text-[color:var(--ink-soft)]">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center lg:px-8">
            <div className="eyebrow">Ready when you are</div>
            <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Set up your clinic
              <br />
              <span className="text-[color:var(--ink-soft)]">in an afternoon.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[color:var(--ink-soft)]">
              Free to start. Keep 100% of your booking revenue. Your patients stay yours.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-[color:var(--ink)] px-10 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90 sm:w-auto"
                >
                  Create your clinic
                </Button>
              </Link>
              <Link to="/who-its-for" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full rounded-full px-8 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)] sm:w-auto"
                >
                  Is MODO right for me?
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* -------- Clinical building blocks (scoped to landing) -------- */

function ClinicalWhoCard({
  tag,
  icon: Icon,
  title,
  blurb,
  points,
  accent,
}: {
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  points: string[];
  accent?: boolean;
}) {
  return (
    <div className="group rounded-3xl border border-[color:var(--hairline)] bg-white p-8 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[color:var(--clinical-blue)]/5 sm:p-10">
      <div className="mb-6 flex items-center justify-between">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${accent ? "bg-[color:var(--clinical-blue-soft)] text-[color:var(--clinical-blue)]" : "bg-[color:var(--muted)] text-[color:var(--ink-soft)]"}`}>
          {tag}
        </span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ? "bg-[color:var(--clinical-blue-soft)] text-[color:var(--clinical-blue)]" : "bg-[color:var(--muted)] text-[color:var(--ink-soft)]"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="text-xl font-bold leading-snug sm:text-2xl">{title}</h3>
      <p className="mt-3 text-sm text-[color:var(--ink-soft)]">{blurb}</p>
      <ul className="mt-6 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-sm text-[color:var(--ink-soft)]">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent ? "bg-[color:var(--clinical-blue)]" : "bg-[color:var(--ink-soft)]/40"}`} />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClinicalFeature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="group rounded-2xl border border-[color:var(--hairline)] bg-white p-6 transition-all hover:border-[color:var(--clinical-blue)]/30 hover:shadow-lg hover:shadow-[color:var(--clinical-blue)]/5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--muted)] text-[color:var(--ink)] transition-colors group-hover:bg-[color:var(--clinical-blue)] group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-soft)]">{desc}</p>
    </div>
  );
}



export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        <Link to="/" className="flex items-center">
          <BrandMark size="md" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link to="/features" className="text-muted-foreground hover:text-foreground">Features</Link>
          <Link to="/prescriber-hub" className="text-muted-foreground hover:text-foreground">Prescriber Hub</Link>
          <Link to="/rewards" className="text-muted-foreground hover:text-foreground">Rewards</Link>
          <Link to="/who-its-for" className="text-muted-foreground hover:text-foreground">Who it's for</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth" className="hidden sm:inline-flex">
            <Button>Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/20">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <BrandMark size="sm" />

          <p className="mt-3 text-sm text-muted-foreground">
            The aesthetics-only booking & clinical platform. Built by two UK Nurse Prescribers.
          </p>
        </div>
        <FooterCol title="Platform" links={[
          { label: "Features", to: "/features" },
          { label: "Prescriber Hub", to: "/prescriber-hub" },
          { label: "Rewards", to: "/rewards" },
          { label: "Who it's for", to: "/who-its-for" },
        ]} />
        <FooterCol title="Get started" links={[
          { label: "Create your clinic page", to: "/auth" },
          { label: "Sign in", to: "/auth" },
        ]} />
        <FooterCol title="Legal" links={[
          { label: "Privacy Policy", to: "/privacy" },
          { label: "Terms & Conditions", to: "/terms" },
        ]} />
      </div>
      <div className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MODO. Designed by Nurse Prescribers, for aesthetics clinics.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div className="text-sm">
      <div className="font-medium text-foreground">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link to={l.to} className="text-muted-foreground hover:text-foreground">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card>
      <CardHeader>
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Compare({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <div className="pt-0.5 text-muted-foreground line-through">✗</div>
      <div className="text-muted-foreground line-through">{before}</div>
      <div className="pt-0.5 text-primary">✓</div>
      <div className="font-medium">{after}</div>
    </div>
  );
}

function Benefit({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="text-3xl font-bold tracking-tight text-primary">{value}</div>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function WhoCard({ title, points }: { title: string; points: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ForCard({
  icon: Icon,
  tag,
  title,
  points,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  title: string;
  points: string[];
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Icon className="h-3.5 w-3.5" /> {tag}
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function HubCard({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card>
      <CardHeader>
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-sm">{desc}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Badge({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5">
      <Icon className="h-4 w-4 text-primary" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

// Re-exports used by sibling marketing pages
export { Feature as MarketingFeature, Benefit as MarketingBenefit, WhoCard as MarketingWhoCard, HubCard as MarketingHubCard, Compare as MarketingCompare };

export function IconTile({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/80 p-4 text-center shadow-sm ring-1 ring-black/5 backdrop-blur sm:gap-3 sm:p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-12 sm:w-12">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <span className="text-xs font-medium sm:text-sm">{label}</span>
    </div>
  );
}

// silence unused warnings for icons reserved for future sections
void GraduationCap;
void Pill;
void Microscope;
