import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter } from "./index";
import tabletPlatform from "@/assets/modo-tablet-platform.png.asset.json";
import tabletBooking from "@/assets/modo-tablet-booking.png.asset.json";
import consultationPhoto from "@/assets/modo-consultation.png.asset.json";

import {
  Palette, Link2, Calendar, ClipboardList, FileSignature, Camera, Users,
  Layers, CreditCard, Bell, MessageSquare, ShieldCheck, Sparkles, Stethoscope,
  Pill, MapPin, Star, BarChart3, Brush, FileText, Image as ImageIcon, Wallet,
  CalendarClock, Smartphone, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features | Aesthetics Clinic Software | MODO" },
      { name: "description", content: "Every MODO feature: branded booking pages, consultations, consent, face mapping, photos, payments, Klarna, Clearpay, marketing and multi-practitioner clinics." },
      { property: "og:title", content: "MODO — Features" },
      { property: "og:description", content: "The full feature list of MODO, the UK aesthetics-only booking and clinical platform." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/features" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/features" }],
  }),
  component: FeaturesPage,
});

const groups = [
  {
    title: "Your branded booking page",
    icon: Palette,
    items: [
      { icon: Palette, title: "Custom branding", desc: "Six curated palettes, build-your-own colour scheme, fonts, logo, tab icon and welcome card." },
      { icon: Link2, title: "Your MODO link", desc: "Share modo.app/your-clinic on Instagram, TikTok, Google and your website." },
      { icon: Brush, title: "Hero & carousel", desc: "Classic single hero or rotating carousel. Crop on upload, mobile-friendly." },
      { icon: ImageIcon, title: "Favourite treatments", desc: "Showcase your or your clinic's most popular treatments in a horizontal carousel." },
      { icon: FileText, title: "Editable welcome intro", desc: "A clean patient-facing intro block with a heading, rich text, contact details and your clinic style." },
    ],
  },
  {
    title: "Booking & calendar",
    icon: Calendar,
    items: [
      { icon: CalendarClock, title: "Smart availability", desc: "Weekly rules, ad-hoc rota, lead times, daily caps and per-treatment buffers." },
      { icon: Sparkles, title: "Model slots", desc: "Open up discounted windows for model patients. Optional fixed date/time." },
      { icon: MapPin, title: "Multi-location & practitioners", desc: "Patients choose location and practitioner, or let MODO auto-assign first-available." },
      { icon: Star, title: "Concern picker", desc: "Patients browse by concern as well as treatment menu." },
      { icon: Layers, title: "Packages & multi-session", desc: "Bundles, courses, top-ups, add-ons and split payments — all native." },
    ],
  },
  {
    title: "Consultations & clinical records",
    icon: Stethoscope,
    items: [
      { icon: ClipboardList, title: "8-step consultation flow", desc: "Medical history → concerns → assessment → plan → consent → photos → batch numbers → invoice." },
      { icon: Camera, title: "Face mapping", desc: "Pin-drop product tags with units, drawing tool, realistic face or patient photo background." },
      { icon: ImageIcon, title: "Before & after photos", desc: "Captured per session, attached to the patient record, never to the camera roll." },
      { icon: FileSignature, title: "Consent & medical forms", desc: "Drag-and-drop builder, photo/social media consent split out, e-signature, auto-filing." },
      { icon: Users, title: "Patient profiles", desc: "Allergies flagged, history, concerns, photos, forms and comms timeline in one place." },
      { icon: Pill, title: "Batch & expiry", desc: "Record products used per session for traceability and audits." },
    ],
  },
  {
    title: "Payments & policies",
    icon: CreditCard,
    items: [
      { icon: Wallet, title: "Card, deposit or pay-in-clinic", desc: "Pick your mix. Deposits are required when enabled — no half-confirmed bookings." },
      { icon: CreditCard, title: "Klarna & Clearpay", desc: "Buy-now-pay-later checkout. Fees can be passed to the patient automatically." },
      { icon: ShieldCheck, title: "Cancellation rules", desc: "Tiered fee bands (e.g. 50% within 24h, 25% within 48h). Auto-charge if allowed." },
      { icon: BarChart3, title: "Discounts & promo codes", desc: "Stackable or exclusive, time-limited, treatment-specific, day-of-week rules." },
    ],
  },
  {
    title: "Communication & marketing",
    icon: MessageSquare,
    items: [
      { icon: Bell, title: "Reminders", desc: "Email, SMS and WhatsApp confirmations and reminders at the hours you set." },
      { icon: MessageSquare, title: "Aftercare", desc: "Per-treatment aftercare sent automatically X hours after the appointment." },
      { icon: Star, title: "Reviews", desc: "Patient review collection and moderation built in." },
      { icon: Smartphone, title: "Mobile-first patient flow", desc: "The booking page is built mobile-first — no app to download." },
    ],
  },
];

function FeaturesPage() {
  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-5xl px-5 pt-14 pb-8 text-center lg:px-8">
          <div className="eyebrow">§ The platform</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Every feature in MODO.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[color:var(--ink-soft)] sm:text-lg">
            The booking, consultation, clinical and marketing stack — built only for aesthetics, for HCPs and non-HCPs alike.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/auth"><Button size="lg" className="w-full rounded-full bg-[color:var(--ink)] px-8 text-sm text-white hover:bg-[color:var(--ink)]/90 sm:w-auto">Create your account</Button></Link>
            <Link to="/prescriber-hub"><Button size="lg" variant="outline" className="w-full rounded-full border-[color:var(--hairline)] bg-white px-8 text-sm sm:w-auto">Prescriber Hub</Button></Link>
          </div>
        </section>

        {/* HERO PHOTO STRIP */}
        <section className="mx-auto max-w-7xl px-5 pb-8 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3 sm:h-[460px] lg:h-[540px]">
            <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-white sm:col-span-2">
              <img src={tabletBooking.url} alt="MODO booking on tablet" className="h-full max-sm:aspect-[16/10] w-full object-cover object-center" loading="lazy" />
            </div>
            <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-white">
              <img src={consultationPhoto.url} alt="Practitioner using MODO on a tablet" className="h-full max-sm:aspect-[16/10] w-full object-cover object-center" loading="lazy" />
            </div>
          </div>
        </section>



        {groups.map((g) => (
          <section key={g.title} className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <g.icon className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{g.title}</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((it) => (
                <Card key={it.title}>
                  <CardHeader>
                    <it.icon className="mb-2 h-6 w-6 text-primary" />
                    <CardTitle className="text-lg">{it.title}</CardTitle>
                    <CardDescription>{it.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <section className="mx-auto max-w-7xl px-5 pb-10 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)]">
            <img src={tabletPlatform.url} alt="MODO clinical platform" className="aspect-[21/9] w-full object-cover" style={{ objectPosition: "50% 30%" }} loading="lazy" />
          </div>
        </section>

        <section className="border-t border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center lg:px-8">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[color:var(--accent)]" />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Want in at launch?</h2>
            <p className="mt-3 text-[color:var(--ink-soft)]">MODO is rolling out to founding clinics over the next few weeks. Create your account and we'll email you as soon as your account is ready.</p>
            <Link to="/auth"><Button size="lg" className="mt-6 rounded-full bg-[color:var(--ink)] px-8 text-white hover:bg-[color:var(--ink)]/90">Create your account</Button></Link>

          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
