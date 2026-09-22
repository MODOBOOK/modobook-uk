import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/* Shared building blocks so every marketing page shares the homepage look:
   Instrument Serif headings, hairline grids, square edges, soft gradients. */

export function Reveal({
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

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div
      className="modo-marketing flex min-h-screen flex-col text-[color:var(--ink)]"
      style={{ background: "var(--grad-page)" }}
    >
      {children}
    </div>
  );
}

export function SolidLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-14 items-center justify-center bg-[color:var(--ink)] px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-colors hover:bg-[color:var(--accent)]"
    >
      {children}
    </Link>
  );
}

export function OutlineLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-14 items-center justify-center border border-[color:var(--ink)] px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)]"
    >
      {children}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  accent,
  blurb,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  blurb: string;
  children?: ReactNode;
}) {
  return (
    <header
      className="border-b border-[color:var(--hairline)]"
      style={{ background: "var(--grad-hero)" }}
    >
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[color:var(--accent)]">
            {eyebrow}
          </div>
        </Reveal>
        <Reveal delay={90}>
          <h1 className="mt-7 font-display text-[color:var(--ink)]">
            {title}
            {accent ? (
              <>
                <br />
                <span className="italic text-[color:var(--ink-soft)]">{accent}</span>
              </>
            ) : null}
          </h1>
        </Reveal>
        <Reveal delay={180}>
          <p className="mx-auto mt-8 max-w-xl text-base font-light leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
            {blurb}
          </p>
        </Reveal>
        {children ? <Reveal delay={260}>{children}</Reveal> : null}
      </div>
    </header>
  );
}

export function SectionHead({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
}) {
  return (
    <Reveal>
      <div className="mx-auto mb-14 max-w-xl text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
          {eyebrow}
        </div>
        <p className="mt-6 font-display text-3xl leading-tight text-[color:var(--ink)] sm:text-4xl">
          {title}
        </p>
        {blurb ? (
          <p className="mt-5 text-sm leading-relaxed text-[color:var(--ink-soft)]">{blurb}</p>
        ) : null}
      </div>
    </Reveal>
  );
}

export function HairlineGrid({
  children,
  cols = 3,
}: {
  children: ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-px bg-[color:var(--hairline)] sm:grid-cols-2 ${
        cols === 3 ? "lg:grid-cols-3" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function GridCard({
  icon: Icon,
  title,
  desc,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="lift group relative bg-[color:var(--paper)] p-8 hover:bg-[color:var(--secondary)] sm:p-10">
      {Icon ? (
        <Icon className="mb-5 h-5 w-5 text-[color:var(--accent)] transition-transform duration-500 group-hover:-translate-y-0.5" />
      ) : null}
      <h3 className="font-display text-xl text-[color:var(--ink)]">{title}</h3>
      <div className="mt-3 h-px w-6 bg-[color:var(--taupe)] transition-all duration-500 group-hover:w-14" />
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">{desc}</p>
    </div>
  );
}

export function StepRow({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-5 border-b border-[color:var(--hairline)] py-6 last:border-b-0">
      <div className="font-display text-2xl text-[color:var(--taupe)]">
        {String(n).padStart(2, "0")}
      </div>
      <div>
        <div className="font-display text-lg text-[color:var(--ink)]">{title}</div>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-soft)]">{desc}</p>
      </div>
    </div>
  );
}

/** The single, accurate closing call-to-action used on every marketing page. */
export function CtaBand({
  title = "Start your first month free.",
  blurb = "MODO is open to every UK aesthetics practitioner today. No waitlist, no card details, no booking fees. Cancel anytime.",
}: {
  title?: string;
  blurb?: string;
}) {
  return (
    <section className="bg-[color:var(--ink)] text-[color:var(--paper)]">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--taupe)]">
            Open now
          </div>
          <p className="mt-6 font-display text-4xl leading-tight sm:text-5xl">{title}</p>
          <p className="mx-auto mt-5 max-w-md text-sm text-[color:var(--paper)]/70">{blurb}</p>
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
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="link-underline group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
