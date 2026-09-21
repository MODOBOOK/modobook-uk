import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import wordmark from "@/assets/modo-wordmark.png.asset.json";

import {
  Calendar,
  Link2,
  Palette,
  CreditCard,
  Sparkles,
  Users,
  ClipboardList,
  Bell,
  MessageSquare,
  FileSignature,
  Layers,
  CheckCircle2,
  Network,
  ShieldCheck,
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
    <div
      className="modo-marketing min-h-screen text-[color:var(--ink)]"
      style={{ background: "var(--grad-page)" }}
    >
      <SiteHeader />

      <main>
        {/* HERO — centred editorial statement */}
        <Hero />

        {/* SIGN-UP CTA — black band, seen early */}
        <section className="bg-[color:var(--ink)] text-[color:var(--paper)]">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--taupe)]">
                Join MODO
              </p>
              <p className="mt-5 font-display text-4xl leading-tight sm:text-5xl">
                Start your first month free.
              </p>
              <p className="mx-auto mt-5 max-w-md text-sm text-[color:var(--paper)]/70">
                Get started in minutes. Cancel anytime.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  className="inline-flex h-14 items-center justify-center bg-[color:var(--paper)] px-12 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--taupe)]"
                >
                  Create your account
                </Link>
                <Link
                  to="/demo"
                  className="inline-flex h-14 items-center justify-center border border-[color:var(--paper)]/40 px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-colors hover:bg-[color:var(--paper)] hover:text-[color:var(--ink)]"
                >
                  EXPLORE THE DEMO
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* PRICING */}
        <PricingBand />

        {/* FEATURES */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <Reveal>
              <div className="mx-auto mb-14 max-w-xl text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
                  Inside MODO
                </div>
                <p className="mt-6 font-display text-3xl leading-tight text-[color:var(--ink)] sm:text-4xl">
                  Everything your clinic needs.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-px bg-[color:var(--hairline)] sm:grid-cols-2 lg:grid-cols-3">
              <GridFeature icon={Calendar} title="Bookings & Availability" desc="Smart scheduling, SMS reminders, and a personalised booking URL." />
              <GridFeature icon={ClipboardList} title="Consultations" desc="Assess, plan, photograph and document." />
              <GridFeature icon={FileSignature} title="Consent and Medical Forms" desc="Create, send, sign and securely stored." />
              <GridFeature icon={FaceOutline} title="Face mapping" desc="Document treatments precisely with interactive face mapping." />
              <GridFeature icon={CreditCard} title="Payments" desc="Deposits, card capture, Klarna & Clearpay and pay in clinic options." />
              <GridFeature icon={Sparkles} title="MODO AI" desc="Treatment descriptions, consent forms and aftercare written for you in seconds." />
              <GridFeature icon={Network} title="Prescriber Hub" desc="A shared, traceable prescribing record — requests, notes and batch numbers in one place." />
              <GridFeature icon={ShieldCheck} title="Clinic compliance" desc="Checks, audits and a notes board to keep your clinic inspection-ready — switch it on only if you want it." />
              <GridFeature icon={Bell} title="Aftercare & reviews" desc="Aftercare instructions and review requests go out automatically after every visit." />
              <GridFeature icon={Users} title="Memberships" desc="Monthly membership plans your clients sign up to online — agreements, payments and renewals handled." />
            </div>

            <Reveal>
              <div className="mt-10 text-center">
                <Link
                  to="/features"
                  className="link-underline group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]"
                >
                  See every feature
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}

/* -------- Interaction helpers -------- */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Hero() {
  return (
    <header
      className="relative overflow-hidden border-b border-[color:var(--hairline)]"
      style={{ background: "var(--grad-hero)" }}
    >
      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[color:var(--accent)]">
            Built exclusively for aesthetics
          </div>
        </Reveal>

        <Reveal delay={90}>
          <h1 className="mt-7 font-display text-[color:var(--ink)]">
            Aesthetics,
            <br />
            <span className="italic text-[color:var(--ink-soft)]">beautifully managed.</span>
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-8 max-w-xl text-base font-light leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
            The UK booking system, designed by aesthetics practitioners — manage
            bookings, client records, consent forms, treatment plans, payments, SMS
            reminders and more.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <p className="mx-auto mt-5 max-w-xl font-display text-lg leading-relaxed text-[color:var(--ink)] sm:text-xl">
            <span className="italic text-[color:var(--ink-soft)]">
              Everything you need to run a successful aesthetics clinic.
            </span>
          </p>
        </Reveal>

      </div>
    </header>
  );
}

