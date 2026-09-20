import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MODO | Aesthetics Clinic Booking Software UK" },
      {
        name: "description",
        content:
          "Booking, consultations, consent and payments in one UK platform built only for aesthetics clinics. Free first month, no card required.",
      },
      { property: "og:title", content: "MODO — Aesthetics clinic booking & clinical software" },
      {
        property: "og:description",
        content:
          "Booking, consultations, consent, face mapping, payments and a prescriber hub — in one platform built only for aesthetics.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "MODO",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://modobook.uk/",
          description:
            "Booking, consultations, consent, clinical records and payments for UK aesthetics practitioners.",
          publisher: { "@id": "https://modobook.uk/#organization" },
          offers: {
            "@type": "Offer",
            price: "29.99",
            priceCurrency: "GBP",
            url: "https://modobook.uk/pricing",
          },
        }),
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
        {/* HERO — centred editorial statement */}
        <Hero />

        {/* STATS RIBBON — quiet beige band */}
        <section className="border-b border-[color:var(--hairline)] bg-[color:var(--secondary)] py-14 sm:py-16">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
            {[
              { k: "0%", v: "Booking fees" },
              { k: "5–8h", v: "Saved per week" },
              { k: "1 link", v: "Whole clinic" },
              { k: "UK/EU", v: "Data residency" },
            ].map((s, i) => (
              <Reveal key={s.v} delay={i * 90}>
                <div className="group space-y-2">
                  <div className="font-display text-4xl text-[color:var(--ink)] transition-transform duration-500 group-hover:-translate-y-0.5 sm:text-5xl">
                    {s.k}
                  </div>
                  <div className="h-px w-8 bg-[color:var(--taupe)] transition-all duration-500 group-hover:w-16" />
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                    {s.v}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* IMAGE BAND */}
        <section className="relative overflow-hidden">
          <img
            src={consultationHero.url}
            alt="A practitioner and patient using MODO on a tablet during consultation"
            className="h-[320px] w-full object-cover object-top sm:h-[440px]"
          />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 bg-[color:var(--paper)]/95 px-5 py-4 backdrop-blur sm:left-8 sm:right-auto sm:min-w-[320px]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">The platform</div>
              <div className="font-display text-base text-[color:var(--ink)]">Built only for aesthetics</div>
            </div>
            <img src={wordmark.url} alt="MODO" className="h-6 w-auto shrink-0 object-contain" />
          </div>
        </section>

        {/* FEATURES — hairline grid */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="mb-14">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--accent)]">
                The platform
              </h2>
              <div className="mt-4 h-px w-20 bg-[color:var(--taupe)]" />
              <p className="mt-6 max-w-2xl font-display text-2xl leading-snug text-[color:var(--ink)] sm:text-3xl">
                Everything a clinic runs on — in one calm system.
              </p>
              <p className="mt-3 max-w-xl text-[color:var(--ink-soft)]">
                Replace five or six tools with one workflow, designed around how
                aesthetics actually works.
              </p>
            </div>

            <div className="grid gap-px border border-[color:var(--hairline)] bg-[color:var(--hairline)] sm:grid-cols-2 lg:grid-cols-3">
              <GridFeature icon={Palette} title="Fully branded page" desc="Your colours, fonts, hero, logo and welcome — looks like your brand, not ours." />
              <GridFeature icon={Link2} title="Your own MODO link" desc="modobook.uk/your-clinic. One link for Instagram, TikTok, web and Google." />
              <GridFeature icon={Calendar} title="Smart availability" desc="Schedules, buffers, daily caps, lead times and model slots." />
              <GridFeature icon={ClipboardList} title="8-step consultation" desc="Screening, assessment, plan, consent, photos, product log, invoice." />
              <GridFeature icon={FileSignature} title="Consent & medical" desc="Build your own or use ours. Auto-sent, auto-signed, auto-filed." />
              <GridFeature icon={Camera} title="Face mapping & photos" desc="Pin-drop product tags with units and before/after imagery." />
              <GridFeature icon={Users} title="Patient records" desc="History, allergies, notes, photos, forms and messages in one place." />
              <GridFeature icon={Layers} title="Packages & courses" desc="Bundles, top-ups, add-ons and split payments — without the spreadsheet." />
              <GridFeature icon={CreditCard} title="Payments your way" desc="Card, deposits, pay-in-clinic, Klarna, Clearpay — fees can be passed on." />
              <GridFeature icon={Bell} title="Reminders that work" desc="Automated email reminders. Cancellation rules enforced automatically." />
              <GridFeature icon={MessageSquare} title="Marketing built-in" desc="Email your list, follow up after treatment, drive rebooks and reviews." />
              <GridFeature icon={Lock} title="GDPR-ready storage" desc="Encrypted at rest, UK/EU residency, granular photo & marketing consent." />
            </div>

            <div className="mt-10">
              <Link to="/features" className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
                See every feature
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR — two spec-sheet cards */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="mb-14">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--accent)]">
                Who it's for
              </h2>
              <div className="mt-4 h-px w-20 bg-[color:var(--taupe)]" />
              <p className="mt-6 max-w-2xl font-display text-2xl leading-snug text-[color:var(--ink)] sm:text-3xl">
                Designed for practitioners.
              </p>
              <p className="mt-3 max-w-xl text-[color:var(--ink-soft)]">
                One clinical standard for the whole industry — for HCPs, for non-HCPs,
                for solo practitioners and multi-location clinics.
              </p>
            </div>
            <div className="grid gap-px border border-[color:var(--hairline)] bg-[color:var(--hairline)] md:grid-cols-2">
              <WhoPanel
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
              />
              <WhoPanel
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
          </div>
        </section>

        {/* PRESCRIBER HUB — black statement band */}
        <section className="bg-[color:var(--ink)] text-[color:var(--paper)]">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-8">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--taupe)]">
                Prescriber Hub
              </h2>
              <div className="mt-4 h-px w-20 bg-[color:var(--taupe)]" />
              <p className="mt-6 font-display text-3xl leading-snug sm:text-4xl">
                Prescribers and practitioners, on the same record.
              </p>
              <p className="mt-5 max-w-md text-[color:var(--paper)]/70">
                One safe, traceable place for prescribers and the practitioners they
                support. Shared patient records and collaborative notes — linked to
                the booking that started it.
              </p>
              <div className="mt-9">
                <Link
                  to="/prescriber-hub"
                  className="inline-flex h-13 items-center justify-center border border-[color:var(--paper)]/40 px-8 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-colors hover:bg-[color:var(--paper)] hover:text-[color:var(--ink)]"
                >
                  Learn about the Hub
                </Link>
              </div>
            </div>

            <div className="grid gap-px border border-[color:var(--paper)]/15 bg-[color:var(--paper)]/15">
              {[
                { icon: ClipboardList, title: "Shared record", desc: "Medical form, consultation, photos — with consent." },
                { icon: Network, title: "Connected teams", desc: "Prescribers support many; practitioners refer to many." },
                { icon: CheckCircle2, title: "Collaborative care", desc: "One workflow for HCPs and non-HCPs alike." },
              ].map((c) => (
                <div key={c.title} className="flex items-start gap-4 bg-[color:var(--ink)] p-6">
                  <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--taupe)]" />
                  <div>
                    <div className="font-display text-lg">{c.title}</div>
                    <p className="mt-1 text-sm text-[color:var(--paper)]/60">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOUNDERS BAND */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8">
            <div className="relative overflow-hidden border border-[color:var(--hairline)]">
              <img
                src={tabletPlatform.url}
                alt="MODO's founders"
                className="aspect-[3/4] w-full object-cover object-top"
              />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--accent)]">
                For practitioners, by practitioners
              </h2>
              <div className="mt-4 h-px w-20 bg-[color:var(--taupe)]" />
              <p className="mt-6 font-display text-3xl leading-snug text-[color:var(--ink)] sm:text-4xl">
                Built by clinicians.
                <br />
                <span className="italic text-[color:var(--ink-soft)]">Built for your clinic.</span>
              </p>
              <p className="mt-5 max-w-lg text-[color:var(--ink-soft)]">
                MODO is designed by people who still run aesthetics clinics themselves — every
                workflow, consent flow and consultation step comes from real practice, not a
                product manager's whiteboard. MODO the platform is a software product; our
                founders' individual clinical registrations sit with them, not with MODO.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Aesthetics-only", "UK-designed", "Founding-clinic pricing"].map((b) => (
                  <div
                    key={b}
                    className="border border-[color:var(--hairline)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink)]"
                  >
                    {b}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* STATEMENT BAND */}
        <section className="relative overflow-hidden bg-[color:var(--ink)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <img
            src={brandBoards.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-15"
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--taupe)]">
              Not another booking app
            </h2>
            <p className="mt-6 font-display text-3xl leading-snug text-[color:var(--paper)] md:text-5xl">
              Bridging the gap between aesthetic artistry and medical protocol.
              <span className="text-[color:var(--paper)]/50"> Precision at every appointment.</span>
            </p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bg-[color:var(--secondary)]">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--accent)]">
              Now open
            </h2>
            <p className="mt-6 font-display text-4xl leading-[1.15] text-[color:var(--ink)] sm:text-5xl">
              Elevate your clinical practice today.
            </p>
            <p className="mx-auto mt-5 max-w-lg text-[color:var(--ink-soft)]">
              Anyone can join MODO today — no waitlist and no card details. Your first month
              is free, you keep 100% of your booking revenue, and you can cancel anytime.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/auth"
                className="inline-flex h-14 items-center justify-center bg-[color:var(--ink)] px-12 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-colors hover:bg-[color:var(--accent)]"
              >
                Start your free month
              </Link>
              <Link
                to="/who-its-for"
                className="inline-flex h-14 items-center justify-center border border-[color:var(--ink)] px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)]"
              >
                Is MODO right for me?
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* -------- Landing building blocks -------- */

