import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowUpRight, CalendarCheck, HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "./index";
import { startPublicDemo } from "@/lib/demo-public.functions";
import {
  MarketingPage,
  PageHero,
  SectionHead,
  HairlineGrid,
  Reveal,
  CtaBand,
} from "@/components/marketing-kit";

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
      { property: "og:url", content: "https://modobook.uk/demo" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/demo" }],
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
    <MarketingPage>
      <SiteHeader />

      <main className="flex-1">
        <PageHero
          eyebrow="Live demo · no sign-up"
          title="Take MODO for"
          accent="a test drive."
          blurb="Experience MODO exactly as your clinic would- Step inside a fully interactive demo and experience the platform for yourself. Explore appointments, client records, consultations, consent forms and more — with complete freedom to look around."
        >
          <div className="mt-9 flex flex-wrap items-center justify-center gap-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
            <span>No sign-up. No commitment. Simply explore</span>
          </div>
        </PageHero>

        {/* Launch cards */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <SectionHead
              eyebrow="INSIDE MODO"
              title="See MODO from both sides."
              blurb="Experience the platform from your clinic's perspective - and your clients'."
            />
            <HairlineGrid cols={2}>
              <DemoCard
                icon={CalendarCheck}
                title="Practitioner dashboard"
                blurb="Everything behind your clinic - appointments, client records, consultations, face mapping, consent, payments and marketing."
                cta="Explore the dashboard"
                loading={busy === "practitioner"}
                disabled={busy !== null}
                onClick={() => open("practitioner")}
              />
              <DemoCard
                icon={HeartPulse}
                title="Client experience"
                blurb="See MODO as your clients do - appointments, treatment history, medical forms, rewards and gift cards."
                cta="Explore the client view"
                loading={busy === "patient"}
                disabled={busy !== null}
                onClick={() => open("patient")}
              />
            </HairlineGrid>
            <Reveal>
              <p className="mx-auto mt-10 flex max-w-xl items-start gap-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                <span>
                  The demo is shared by everyone who visits this page, so please don't store
                  anything personal or real in it. All patient details are fictional, outbound email
                  and text messages are switched off, and the clinic is wiped and rebuilt every night.
                </span>
              </p>
            </Reveal>
          </div>
        </section>


        <CtaBand />

      </main>

      <SiteFooter />
    </MarketingPage>
  );
}

function DemoCard({
  icon: Icon,
  title,
  blurb,
  cta,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  cta: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="lift group flex flex-col bg-[color:var(--paper)] p-8 hover:bg-[color:var(--secondary)] sm:p-10">
      <div className="flex items-start justify-between">
        <Icon className="h-5 w-5 text-[color:var(--accent)]" />
        <ArrowUpRight className="h-5 w-5 text-[color:var(--taupe)] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <h3 className="mt-5 font-display text-xl text-[color:var(--ink)]">{title}</h3>
      <div className="mt-3 h-px w-6 bg-[color:var(--taupe)] transition-all duration-500 group-hover:w-14" />
      <p className="mt-3 flex-1 text-sm leading-relaxed text-[color:var(--ink-soft)]">{blurb}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-8 inline-flex h-14 items-center justify-center bg-[color:var(--ink)] px-8 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-colors hover:bg-[color:var(--accent)] disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening demo…
          </>
        ) : (
          <>
            {cta} <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}
