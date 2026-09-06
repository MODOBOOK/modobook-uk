import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowUpRight, CalendarCheck, ExternalLink, HeartPulse, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "./index";
import { startPublicDemo } from "@/lib/demo-public.functions";
import consultationHero from "@/assets/modo-consultation-hero.jpeg.asset.json";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Try the MODO demo clinic | Aesthetics booking & records" },
      {
        name: "description",
        content:
          "Explore MODO with a fully populated demo clinic — practitioner dashboard, patient account and public booking page. No sign-up, no card, resets nightly.",
      },
      { property: "og:title", content: "Try the MODO demo clinic" },
      {
        property: "og:description",
        content:
          "A live sandbox of MODO: bookings, medical records, consent, payments and the patient portal. No sign-up needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const launch = useServerFn(startPublicDemo);
  const [busy, setBusy] = useState<null | "practitioner" | "patient">(null);

  async function open(role: "practitioner" | "patient") {
    setBusy(role);
    try {
      const r = await launch({ data: { role, origin: window.location.origin } });
      window.location.href = r.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the demo");
      setBusy(null);
    }
  }

  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-16 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="eyebrow">Live sandbox · no sign-up</div>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-[color:var(--ink)] sm:text-6xl">
                Take MODO for a <span className="gold-underline">test drive</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
                A fully populated demo clinic — real treatments, patients, consultations, consent forms and
                bookings. Click in, click around, break whatever you like. Everything resets overnight and no
                emails or payments ever leave the sandbox.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-[color:var(--ink-soft)]">
                <span className="inline-flex items-center gap-2">
                  <span className="pulse-dot" /> Live right now
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--accent)]" /> Resets nightly
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[color:var(--accent)]" /> No card required
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)] shadow-xl shadow-[color:var(--ink)]/10">
                <img
                  src={consultationHero.url}
                  alt="A practitioner consulting with a patient inside the MODO demo clinic"
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-5 -left-5 hidden tile px-4 sm:px-6 py-4 shadow-lg backdrop-blur sm:block">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">MODO Demo Clinic</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">Seeded with a real clinic workflow</p>
              </div>
            </div>
          </div>
        </section>

        {/* Launch cards */}
        <section className="mx-auto max-w-6xl px-6 pb-6">
          <div className="eyebrow mb-5">§ Pick a door</div>
          <div className="grid gap-5 sm:grid-cols-2">
            <DemoCard
              icon={<CalendarCheck className="h-5 w-5 text-[color:var(--accent)]" />}
              title="Practitioner dashboard"
              blurb="The clinic side: diary, patient records, consultations, face mapping, consent, payments, marketing and reporting."
              cta="Open the dashboard"
              loading={busy === "practitioner"}
              disabled={busy !== null}
              onClick={() => open("practitioner")}
            />
            <DemoCard
              icon={<HeartPulse className="h-5 w-5 text-[color:var(--accent)]" />}
              title="Patient account"
              blurb="What your clients see: their appointments, treatment history, medical forms, reward points and gift cards."
              cta="Open the patient view"
              loading={busy === "patient"}
              disabled={busy !== null}
              onClick={() => open("patient")}
            />
          </div>
        </section>

        {/* Booking page shortcut */}
        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="tile p-7 shadow-sm sm:p-9">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="text-xl font-semibold text-[color:var(--ink)]">Just want to see the booking page?</h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  The customer-facing booking page needs no sign-in at all — this is the link a clinic shares with
                  its clients.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/m/demo-clinic" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="outline"
                    className="rounded-full border-[color:var(--hairline)] bg-white text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)]"
                  >
                    Demo booking page <ExternalLink className="ml-1 h-4 w-4" />
                  </Button>
                </a>
                <a href="https://modobook.uk/m/aestheticsbynurseryan" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="outline"
                    className="rounded-full border-[color:var(--hairline)] bg-white text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)]"
                  >
                    A real live clinic <ExternalLink className="ml-1 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Reassurance + CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl border border-[color:var(--hairline)] bg-[color:var(--muted)] p-7 sm:p-9">
            <p className="flex items-start gap-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
              <span>
                The demo is shared by everyone who visits this page, so please don't store anything personal or real
                in it. All patient details are fictional, outbound email and SMS are disabled, and the clinic is
                wiped and rebuilt every night.
              </span>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button className="rounded-full bg-[color:var(--ink)] px-7 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90">
                  Create your account
                </Button>
              </Link>
              <Link to="/pricing">
                <Button
                  variant="outline"
                  className="rounded-full border-[color:var(--hairline)] bg-white px-7 text-sm font-medium text-[color:var(--ink)] hover:bg-white/80"
                >
                  See pricing <ArrowRight className="ml-1 h-4 w-4" />
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

function DemoCard({
  icon,
  title,
  blurb,
  cta,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  cta: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="group flex flex-col tile p-7 shadow-sm transition-shadow hover:shadow-lg hover:shadow-[color:var(--ink)]/5 sm:p-8">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--muted)]">{icon}</div>
        <ArrowUpRight className="h-5 w-5 text-[color:var(--ink-soft)] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-[color:var(--ink)]">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--ink-soft)]">{blurb}</p>
      <Button
        onClick={onClick}
        disabled={disabled}
        className="mt-6 w-full rounded-full bg-[color:var(--ink)] text-sm font-medium text-white hover:bg-[color:var(--ink)]/90"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening demo…
          </>
        ) : (
          <>
            {cta} <ArrowRight className="ml-1 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
