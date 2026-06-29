import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter, IconTile } from "./index";
import { Syringe, Sparkles, Stethoscope, Users, MapPin, HeartHandshake, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/who-its-for")({
  head: () => ({
    meta: [
      { title: "Who MODO Book is for | Aesthetics-only booking for HCPs & non-HCPs" },
      { name: "description", content: "MODO Book is built for every aesthetics practitioner — Nurse Prescribers, doctors, dentists, pharmacists, therapists and skin specialists — under one safe clinical standard." },
      { property: "og:title", content: "Who MODO Book is for" },
      { property: "og:description", content: "Aesthetics-only software for HCPs and non-HCPs, supporting safer collaborative care." },
    ],
  }),
  component: WhoPage,
});

const personas = [
  {
    icon: Syringe,
    tag: "HCP",
    title: "Nurse Prescribers",
    points: [
      "Full prescribing-grade consultation flow",
      "Batch, expiry and product traceability",
      "Manage non-HCPs you support in the Prescriber Hub",
      "Branded booking page on modo.book/your-clinic",
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
      "Issue prescriptions inside the Prescriber Hub",
      "Audit-trailed sign-off on every batch",
      "Consent-gated patient record sharing",
    ],
  },
  {
    icon: HeartHandshake,
    tag: "Non-HCP",
    title: "Aesthetic Therapists",
    points: [
      "Mandatory medical screening before every appointment",
      "Refer in your prescriber via the Hub",
      "Look as professional as any clinic",
      "Aftercare and review periods automated",
    ],
  },
  {
    icon: Users,
    tag: "Non-HCP",
    title: "Skin Specialists & Beauty Pros",
    points: [
      "Treatment menu, packages and add-ons",
      "Patient-facing concern picker and treatment finder quiz",
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:px-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                One platform for every aesthetics practitioner.
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                MODO Book isn't medics-only. It isn't a salon app. It's built for the whole
                aesthetics industry — HCPs and non-HCPs — under one safer clinical standard.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/auth"><Button size="lg">Start free</Button></Link>
                <Link to="/prescriber-hub"><Button size="lg" variant="outline">Prescriber Hub</Button></Link>
              </div>
            </div>
            <img
              src={hero}
              alt="Practitioner using a branded MODO booking calendar"
              loading="lazy"
              width={1280}
              height={1024}
              className="aspect-[5/4] w-full rounded-3xl object-cover shadow-lg ring-1 ring-black/5"
            />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
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

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">Not sure which fits?</h2>
            <p className="mt-3 text-muted-foreground">Create a free account — switch on what you need, hide what you don't.</p>
            <Link to="/auth"><Button size="lg" className="mt-6">Get started</Button></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
