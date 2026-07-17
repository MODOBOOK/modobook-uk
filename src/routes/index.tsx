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
    <div className="modo-marketing min-h-screen">
      <SiteHeader />

      <main>
        {/* HERO — editorial, oversized display type */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-5 pb-14 pt-10 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-24">
            <div className="flex items-center gap-3 text-[color:var(--ink)]/70">
              <span className="eyebrow">The aesthetics-only platform</span>
              <span className="hidden h-px w-10 bg-[color:var(--ink)]/25 sm:inline-block" />
              <span className="hidden text-xs sm:inline">Est. by Nurse Prescribers · UK</span>
            </div>

            <h1 className="mt-6 font-display text-[2.6rem] font-light leading-[1.02] tracking-tight sm:text-6xl lg:text-[5.2rem]">
              Clinical software,
              <br className="hidden sm:block" />{" "}
              <span className="italic font-normal">
                <span className="gold-underline">shaped like a clinic.</span>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base text-[color:var(--ink)]/70 sm:text-lg">
              Booking, consultations, consent, photos, prescribing and payments —
              in one calm, professional platform built only for aesthetics.
              Designed by two practising UK Nurse Prescribers.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-none bg-[color:var(--ink)] px-8 text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--paper)] hover:bg-[color:var(--ink)]/90 sm:w-auto"
                >
                  Start free
                </Button>
              </Link>
              <Link to="/features" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-none border-[color:var(--ink)] bg-transparent px-8 text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5 sm:w-auto"
                >
                  Tour the platform <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <span className="text-xs text-[color:var(--ink)]/55">
                No card required · 0% booking fees · UK/EU data
              </span>
            </div>
          </div>

          {/* Editorial mosaic band — icon tiles as a subtle art element */}
          <div className="relative border-y border-[color:var(--ink)]/10 bg-[color:var(--paper)]">
            <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-[color:var(--ink)]/10 sm:grid-cols-4">
              {[
                { icon: Calendar, label: "Bookings" },
                { icon: ClipboardList, label: "Consultations" },
                { icon: FileSignature, label: "Consent" },
                { icon: CreditCard, label: "Payments" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-3 px-5 py-5 sm:px-8">
                  <t.icon className="h-4 w-4 text-[color:var(--gold)]" />
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--ink)]/70">
                    {t.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* THE PROBLEM / MANIFESTO */}
        <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <div className="eyebrow">§01 · The gap</div>
              <h2 className="mt-3 font-display text-3xl font-light leading-tight sm:text-4xl">
                Salon software with consent forms
                <span className="italic"> bolted on</span>. Medics-only portals that
                shut everyone else out.
              </h2>
            </div>
            <div className="space-y-4 text-[15px] leading-relaxed text-[color:var(--ink)]/75">
              <p>
                Aesthetics doesn't fit either. Patient safety falls between the cracks
                — real consultations, real screening, real consent, real collaboration
                between injectors, therapists and their prescribers.
              </p>
              <p>
                MODO is one clinical standard for the whole industry. For HCPs and
                non-HCPs. For solo practitioners and multi-location clinics. Built to
                the level a patient would expect and a regulator would recognise.
              </p>
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR — two editorial cards */}
        <section className="border-y border-[color:var(--ink)]/10 bg-white/60">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <div className="eyebrow">§02 · Who it's for</div>
                <h2 className="mt-3 font-display text-3xl font-light sm:text-4xl">
                  One platform, both sides of the room.
                </h2>
              </div>
              <div className="hidden h-px flex-1 self-center bg-[color:var(--ink)]/12 sm:block" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <EditorialCard
                tag="HCPs"
                icon={Syringe}
                title="Nurses, Doctors, Dentists, Pharmacists, Paramedics & Midwives"
                points={[
                  "Prescriber-grade consultation notes & treatment plans",
                  "Photo, social and marketing consent split out properly",
                  "Prescriber Hub — support the non-HCPs you work with",
                  "Multi-location, multi-practitioner clinics supported",
                ]}
              />
              <EditorialCard
                tag="Non-HCPs"
                icon={Sparkles}
                title="Aesthetics Practitioners, Skin & Other Injectors"
                points={[
                  "Full medical screening & consent before every appointment",
                  "Refer in your prescriber via the Prescriber Hub",
                  "Photo consent, aftercare and review periods built in",
                  "Look every bit as professional as a full clinic",
                ]}
              />
            </div>
          </div>
        </section>

        {/* FEATURES — clean 3-col editorial grid */}
        <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="mb-10 max-w-2xl">
            <div className="eyebrow">§03 · The platform</div>
            <h2 className="mt-3 font-display text-3xl font-light sm:text-4xl">
              Everything a clinic runs on —
              <span className="italic"> in one calm system.</span>
            </h2>
            <p className="mt-4 text-[15px] text-[color:var(--ink)]/70">
              Replace five or six tools with one workflow, designed around how
              aesthetics actually works.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden border border-[color:var(--ink)]/10 bg-[color:var(--ink)]/10 sm:grid-cols-2 lg:grid-cols-3">
            <EditorialFeature icon={Palette} title="Fully branded page" desc="Your colours, fonts, hero, logo and welcome — looks like your brand, not ours." />
            <EditorialFeature icon={Link2} title="Your own MODO link" desc="modobook.uk/your-clinic. One link for Instagram, TikTok, web and Google." />
            <EditorialFeature icon={Calendar} title="Smart availability" desc="Schedules, buffers, daily caps, lead times and model slots." />
            <EditorialFeature icon={ClipboardList} title="8-step consultation" desc="Screening, assessment, plan, consent, photos, product log, invoice." />
            <EditorialFeature icon={FileSignature} title="Consent & medical" desc="Build your own or use ours. Auto-sent, auto-signed, auto-filed." />
            <EditorialFeature icon={Camera} title="Face mapping & photos" desc="Pin-drop product tags with units and before/after imagery." />
            <EditorialFeature icon={Users} title="Patient records" desc="History, allergies, notes, photos, forms and messages in one place." />
            <EditorialFeature icon={Layers} title="Packages & courses" desc="Bundles, top-ups, add-ons and split payments — without the spreadsheet." />
            <EditorialFeature icon={CreditCard} title="Payments your way" desc="Card, deposits, pay-in-clinic, Klarna, Clearpay — fees can be passed on." />
            <EditorialFeature icon={Bell} title="Reminders that work" desc="Email, SMS and WhatsApp. Cancellation rules enforced automatically." />
            <EditorialFeature icon={MessageSquare} title="Marketing built-in" desc="Email your list, follow up after treatment, drive rebooks and reviews." />
            <EditorialFeature icon={ShieldCheck} title="GDPR-ready storage" desc="Encrypted at rest, UK/EU residency, granular photo & marketing consent." />
          </div>

          <div className="mt-8">
            <Link to="/features" className="group inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-[color:var(--ink)]">
              See every feature
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        {/* PRESCRIBER HUB — dark editorial band */}
        <section className="border-y border-[color:var(--ink)]/15 bg-[color:var(--ink)] text-[color:var(--paper)]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <div className="eyebrow !text-[color:var(--gold)]">§04 · Prescriber Hub</div>
              <h2 className="mt-3 font-display text-3xl font-light leading-tight sm:text-4xl">
                Prescribers and practitioners,
                <span className="italic"> on the same record.</span>
              </h2>
              <p className="mt-4 max-w-md text-[15px] text-[color:var(--paper)]/70">
                One safe, traceable place for prescribers and the practitioners
                they support. Shared patient records and collaborative notes —
                linked to the booking that started it.
              </p>
              <div className="mt-8">
                <Link to="/prescriber-hub">
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-none border-[color:var(--gold)] bg-transparent px-8 text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
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
                <div key={c.title} className="border border-[color:var(--paper)]/15 bg-[color:var(--paper)]/[0.03] p-6">
                  <c.icon className="h-5 w-5 text-[color:var(--gold)]" />
                  <div className="mt-4 font-display text-lg">{c.title}</div>
                  <p className="mt-2 text-sm text-[color:var(--paper)]/65">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOUNDERS / TRUST */}
        <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <div className="eyebrow">§05 · Built by clinicians</div>
              <h2 className="mt-3 font-display text-3xl font-light leading-tight sm:text-4xl">
                Designed by two Nurse Prescribers
                <span className="italic"> who were sick of the workarounds.</span>
              </h2>
              <p className="mt-4 text-[15px] text-[color:var(--ink)]/70">
                MODO was designed end-to-end by two practising UK Nurse Prescribers
                who understand consultations, prescribing notes, treatment plans,
                photo consent, model slots, top-ups, review periods and the
                realities of running an aesthetics clinic.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <EditorialCompare before="Salon app with consent PDFs" after="Aesthetics-only, end-to-end" />
                <EditorialCompare before="Medics-only portal" after="HCPs + non-HCPs, one standard" />
                <EditorialCompare before="Five tools + a spreadsheet" after="One platform, one record" />
                <EditorialCompare before="3–7% per booking" after="0% booking commission" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatTile value="5–8h" label="saved per week" />
              <StatTile value="0%" label="booking fees, ever" />
              <StatTile value="1 link" label="for your whole clinic" />
              <StatTile value="UK/EU" label="hosted patient data" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[color:var(--ink)]/10 bg-[color:var(--paper)]">
          <div className="mx-auto max-w-4xl px-5 py-20 text-center lg:px-8 lg:py-28">
            <div className="eyebrow">Ready when you are</div>
            <h2 className="mt-4 font-display text-4xl font-light leading-[1.05] sm:text-5xl lg:text-6xl">
              Set up your clinic
              <br />
              <span className="italic gold-underline">in an afternoon.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[15px] text-[color:var(--ink)]/70">
              Free to start. Keep 100% of your booking revenue. Your patients
              stay yours.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-none bg-[color:var(--ink)] px-10 text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--paper)] hover:bg-[color:var(--ink)]/90 sm:w-auto"
                >
                  Create your clinic
                </Button>
              </Link>
              <Link to="/who-its-for" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full rounded-none px-8 text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5 sm:w-auto"
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

