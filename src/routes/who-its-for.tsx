import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "./index";
import {
  MarketingPage,
  PageHero,
  SectionHead,
  HairlineGrid,
  Reveal,
  CtaBand,
  SolidLink,
  OutlineLink,
} from "@/components/marketing-kit";

import { Syringe, Sparkles, Stethoscope, Users, MapPin, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/who-its-for")({
  head: () => ({
    meta: [
      { title: "Who MODO Is For | Aesthetics Practitioners" },
      { name: "description", content: "Built for every aesthetics practitioner — nurse prescribers, doctors, dentists, pharmacists and therapists — under one safe clinical standard." },
      { property: "og:title", content: "Who MODO is for" },
      { property: "og:description", content: "Aesthetics-only software for HCPs and non-HCPs, supporting safer collaborative care." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/who-its-for" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/who-its-for" }],
  }),
  component: WhoPage,
});

const personas = [
  {
    icon: Stethoscope,
    tag: "HCP",
    title: "Nurses & Nurse Prescribers",
    points: [
      "Full prescribing-grade consultation flow",
      "Product log and treatment plans against every visit",
      "Support non-HCPs you cover in the Prescriber Hub",
      "Branded booking page on your own MODO link",
    ],
  },
  {
    icon: Stethoscope,
    tag: "HCP",
    title: "Doctors & Dentists",
    points: [
      "Solo or multi-practitioner clinics supported",
      "Photo, social media and marketing consent split out",
      "Patient records that meet clinical standards",
      "Multi-location with per-site addresses and hours",
    ],
  },
  {
    icon: Sparkles,
    tag: "HCP",
    title: "Pharmacist Prescribers",
    points: [
      "Run a clinic alongside dispensing",
      "Collaborate with practitioners in the Prescriber Hub",
      "Shared, consent-gated patient records",
      "Audit-trailed access on every patient file",
    ],
  },
  {
    icon: HeartHandshake,
    tag: "HCP",
    title: "Paramedics & Midwives",
    points: [
      "Aesthetics-only clinical workflow built for HCPs",
      "Multi-location and travel days supported",
      "Consent, medical screening and aftercare automated",
      "Connect a prescriber via the Hub",
    ],
  },
  {
    icon: Syringe,
    tag: "Non-HCP",
    title: "Aesthetics Practitioners",
    points: [
      "Mandatory medical screening before every appointment",
      "Bring your prescriber in via the Hub",
      "Photo consent, aftercare and review periods built in",
      "Look as professional as any clinic",
    ],
  },
  {
    icon: Users,
    tag: "Non-HCP",
    title: "Skin & Other Injectors",
    points: [
      "Treatment menu, packages and add-ons",
      "Patient-facing concern picker and treatment menu",
      "Photo consent broken down by use case",
      "Mobile-first patient flow — no app to download",
    ],
  },
  {
    icon: MapPin,
    tag: "Mobile",
    title: "Mobile & home-visit aesthetics",
    points: [
      "Multiple locations and travel days",
      "Take deposits to protect your time",
      "Consent and forms completed before arrival",
      "Face mapping and photos on your iPad",
    ],
  },
];

function WhoPage() {
  return (
    <MarketingPage>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Who it's for"
          title="One platform for every"
          accent="aesthetics practitioner."
          blurb="MODO isn't medics-only, and it isn't a salon app. It's built for the whole aesthetics industry — HCPs and non-HCPs — under one safer clinical standard."
        >
          <div className="mt-11 flex flex-col justify-center gap-3 sm:flex-row">
            <SolidLink to="/auth">Create your account</SolidLink>
            <OutlineLink to="/prescriber-hub">Prescriber Hub</OutlineLink>
          </div>
        </PageHero>

        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHead
              eyebrow="The industry, covered"
              title="Whoever you are in aesthetics, MODO fits."
            />
            <HairlineGrid>
              {personas.map((p) => (
                <div
                  key={p.title}
                  className="lift group bg-[color:var(--paper)] p-8 hover:bg-[color:var(--secondary)] sm:p-10"
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                    <p.icon className="h-4 w-4" /> {p.tag}
                  </div>
                  <h3 className="mt-4 font-display text-xl text-[color:var(--ink)]">{p.title}</h3>
                  <div className="mt-3 h-px w-6 bg-[color:var(--taupe)] transition-all duration-500 group-hover:w-14" />
                  <ul className="mt-4 space-y-3">
                    {p.points.map((pt) => (
                      <li
                        key={pt}
                        className="flex items-start gap-3 text-sm leading-relaxed text-[color:var(--ink-soft)]"
                      >
                        <span className="mt-2 h-px w-4 shrink-0 bg-[color:var(--taupe)]" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </HairlineGrid>
          </div>
        </section>

        <section
          className="border-b border-[color:var(--hairline)]"
          style={{ background: "var(--grad-band)" }}
        >
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
            <Reveal>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
                One standard
              </div>
              <p className="mt-6 font-display text-3xl leading-tight sm:text-4xl">
                Safer care, whoever holds the needle.
              </p>
              <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-[color:var(--ink-soft)]">
                Medical screening, consent, photographs, aftercare and a traceable product log come
                as standard on every MODO account — so the same clinical standard runs through the
                whole industry, not just part of it.
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