function GridFeature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="group bg-[color:var(--paper)] p-8 transition-colors hover:bg-[color:var(--secondary)] sm:p-10">
      <Icon className="mb-5 h-5 w-5 text-[color:var(--accent)]" />
      <h3 className="font-display text-xl text-[color:var(--ink)]">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">{desc}</p>
    </div>
  );
}

function WhoPanel({
  tag,
  icon: Icon,
  title,
  blurb,
  points,
}: {
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  points: string[];
}) {
  return (
    <div className="bg-[color:var(--paper)] p-8 sm:p-12">
      <div className="mb-6 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 border border-[color:var(--hairline)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
          {tag}
        </span>
        <Icon className="h-5 w-5 text-[color:var(--accent)]" />
      </div>
      <h3 className="font-display text-xl leading-snug text-[color:var(--ink)] sm:text-2xl">{title}</h3>
      <p className="mt-3 text-sm text-[color:var(--ink-soft)]">{blurb}</p>
      <ul className="mt-7 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-sm text-[color:var(--ink-soft)]">
            <span className="mt-2 h-px w-4 shrink-0 bg-[color:var(--taupe)]" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------- Shared site chrome (used by sibling marketing pages) -------- */

const NAV_PAGES = [
  { to: "/features", label: "Features" },
  { to: "/prescriber-hub", label: "Prescriber Hub" },
  { to: "/who-its-for", label: "Who it's for" },
  { to: "/rewards", label: "Rewards" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
  { to: "/demo", label: "Demo" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[color:var(--hairline)] bg-[color:var(--paper)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link to="/" aria-label="MODO home" className="flex shrink-0 items-center">
          <img
            src={wordmark.url}
            alt="MODO"
            className="h-9 w-auto object-contain sm:h-11"
            draggable={false}
          />
        </Link>

        {/* Top bar nav — no dropdown. Scrolls sideways on small screens. */}
        <nav
          aria-label="Main"
          className="flex flex-1 items-center justify-end gap-6 overflow-x-auto whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)] sm:gap-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV_PAGES.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="py-2 transition-colors hover:text-[color:var(--ink)]"
            >
              {p.label}
            </Link>
          ))}
          <Link to="/auth" className="py-2 transition-colors hover:text-[color:var(--ink)]">
            Sign in
          </Link>
          <Link
            to="/auth"
            className="hidden shrink-0 bg-[color:var(--ink)] px-5 py-2.5 text-[color:var(--paper)] transition-colors hover:bg-[color:var(--accent)] sm:inline-flex"
          >
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--hairline)] bg-[color:var(--paper)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
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
            The aesthetics-only booking & clinical platform. UK-designed by clinicians who still run clinics themselves.
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

export function IconTile({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-[color:var(--hairline)] bg-[color:var(--paper)] p-4 text-center sm:gap-3 sm:p-6">
      <div className="flex h-10 w-10 items-center justify-center bg-[color:var(--secondary)] text-[color:var(--ink)] sm:h-12 sm:w-12">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <span className="text-xs font-medium sm:text-sm">{label}</span>
    </div>
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