/* -------- Editorial building blocks (scoped to landing) -------- */

function EditorialCard({
  tag,
  icon: Icon,
  title,
  points,
}: {
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  points: string[];
}) {
  return (
    <div className="group relative border border-[color:var(--ink)]/12 bg-white p-6 transition-colors hover:border-[color:var(--ink)]/30 sm:p-8">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{tag}</span>
        <Icon className="h-5 w-5 text-[color:var(--gold)]" />
      </div>
      <h3 className="mt-5 font-display text-xl leading-snug sm:text-2xl">{title}</h3>
      <ul className="mt-6 space-y-3 text-sm text-[color:var(--ink)]/75">
        {points.map((p) => (
          <li key={p} className="flex gap-3">
            <span className="mt-2 h-px w-4 shrink-0 bg-[color:var(--gold)]" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditorialFeature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-[color:var(--paper)] p-6 transition-colors hover:bg-white sm:p-7">
      <Icon className="h-5 w-5 text-[color:var(--gold)]" />
      <div className="mt-5 font-display text-base font-medium">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink)]/65">{desc}</p>
    </div>
  );
}

function EditorialCompare({ before, after }: { before: string; after: string }) {
  return (
    <div className="border-l border-[color:var(--ink)]/15 pl-4">
      <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--ink)]/40 line-through">
        {before}
      </div>
      <div className="mt-1 text-sm font-medium text-[color:var(--ink)]">{after}</div>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-[color:var(--ink)]/12 bg-white p-5 sm:p-6">
      <div className="font-display text-3xl font-light sm:text-4xl">{value}</div>
      <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[color:var(--ink)]/60">
        {label}
      </div>
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
