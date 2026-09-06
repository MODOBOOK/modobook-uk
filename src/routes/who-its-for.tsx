import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter } from "./index";
import foundersSuits from "@/assets/modo-founders-scrubs.png.asset.json";
import builtForPhoto from "@/assets/modo-built-for.png.asset.json";

import { Syringe, Sparkles, Stethoscope, Users, MapPin, HeartHandshake, CheckCircle2 } from "lucide-react";

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
      "Manage non-HCPs you support in the Prescriber Hub",
      "Branded booking page on modo.app/your-clinic",
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
      "Refer in your prescriber via the Hub",
      "Photo consent, aftercare and review periods built in",
      "Look as professional as any clinic",
    ],
  },
  {
    icon: Users,
    tag: "Non-HCP",
    title: "Skin Injectors & Other Injectors",
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
      "Map-pin face mapping and photos on iPad",
    ],
  },
];

function WhoPage() {
  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />
      <main>
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
            <div>
              <div className="eyebrow">§ Who it's for</div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                One platform for every aesthetics practitioner.
              </h1>
              <p className="mt-5 max-w-lg text-base text-[color:var(--ink-soft)] sm:text-lg">
                MODO isn't medics-only. It isn't a salon app. It's built for the whole
                aesthetics industry — HCPs and non-HCPs — under one safer clinical standard.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link to="/auth"><Button size="lg" className="w-full rounded-full bg-[color:var(--ink)] px-8 text-white hover:bg-[color:var(--ink)]/90 sm:w-auto">Create your account</Button></Link>
                <Link to="/prescriber-hub"><Button size="lg" variant="outline" className="w-full rounded-full border-[color:var(--hairline)] bg-white px-8 sm:w-auto">Prescriber Hub</Button></Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)]">
              <img src={foundersSuits.url} alt="MODO founders" className="aspect-[3/4] w-full object-cover object-top" loading="lazy" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 lg:px-8">

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((p) => (
              <Card key={p.title} className="h-full">
                <CardHeader>
                  <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <p.icon className="h-3.5 w-3.5" /> {p.tag}
                  </div>
                  <CardTitle>{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-4 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)]">
            <img src={builtForPhoto.url} alt="Built exclusively for aesthetics" className="aspect-[21/9] w-full object-cover" loading="lazy" />
          </div>
        </section>

        <section className="border-t border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16 text-center lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to join MODO?</h2>
            <p className="mt-3 text-[color:var(--ink-soft)]">We're opening up to founding clinics over the next few weeks. Create your account and we'll be in touch as soon as your account is ready.</p>
            <Link to="/auth"><Button size="lg" className="mt-6 rounded-full bg-[color:var(--ink)] px-8 text-white hover:bg-[color:var(--ink)]/90">Create your account</Button></Link>

          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
