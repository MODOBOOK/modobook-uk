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
  Instagram,
} from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23a7.55 7.55 0 0 1-1.38-1.73c-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09 0 1.24.9 2.43 1.02 2.6.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}

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
              <GridFeature icon={ClipboardList} title="Consultations" desc="Assess, plan, photograph, face map and document." />
              <GridFeature icon={FileSignature} title="Consent and Medical Forms" desc="Create, send, sign and securely stored." />
              <GridFeature icon={CreditCard} title="Payments" desc="Deposits, card capture, Klarna & Clearpay and pay in clinic options." />
              <GridFeature icon={Sparkles} title="MODO AI" desc="Create treatment plans, treatment descriptions, and forms in seconds." />
              <GridFeature icon={Network} title="Prescriber Hub" desc="Prescribing requests and notes — connected in one secure record." />
              <GridFeature icon={ShieldCheck} title="Clinic compliance" desc="Audits, checks, and action notes designed to keep you clinic inspection-ready." />
              <GridFeature icon={Bell} title="Aftercare & Reviews" desc="Automatically send aftercare and review requests following every treatment." />
              <GridFeature icon={Users} title="Memberships" desc="Build recurring revenue with memberships that run seamlessly." />
            </div>

            <Reveal>
              <div className="mt-10 text-center">
                <Link
                  to="/features"
                  className="link-underline group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]"
                >
                  Explore all features
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
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-8">
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
            The booking & clinical platform built exclusively for aesthetics. Designed in the UK by practitioners who understand the industry.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <a
              href="https://www.instagram.com/modobook.uk"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MODO on Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--hairline)] text-[color:var(--ink-soft)] transition-colors hover:border-[color:var(--taupe)] hover:text-[color:var(--ink)]"
            >
              <Instagram className="h-[18px] w-[18px]" />
            </a>
            <a
              href="https://wa.me/447000000000"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MODO on WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--hairline)] text-[color:var(--ink-soft)] transition-colors hover:border-[color:var(--taupe)] hover:text-[color:var(--ink)]"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" />
            </a>
          </div>
        </div>
        <FooterCol title="Platform" links={[
          { label: "Features", to: "/features" },
          { label: "Pricing", to: "/pricing" },
          { label: "Demo", to: "/demo" },
        ]} />

        <FooterCol title="Account" links={[
          { label: "Create your account", to: "/auth" },
          { label: "Sign in", to: "/auth" },
        ]} />

        <FooterCol title="Legal" links={[
          { label: "Privacy Policy", to: "/privacy" },
          { label: "Terms & Conditions", to: "/terms" },
          { label: "Cookie Policy", to: "/privacy/cookies" },
        ]} />

        <FooterCol title="Support" links={[
          { label: "Contact", href: "mailto:info@modobook.co.uk" },
          { label: "FAQ", to: "/faq" },
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

function FooterCol({ title, links }: { title: string; links: { label: string; to?: string; href?: string }[] }) {
  return (
    <div className="text-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to ?? l.href ?? l.label}>
            {l.href ? (
              <a href={l.href} className="text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]">{l.label}</a>
            ) : (
              <Link to={l.to!} className="text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]">{l.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