type PriceRow = {
  name: string;
  tag: string;
  now: string;
  was?: string;
  unit: string;
  points: string[];
  highlight?: boolean;
};

const PRICE_ROWS: PriceRow[] = [
  {
    name: "MODO Solo",
    tag: "For independent practitioners",
    now: "£39.99",
    unit: "per month",
    points: [
      "Unlimited locations",
      "1 practitioner included",
      "SMS appointment reminders",
      "Branded booking page",
      "Consultations, consent & clinical records",
      "Payments, deposits & cancellation rules",
      "Prescriber hub",
    ],
    highlight: true,
  },
  {
    name: "MODO Collective",
    tag: "For clinic owners",
    now: "£59.99",
    unit: "per month",
    points: [
      "Everything in MODO Solo",
      "4 practitioners included",
      "Compliance suite for clinical governance",
      "Room rental & diary management",
      "Associate onboarding & permissions",
      "Training link for your training academy",
    ],
  },
  {
    name: "Additional Practitioner",
    tag: "Add-on",
    now: "£9.99",
    unit: "per practitioner / month",
    points: [
      "Individual calendar and login",
      "Dedicated patient list and records",
      "1 practitioner included",
    ],
  },
];

function FaceOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.5c4.1 0 7 3.3 7 8 0 4.9-3.1 11-7 11s-7-6.1-7-11c0-4.7 2.9-8 7-8Z" />
      <path d="M9.5 10.5h.01" />
      <path d="M14.5 10.5h.01" />
      <path d="M10 15.5c1.2 1 2.8 1 4 0" />
    </svg>
  );
}

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
    <div className="lift group relative bg-[color:var(--paper)] p-8 hover:bg-[color:var(--secondary)] sm:p-10">
      <Icon className="mb-5 h-5 w-5 text-[color:var(--accent)] transition-transform duration-500 group-hover:-translate-y-0.5" />
      <h3 className="font-display text-xl text-[color:var(--ink)]">{title}</h3>
      <div className="mt-3 h-px w-6 bg-[color:var(--taupe)] transition-all duration-500 group-hover:w-14" />
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">{desc}</p>
    </div>
  );
}

function PricingBand() {
  return (
    <section
      className="border-b border-[color:var(--hairline)]"
      style={{ background: "var(--grad-band)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <Reveal>
          <div className="mx-auto mb-14 max-w-xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
              Pricing
            </div>
            <p className="mt-6 font-display text-3xl leading-tight text-[color:var(--ink)] sm:text-4xl">
              Simple pricing. No surprises.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {PRICE_ROWS.map((t, i) => (
            <Reveal key={t.name} delay={i * 90}>
              <div
                className={`lift flex h-full flex-col border p-8 ${
                  t.highlight
                    ? "border-[color:var(--ink-soft)] bg-[color:var(--ink-soft)] text-[color:var(--paper)]"
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
                <h3
                  className={`mt-4 font-display text-2xl ${
                    t.highlight ? "text-[color:var(--paper)]" : "text-[color:var(--ink)]"
                  }`}
                >
                  {t.name}
                </h3>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-display text-4xl">{t.now}</span>
                  {t.was && (
                    <span
                      className={`text-sm line-through ${
                        t.highlight ? "text-[color:var(--paper)]/45" : "text-[color:var(--ink-soft)]/60"
                      }`}
                    >
                      {t.was}
                    </span>
                  )}
                </div>
                <div
                  className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${
                    t.highlight ? "text-[color:var(--paper)]/60" : "text-[color:var(--ink-soft)]"
                  }`}
                >
                  {t.unit} — inc VAT
                </div>
                <ul className="mt-7 space-y-3">
                  {t.points.map((p) => (
                    <li
                      key={p}
                      className={`flex items-start gap-3 text-sm ${
                        t.highlight ? "text-[color:var(--paper)]/75" : "text-[color:var(--ink-soft)]"
                      }`}
                    >
                      <span className="mt-2 h-px w-4 shrink-0 bg-[color:var(--taupe)]" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-10 text-center">
            <Link
              to="/pricing"
              className="link-underline group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]"
            >
              Full pricing detail
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------- Shared site chrome (used by sibling marketing pages) -------- */

const NAV_PAGES = [
  { to: "/features", label: "Features" },
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
