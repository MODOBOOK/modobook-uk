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
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
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
            className="h-[300px] w-full object-cover object-top sm:h-[420px]"
          />
        </section>

        {/* FEATURES — six essentials */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <Reveal>
              <div className="mx-auto mb-14 max-w-xl text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
                  The platform
                </div>
                <p className="mt-6 font-display text-3xl leading-tight text-[color:var(--ink)] sm:text-4xl">
                  Everything a clinic runs on, in one calm system.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-px border border-[color:var(--hairline)] bg-[color:var(--hairline)] sm:grid-cols-2 lg:grid-cols-3">
              <GridFeature icon={Calendar} title="Bookings & availability" desc="Your own MODO link, smart schedules, deposits and reminders." />
              <GridFeature icon={ClipboardList} title="Consultations" desc="Screening, assessment, plan, photos and product log in one flow." />
              <GridFeature icon={FileSignature} title="Consent & medical" desc="Use ours or build your own — auto-sent, signed and filed." />
              <GridFeature icon={Camera} title="Face mapping" desc="Pin-drop product tags with units and before/after imagery." />
              <GridFeature icon={CreditCard} title="Payments" desc="Card, deposits, pay-in-clinic — and 0% booking fees." />
              <GridFeature icon={Lock} title="GDPR-ready records" desc="Encrypted, UK/EU residency, consent split out properly." />
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

        {/* PRICING */}
        <PricingBand />

        {/* FINAL CTA */}
        <section className="bg-[color:var(--ink)] text-[color:var(--paper)]">
          <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
            <Reveal>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--taupe)]">
                Now open
              </div>
              <p className="mt-6 font-display text-4xl leading-tight sm:text-5xl">
                Start your first month free.
              </p>
              <p className="mx-auto mt-5 max-w-md text-sm text-[color:var(--paper)]/70">
                No waitlist, no card details, no booking fees. Cancel anytime.
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
                  Try the demo
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

const HERO_AUDIENCES = [
  {
    id: "solo",
    label: "Solo practitioner",
    line: "Your whole practice — bookings, consultations, consent and payments — behind one beautiful link.",
  },
  {
    id: "clinic",
    label: "Clinic & team",
    line: "Every room, every practitioner and every location in one calm diary, with clinical records that keep up.",
  },
  {
    id: "prescriber",
    label: "Prescriber",
    line: "Support the practitioners you cover on a shared, traceable record — prescribing and notes in one place.",
  },
] as const;

function Hero() {
  const [audience, setAudience] = useState<string>(HERO_AUDIENCES[0].id);
  const active = HERO_AUDIENCES.find((a) => a.id === audience) ?? HERO_AUDIENCES[0];

  return (
    <header className="relative overflow-hidden border-b border-[color:var(--hairline)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--taupe) 55%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[color:var(--accent)]">
            Built exclusively for aesthetics
          </div>
        </Reveal>

        <Reveal delay={90}>
          <h1 className="mt-7 font-display text-[color:var(--ink)]">
            The clinic,
            <br />
            <span className="italic font-light text-[color:var(--ink-soft)]">beautifully run.</span>
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-8 max-w-xl text-base font-light leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
            The UK booking, consultation and clinical platform designed only for aesthetics —
            records, consent, face mapping, payments and a prescriber hub, designed by
            clinicians who still run clinics themselves.
          </p>
        </Reveal>

        {/* Interactive audience pill */}
        <Reveal delay={260}>
          <div className="mt-10 flex justify-center">
            <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-[color:var(--hairline)] bg-[color:var(--card)] p-1">
              {HERO_AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  aria-pressed={audience === a.id}
                  className={`rounded-full px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-400 ${
                    audience === a.id
                      ? "bg-[color:var(--ink)] text-[color:var(--paper)]"
                      : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <p
            key={active.id}
            className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-[color:var(--ink-soft)] animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            {active.line}
          </p>
        </Reveal>

        <Reveal delay={340}>
          <div className="mt-11 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex h-14 items-center justify-center bg-[color:var(--ink)] px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-colors hover:bg-[color:var(--accent)]"
            >
              Create your account
            </Link>
            <Link
              to="/demo"
              className="inline-flex h-14 items-center justify-center border border-[color:var(--ink)] px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)]"
            >
              Try the demo
            </Link>
          </div>
        </Reveal>

        <Reveal delay={420}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://modobook.uk/m/aestheticsbynurseryan"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink)]"
            >
              Live clinic 1
              <ArrowRight className="h-3.5 w-3.5 text-[color:var(--accent)] transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="https://modobook.uk/m/aesthetiqbyjen"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink)]"
            >
              Live clinic 2
              <ArrowRight className="h-3.5 w-3.5 text-[color:var(--accent)] transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-[color:var(--ink-soft)]">
            <span className="font-semibold text-[color:var(--ink)]">
              First month free · No card details required.
            </span>{" "}
            Open to every aesthetics practitioner — sign up in minutes, cancel anytime.
          </p>
        </Reveal>
      </div>
    </header>
  );
}

const WHO_TABS = [
  {
    id: "hcp",
    tag: "HCPs",
    icon: Syringe,
    title: "Nurses, Doctors, Dentists, Pharmacists, Paramedics & Midwives",
    blurb:
      "Prescriber-grade consultation notes, medical screening, and integrated prescribing — with the Prescriber Hub for the non-HCPs you support.",
    points: [
      "Prescriber-grade consultation notes & treatment plans",
      "Photo, social and marketing consent split out properly",
      "Prescriber Hub — support the non-HCPs you work with",
      "Multi-location, multi-practitioner clinics supported",
    ],
  },
  {
    id: "non-hcp",
    tag: "Non-HCPs",
    icon: Sparkles,
    title: "Aesthetics Practitioners, Skin & Other Injectors",
    blurb:
      "Streamlined bookings, medical screening and consent, plus a Prescriber Hub link to refer to the clinicians who cover you.",
    points: [
      "Full medical screening & consent before every appointment",
      "Refer in your prescriber via the Prescriber Hub",
      "Photo consent, aftercare and review periods built in",
      "Look every bit as professional as a full clinic",
    ],
  },
] as const;

function WhoSwitcher() {
  const [tab, setTab] = useState<string>(WHO_TABS[0].id);
  const active = WHO_TABS.find((t) => t.id === tab) ?? WHO_TABS[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {WHO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`border px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 ${
              tab === t.id
                ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--paper)]"
                : "border-[color:var(--hairline)] text-[color:var(--ink-soft)] hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
            }`}
          >
            {t.tag}
          </button>
        ))}
      </div>

      <div
        key={active.id}
        className="mt-6 border border-[color:var(--hairline)] bg-[color:var(--paper)] animate-in fade-in slide-in-from-bottom-2 duration-500"
      >
        <WhoPanel
          tag={active.tag}
          icon={active.icon}
          title={active.title}
          blurb={active.blurb}
          points={[...active.points]}
        />
      </div>
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
    <div className="lift group relative bg-[color:var(--paper)] p-8 hover:bg-[color:var(--secondary)] sm:p-10">
      <Icon className="mb-5 h-5 w-5 text-[color:var(--accent)] transition-transform duration-500 group-hover:-translate-y-0.5" />
      <h3 className="font-display text-xl text-[color:var(--ink)]">{title}</h3>
      <div className="mt-3 h-px w-6 bg-[color:var(--taupe)] transition-all duration-500 group-hover:w-14" />
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
