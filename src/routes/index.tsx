import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import brandBoards from "@/assets/modo-brand-boards.png.asset.json";
import consultationHero from "@/assets/modo-consultation-hero.jpeg.asset.json";
import tabletPlatform from "@/assets/modo-founders-scrubs.png.asset.json";
import wordmark from "@/assets/modo-wordmark.png.asset.json";




import {
  Calendar,
  Link2,
  Palette,
  CreditCard,
  Sparkles,
  Users,
  ClipboardList,
  Camera,
  Bell,
  MessageSquare,
  FileSignature,
  Layers,
  CheckCircle2,
  Lock,
  Network,
  Syringe,
  HandshakeIcon,
  ArrowRight,
} from "lucide-react";

// Icon-led visuals — no AI imagery used in hero blocks for now.

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MODO | The aesthetics-only booking & clinical platform" },
      {
        name: "description",
        content:
          "MODO is the UK booking, consultation and clinical platform built only for aesthetics — for HCPs and non-HCPs alike, with patient safety and collaborative working at the core.",
      },
      { property: "og:title", content: "MODO — The aesthetics-only platform" },

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

  // Redirect old hash-based waitlist links (e.g. shared on Instagram) to the
  // dedicated /waitlist route so the URL resolves cleanly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.toLowerCase() === "#waitlist") {
      navigate({ to: "/waitlist", replace: true });
    }
  }, [navigate]);

  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO — editorial split with founders imagery */}
        <header className="relative overflow-hidden">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-14 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:pt-24 lg:pb-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--clinical-blue-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                <span className="pulse-dot" />
                Built exclusively for aesthetics
              </div>

              <h1 className="text-4xl font-bold leading-[1.02] tracking-tight text-[color:var(--ink)] sm:text-6xl lg:text-[4.25rem]">
                Not another
                <br />
                generic booking app.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
                The UK booking, consultation and clinical platform built <em className="not-italic text-[color:var(--ink)]">only</em> for
                aesthetics. Bookings, medical records, consent, face mapping, payments
                and a prescriber hub — designed by clinicians who still run aesthetics clinics themselves.
              </p>

              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
<Link to="/auth" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full rounded-full bg-[color:var(--ink)] px-8 text-sm font-medium text-white shadow-sm hover:bg-[color:var(--ink)]/90 sm:w-auto"
                  >
                    Create your account
                  </Button>
                </Link>
                <Link to="/demo" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full rounded-full border-[color:var(--hairline)] bg-white px-8 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)] sm:w-auto"
                  >
                    Try the demo <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>

                <a
                  href="https://modobook.uk/m/aestheticsbynurseryan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full rounded-full border-[color:var(--hairline)] bg-white px-6 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)] sm:w-auto"
                  >
                    Live clinic 1 <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </a>
                <a
                  href="https://modobook.uk/m/aesthetiqbyjen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full rounded-full border-[color:var(--hairline)] bg-white px-6 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)] sm:w-auto"
                  >
                    Live clinic 2 <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </a>
              </div>

              <p className="mt-5 text-xs text-[color:var(--ink-soft)]">
                <span className="font-semibold text-[color:var(--accent)]">First month free · No card required.</span>{" "}
                Launching in the next few weeks · Waitlist members get first access &amp; founding-clinic pricing
              </p>

            </div>

            {/* Branded product showcase */}
            <div className="relative">
              <div className="absolute -left-6 -top-6 hidden h-24 w-24 rounded-2xl border border-[color:var(--accent)]/30 bg-[color:var(--clinical-blue-soft)] lg:block" />
              <div className="relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-[color:var(--muted)] shadow-[0_30px_60px_-20px_rgba(60,40,20,0.25)]">
                <img
                  src={consultationHero.url}
                  alt="A practitioner and patient using MODO on a tablet during consultation"
                  className="aspect-[4/5] w-full object-cover object-top"
                />

                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-white/95 px-4 py-3 backdrop-blur">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">The platform</div>
                    <div className="text-sm font-semibold text-[color:var(--ink)]">Built only for aesthetics</div>
                  </div>
                  <img src={wordmark.url} alt="MODO" className="h-6 w-auto object-contain" />
                </div>
              </div>
            </div>
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

        {/* THE GAP — editorial band with brand board photo */}
        <section className="relative my-12 overflow-hidden bg-[color:var(--ink)] px-5 py-24 lg:px-8">
          <img
            src={brandBoards.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-[color:var(--accent)]">
              Not another booking app
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
                <div key={s.v} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur">
                  <div className="text-2xl font-bold tracking-tight text-white">{s.k}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
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

        {/* FOUNDERS BAND */}
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
            <div className="relative overflow-hidden rounded-3xl border border-[color:var(--hairline)]">
              <img
                src={tabletPlatform.url}
                alt="MODO's founders"
                className="aspect-[3/4] w-full object-cover object-top"
              />

            </div>
            <div>
              <div className="eyebrow">§ For practitioners, by practitioners</div>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Built by clinicians.
                <br />
                <span className="text-[color:var(--ink-soft)]">Built for your clinic.</span>
              </h2>
              <p className="mt-5 text-[color:var(--ink-soft)]">
                MODO is designed by people who still run aesthetics clinics themselves — every
                workflow, consent flow and consultation step comes from real practice, not a
                product manager's whiteboard. MODO the platform is a software product; our
                founders' individual clinical registrations sit with them, not with MODO.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-full border border-[color:var(--hairline)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink)]">
                  Aesthetics-only
                </div>
                <div className="rounded-full border border-[color:var(--hairline)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink)]">
                  UK-built
                </div>
                <div className="rounded-full border border-[color:var(--hairline)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink)]">
                  Founding-clinic pricing
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* WAITLIST */}
        <WaitlistSection />

        {/* CTA */}


        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center lg:px-8">
            <div className="eyebrow">Launching soon</div>
            <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              MODO goes live
              <br />
              <span className="text-[color:var(--ink-soft)]">in the coming weeks.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[color:var(--ink-soft)]">
              We're rolling MODO out to founding clinics over the next couple of weeks. Create your account and we'll email you the moment your account is ready — founding members keep 100% of booking revenue and lock in launch pricing.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-[color:var(--ink)] px-10 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90 sm:w-auto"
                >
                  Create your account
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

