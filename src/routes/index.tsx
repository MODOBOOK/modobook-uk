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
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden border-b">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-4 py-1.5 text-sm">
                <Stethoscope className="h-4 w-4 text-primary" />
                <span>Built by two UK Nurse Prescribers — for every aesthetics practitioner</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                The first booking & clinical platform built <em className="not-italic text-primary">only</em> for aesthetics.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Every aesthetics practitioner deserves an aesthetics-only app — for patient
                safety, clinical record-keeping and proper collaborative working. Not a
                hairdressing app with consent forms bolted on. Not a medics-only portal that
                shuts everyone else out.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">Start free — set up in minutes</Button>
                </Link>
                <Link to="/features">
                  <Button size="lg" variant="outline">
                    Explore the platform <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                No card required · 0% booking fees · Your data stays in the UK/EU
              </p>
            </div>
            <div className="relative">
              <div className="grid aspect-[4/3] w-full grid-cols-2 grid-rows-2 gap-3 rounded-3xl bg-gradient-to-br from-primary/10 via-muted/40 to-primary/5 p-6 shadow-xl ring-1 ring-black/5 sm:gap-5 sm:p-10">
                <IconTile icon={Calendar} label="Live bookings" />
                <IconTile icon={ClipboardList} label="Consultations" />
                <IconTile icon={FileSignature} label="Consent" />
                <IconTile icon={CreditCard} label="Payments" />
              </div>
            </div>

          </div>
        </section>

        {/* HCP + NON-HCP BAND */}
        <section className="border-b bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-2 lg:px-8">
            <ForCard
              icon={Syringe}
              tag="For HCPs"
              title="Nurses, Nurse Prescribers, Doctors, Dentists, Pharmacists, Paramedics & Midwives"
              points={[
                "Prescriber-grade consultation notes & treatment plans",
                "Photo & social media consent split out properly",
                "Prescriber Hub: collaborate with non-HCPs you work with",
                "Multi-location, multi-practitioner clinics supported",
              ]}
            />
            <ForCard
              icon={Sparkles}
              tag="For Non-HCPs"
              title="Aesthetics Practitioners, Skin Injectors & Other Injectors"
              points={[
                "Full medical screening & consent before every appointment",
                "Refer in your prescriber via the Prescriber Hub",
                "Photo consent, aftercare and review periods built in",
                "Look every bit as professional as a clinic",
              ]}
            />
          </div>
        </section>

        {/* WHY AESTHETICS-ONLY */}
        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Patient safety first
              </div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Why we built an aesthetics-only app.
              </h2>
              <p className="mt-4 text-muted-foreground">
                We kept seeing the same gap. There's a <strong>medics-only</strong> booking
                app. There's a <strong>salon</strong> booking app. There's nothing built
                properly for the whole aesthetics industry — and that's exactly where
                patient safety falls down.
              </p>
              <p className="mt-3 text-muted-foreground">
                MODO is for every aesthetics practitioner — HCPs and non-HCPs — under
                one standard. Real consultations. Real medical screening. Real consent.
                Real collaborative working between injectors, therapists and their
                prescribers.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "One clinical standard for the whole industry, not two tiers.",
                  "Built-in Prescriber Hub for HCPs and non-HCPs to collaborate safely.",
                  "Granular photo, social media and marketing consent on every patient.",
                  "Treatment plans, before/after photos and notes linked to every visit.",
                  "Aftercare and review periods sent automatically, every time.",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid aspect-[5/4] w-full grid-cols-2 grid-rows-2 gap-3 rounded-3xl bg-gradient-to-tr from-primary/10 via-muted/40 to-primary/5 p-6 shadow-lg ring-1 ring-black/5 sm:gap-5 sm:p-10">
              <IconTile icon={ShieldCheck} label="One safer standard" />
              <IconTile icon={HeartHandshake} label="HCPs + non-HCPs" />
              <IconTile icon={ClipboardList} label="Real consultations" />
              <IconTile icon={FileSignature} label="Granular consent" />
            </div>
          </div>
        </section>

        {/* PRESCRIBER HUB */}
        <section className="border-y bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Network className="h-3.5 w-3.5" /> Coming soon — included on every plan
              </div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Introducing the MODO Prescriber Hub.
              </h2>
              <p className="mt-3 text-muted-foreground">
                One safe, traceable place for prescribers and the practitioners they
                support. Shared patient records and collaborative notes — all linked
                to the booking that started it.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <HubCard icon={ClipboardList} title="Shared patient record" desc="Prescriber sees the medical form, consultation and photos — with consent." />
              <HubCard icon={Network} title="Connected practitioners" desc="Prescribers can support many practitioners; practitioners can refer to many prescribers." />
              <HubCard icon={HandshakeIcon} title="Collaborative care" desc="One workflow for HCPs and non-HCPs — accountable, safe, professional." />
            </div>
            <div className="mt-10 text-center">
              <Link to="/prescriber-hub">
                <Button size="lg" variant="outline">
                  Learn about the Prescriber Hub <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FOUNDERS */}
        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="grid aspect-[5/4] w-full grid-cols-2 grid-rows-2 gap-3 rounded-3xl bg-gradient-to-br from-primary/10 via-muted/40 to-primary/5 p-6 shadow-lg ring-1 ring-black/5 sm:gap-5 sm:p-10">
              <IconTile icon={Stethoscope} label="Clinician-led" />
              <IconTile icon={HeartHandshake} label="Built together" />
              <IconTile icon={Sparkles} label="For everyone" />
              <IconTile icon={Sparkles} label="Aesthetics-only" />
            </div>
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <HeartHandshake className="h-3.5 w-3.5" /> Built by clinicians, for clinicians
              </div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Designed by two Nurse Prescribers who were sick of the workarounds.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every other "booking system" in aesthetics is a hairdressing or spa app with
                consent forms bolted on — or a medics-only portal that excludes the rest of
                the industry. MODO was designed end-to-end by two practising UK Nurse
                Prescribers who understand consultations, prescribing notes, treatment plans,
                photo consent, model slots, top-ups, review periods and the realities of
                running an aesthetics clinic.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Compare before="A salon app with consent PDFs" after="Aesthetics-only, end-to-end" />
                <Compare before="Medics-only portal" after="HCPs + non-HCPs collaborating safely" />
                <Compare before="Five tools, one spreadsheet" after="One platform, one patient record" />
                <Compare before="3–7% per booking" after="0% booking commission" />
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything your clinic runs on — finally in one place.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Replace 5–6 separate tools with a single system designed around how aesthetics actually works.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Feature icon={Palette} title="Fully branded booking page" desc="Your colours, fonts, hero image, logo and welcome message. Looks like your brand — not ours." />
              <Feature icon={Link2} title="Your own MODO link" desc="modo.app/your-clinic. One link for Instagram, TikTok, your website and Google." />
              <Feature icon={Calendar} title="Smart live availability" desc="Weekly schedules, buffers, daily caps, lead times, model slots and ad-hoc rota changes." />
              <Feature icon={ClipboardList} title="8-step consultation flow" desc="Medical form, concerns, assessment, plan, consent, before/after photos, product log, invoice." />
              <Feature icon={FileSignature} title="Consent & medical forms" desc="Build your own or use ours. Auto-sent before treatment, auto-signed, auto-filed." />
              <Feature icon={Camera} title="Face mapping & photos" desc="Plan and record treatments with pin-drop product tags, units and before/after pictures." />
              <Feature icon={Users} title="Patient records" desc="Full history, allergies, concerns, consultations, photos, forms and comms in one profile." />
              <Feature icon={Layers} title="Packages & multi-session" desc="Bundles, courses, top-ups, add-ons and split payments — without the spreadsheet." />
              <Feature
                icon={CreditCard}
                title="Payments your way"
                desc="Card, deposits, pay-in-clinic, Klarna and Clearpay. Buy-now-pay-later fees can be passed to the patient."
              />
              <Feature icon={Bell} title="Reminders that work" desc="Confirmations and reminders by email, SMS and WhatsApp. Cancellation rules enforced automatically." />
              <Feature icon={MessageSquare} title="Marketing built-in" desc="Email your patient list, follow up after treatment, drive reviews and rebooks." />
              <Feature icon={ShieldCheck} title="GDPR-ready storage" desc="Encrypted at rest, UK/EU data residency, granular photo & marketing consent." />
            </div>
            <div className="mt-10 text-center">
              <Link to="/features">
                <Button size="lg" variant="outline">
                  See every feature <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* NUMBERS */}
        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Why practitioners are switching to MODO
            </h2>
            <p className="mt-3 text-muted-foreground">
              Save hours every week, look more professional and protect yourself clinically — all from one login.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Benefit value="5–8 hrs" label="saved per week on admin, consents and follow-ups" />
            <Benefit value="0%" label="booking commission. Ever. Your patients are yours." />
            <Benefit value="1 link" label="for bookings, consultations, consent and payments" />
            <Benefit value="100%" label="GDPR-ready, encrypted, UK/EU hosted patient data" />
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built for the way you actually work</h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <WhoCard
                title="Solo Nurse Prescribers"
                points={[
                  "One link, one inbox, one calendar",
                  "Prescriber-grade consultation notes",
                  "Photo, consent and aftercare on autopilot",
                ]}
              />
              <WhoCard
                title="Multi-practitioner clinics"
                points={[
                  "Assign practitioners to locations",
                  "First-available or patient-chooses booking",
                  "Per-practitioner pricing and rotas",
                ]}
              />
              <WhoCard
                title="Therapists & non-HCPs"
                points={[
                  "Mandatory medical screening + consent",
                  "Refer in a prescriber via the Hub",
                  "Look as professional as any clinic",
                ]}
              />
            </div>
          </div>
        </section>

        {/* SECURITY */}
        <section className="border-t">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Lock className="h-3.5 w-3.5" /> Built for clinical data
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Your patient data, treated like patient data.
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Encrypted at rest and in transit, hosted in the UK/EU, with row-level access controls
                so only your clinic can see your patients. Granular photo and marketing consent is
                captured per patient, per use case — patient file, social media, marketing, training.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge icon={ShieldCheck} label="GDPR-ready" />
              <Badge icon={Lock} label="Encrypted storage" />
              <Badge icon={PoundSterling} label="0% booking fees" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-20 text-center lg:px-8">
            <Star className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Join the platform built by the people doing the job.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Set up your clinic page in under 10 minutes. Import patients later. Cancel anytime.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/auth">
                <Button size="lg">Create your clinic page</Button>
              </Link>
              <Link to="/features">
                <Button size="lg" variant="outline">Explore the platform</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
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
          <Link to="/auth">
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
