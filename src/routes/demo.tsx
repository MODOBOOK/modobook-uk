import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarCheck, ExternalLink, HeartPulse, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "./index";
import { startPublicDemo } from "@/lib/demo-public.functions";

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
        <section className="mx-auto max-w-5xl px-6 pb-6 pt-16 sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hairline)] bg-white px-3 py-1 text-xs font-medium text-[color:var(--ink-soft)]">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Live sandbox · no sign-up
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-5xl">
            Take MODO for a test drive
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--ink-soft)] sm:text-lg">
            This is a fully populated demo clinic — real treatments, patients, consultations, consent forms and
            bookings. Click in, click around, break whatever you like. Everything resets overnight and no emails or
            payments ever leave the sandbox.
          </p>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-4 sm:grid-cols-2">
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
        </section>

        <section className="mx-auto max-w-5xl px-6 py-8">
          <div className="rounded-2xl border border-[color:var(--hairline)] bg-white p-6">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Just want to see the booking page?</h2>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              The customer-facing booking page needs no sign-in at all — this is the link a clinic shares with its
              clients.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
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
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--muted)] p-6">
            <p className="flex items-start gap-3 text-sm text-[color:var(--ink-soft)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
              <span>
                The demo is shared by everyone who visits this page, so please don't store anything personal or real in
                it. All patient details are fictional, outbound email and SMS are disabled, and the clinic is wiped and
                rebuilt every night.
              </span>
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button className="rounded-full bg-[color:var(--ink)] px-6 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90">
                  Create your account
                </Button>
              </Link>
              <Link to="/pricing">
                <Button
                  variant="outline"
                  className="rounded-full border-[color:var(--hairline)] bg-white px-6 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--muted)]"
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
    <div className="flex flex-col rounded-2xl border border-[color:var(--hairline)] bg-white p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--muted)]">{icon}</div>
      <h2 className="mt-4 text-lg font-semibold text-[color:var(--ink)]">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--ink-soft)]">{blurb}</p>
      <Button
        onClick={onClick}
        disabled={disabled}
        className="mt-5 w-full rounded-full bg-[color:var(--ink)] text-sm font-medium text-white hover:bg-[color:var(--ink)]/90"
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