function WaitlistSection() {
  return (
    <section className="scroll-mt-24 border-t border-[color:var(--hairline)] bg-[color:var(--paper)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8">
        <div>
          <div className="eyebrow">§ Launch list</div>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Be first in when
            <br />
            <span className="text-[color:var(--ink-soft)]">MODO goes live.</span>
          </h2>
          <p className="mt-5 max-w-md text-[color:var(--ink-soft)]">
            Practitioners on the list get early access, launch pricing and
            onboarding support before we open publicly.
          </p>
        </div>

        <div className="rounded-3xl border border-[color:var(--hairline)] bg-white p-6 shadow-sm sm:p-8">
          <div className="py-4 text-center sm:py-6">
            <h3 className="text-xl font-semibold">Create your account</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[color:var(--ink-soft)]">
              Get founding-clinic pricing, first access and a welcome email as soon as your account is ready.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-[color:var(--ink)] px-8 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90 sm:w-auto"
                >
                  Create your account <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-[color:var(--hairline)] px-8 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)] sm:w-auto"
                >
                  View pricing
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[color:var(--ink-soft)]">
              No spam. Unsubscribe any time. UK/EU data residency.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}




export function SiteHeader() {
  const pages = [
    { to: "/", label: "Home" },
    { to: "/features", label: "Features" },
    { to: "/prescriber-hub", label: "Prescriber Hub" },
    { to: "/rewards", label: "Rewards" },
    { to: "/who-its-for", label: "Who it's for" },
    { to: "/pricing", label: "Pricing" },
    { to: "/faq", label: "FAQ" },
    { to: "/demo", label: "Try the demo" },


    { to: "/auth", label: "Sign in" },
  ];
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[color:var(--hairline)] bg-[color:var(--paper)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" aria-label="MODO home" className="flex items-center">
          <img
            src={wordmark.url}
            alt="MODO"
            className="h-10 w-auto object-contain sm:h-12"
            draggable={false}
          />
        </Link>


        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden sm:inline-flex">
            <Button
              size="sm"
              className="rounded-full bg-[color:var(--ink)] px-5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--paper)] hover:bg-[color:var(--ink)]/90"
            >
              Create account
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-full border-[color:var(--hairline)] bg-white px-4 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink)] hover:bg-[color:var(--muted)]"
              >
                <span className="flex h-3 w-4 flex-col justify-between">
                  <span className="h-[1.5px] w-full bg-current" />
                  <span className="h-[1.5px] w-full bg-current" />
                  <span className="h-[1.5px] w-3/4 bg-current" />
                </span>
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[color:var(--hairline)] bg-white p-2">
              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                Explore MODO
              </DropdownMenuLabel>
              {pages.map((p) => (
                <DropdownMenuItem key={p.to} asChild className="rounded-lg">
                  <Link to={p.to} className="cursor-pointer px-3 py-2 text-sm font-medium text-[color:var(--ink)]">
                    {p.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-1 bg-[color:var(--hairline)]" />
              <DropdownMenuItem asChild className="rounded-lg">
                <Link to="/auth" className="cursor-pointer px-3 py-2 text-sm font-semibold text-[color:var(--accent)]">
                  Create your account →
                </Link>
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--hairline)] bg-[color:var(--paper)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Link to="/" aria-label="MODO home" className="flex items-center">
            <img
              src={wordmark.url}
              alt="MODO"
              className="h-11 w-auto object-contain"
              draggable={false}
            />
          </Link>

          <p className="mt-4 max-w-xs text-sm text-[color:var(--ink-soft)]">
            The aesthetics-only booking & clinical platform. UK-built by clinicians who still run clinics themselves.
          </p>
        </div>
        <FooterCol title="Platform" links={[
          { label: "Features", to: "/features" },
          { label: "Pricing", to: "/pricing" },
          { label: "Prescriber Hub", to: "/prescriber-hub" },
          { label: "Rewards", to: "/rewards" },
          { label: "Who it's for", to: "/who-its-for" },
        ]} />

        <FooterCol title="Join us" links={[
          { label: "Create your account", to: "/auth" },
          { label: "Sign in", to: "/auth" },
        ]} />

        <FooterCol title="Legal" links={[
          { label: "Privacy Policy", to: "/privacy" },
          { label: "Terms & Conditions", to: "/terms" },
        ]} />
      </div>
      <div className="border-t border-[color:var(--hairline)] py-6 text-center text-xs uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
        <div>© {new Date().getFullYear()} MODO · For practitioners, by practitioners</div>
        <div className="mt-2 normal-case tracking-normal">
          Designed by MODO Book ·{" "}
          <a href="mailto:info@modobook.co.uk" className="underline hover:text-[color:var(--ink)]">
            info@modobook.co.uk
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div className="text-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link to={l.to} className="text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]">{l.label}</Link>
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

