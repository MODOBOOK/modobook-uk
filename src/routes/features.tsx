import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "./index";
import {
  MarketingPage,
  PageHero,
  SectionHead,
  HairlineGrid,
  GridCard,
  CtaBand,
  SolidLink,
  OutlineLink,
} from "@/components/marketing-kit";

import {
  Palette, Link2, Calendar, ClipboardList, FileSignature, Camera, Users,
  Layers, CreditCard, Bell, MessageSquare, ShieldCheck, Sparkles, Stethoscope,
  Pill, MapPin, Star, BarChart3, Brush, FileText, Image as ImageIcon, Wallet,
  CalendarClock, Smartphone, Network, Bot,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features | Aesthetics Clinic Software | MODO" },
      { name: "description", content: "Every MODO feature: branded booking pages, consultations, consent, face mapping, built-in AI, payments, Klarna, Clearpay, the prescriber hub and multi-practitioner clinics." },
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
    eyebrow: "Your front door",
    items: [
      { icon: Palette, title: "Custom branding", desc: "Six curated palettes, build-your-own colour scheme, fonts, logo, tab icon and welcome card." },
      { icon: Link2, title: "Your MODO link", desc: "Share modobook.uk/m/your-clinic on Instagram, TikTok, Google and your website." },
      { icon: Brush, title: "Hero & carousel", desc: "Classic single hero or rotating carousel. Crop on upload, mobile-friendly." },
      { icon: ImageIcon, title: "Favourite treatments", desc: "Showcase your clinic's most popular treatments in a horizontal carousel." },
      { icon: FileText, title: "Editable welcome intro", desc: "A clean patient-facing intro block with a heading, rich text, contact details and your clinic style." },
      { icon: Smartphone, title: "Mobile-first patient flow", desc: "The booking page is built mobile-first — no app for your patients to download." },
    ],
  },
  {
    title: "Booking & calendar",
    eyebrow: "The diary",
    items: [
      { icon: CalendarClock, title: "Smart availability", desc: "Weekly rules, ad-hoc rota, lead times, daily caps and per-treatment buffers." },
      { icon: Calendar, title: "Scheduled availability", desc: "Open up a day now and set it to go live to patients later — you can still book people in yourself." },
      { icon: Sparkles, title: "Model slots", desc: "Open up discounted windows for model patients. Optional fixed date and time." },
      { icon: MapPin, title: "Multi-location & practitioners", desc: "Patients choose location and practitioner, or let MODO auto-assign first-available." },
      { icon: Star, title: "Concern picker", desc: "Patients browse by concern as well as by treatment menu." },
      { icon: Layers, title: "Packages & multi-session", desc: "Bundles, courses, top-ups, add-ons and split payments — all native." },
    ],
  },
  {
    title: "Consultations & clinical records",
    eyebrow: "The clinical layer",
    items: [
      { icon: ClipboardList, title: "8-step consultation flow", desc: "Medical history, concerns, assessment, plan, consent, photos, batch numbers and invoice." },
      { icon: Camera, title: "Face mapping", desc: "Pin-drop product tags with units, drawing tool, realistic face or patient photo background." },
      { icon: ImageIcon, title: "Before & after photos", desc: "Captured per session, attached to the patient record, never to the camera roll." },
      { icon: FileSignature, title: "Consent & medical forms", desc: "Drag-and-drop builder, drawn signatures, photo and social media consent split out, auto-filing." },
      { icon: Users, title: "Patient profiles", desc: "Allergies flagged, history, concerns, photos, forms and comms timeline in one place." },
      { icon: Pill, title: "Batch & expiry", desc: "Record products used per session for traceability and audits." },
    ],
  },
  {
    title: "Built-in AI",
    eyebrow: "What makes MODO different",
    items: [
      { icon: Bot, title: "AI treatment descriptions", desc: "Write patient-ready treatment copy for your menu in seconds, in your own tone." },
      { icon: FileSignature, title: "AI consent & medical forms", desc: "Describe the treatment and MODO drafts the form — then edit anything before you publish it." },
      { icon: MessageSquare, title: "AI aftercare", desc: "Aftercare instructions written per treatment and sent automatically after the visit." },
      { icon: Network, title: "Prescriber Hub", desc: "A shared, traceable prescribing record — clinic days, requests, notes and batch numbers in one place." },
    ],
  },
  {
    title: "Payments & policies",
    eyebrow: "Getting paid",
    items: [
      { icon: Wallet, title: "Deposits, full payment or pay-in-clinic", desc: "Pick your mix per treatment, including a £0 deposit where you'd rather take nothing up front." },
      { icon: CreditCard, title: "Buy now, pay later", desc: "Klarna and Clearpay at checkout. Fees can be passed to the patient automatically." },
      { icon: ShieldCheck, title: "Card capture & cancellation rules", desc: "Hold a card on file and set tiered fee bands — e.g. 50% within 24h, 25% within 48h." },
      { icon: BarChart3, title: "Discounts & promo codes", desc: "Stackable or exclusive, time-limited, treatment-specific, day-of-week rules." },
      { icon: Users, title: "Staff payouts & commission", desc: "Pay into the clinic account or a team member's own account, with commission tracked per booking." },
      { icon: CreditCard, title: "0% booking fees", desc: "MODO never takes a cut of your treatment revenue — only your monthly subscription." },
    ],
  },
  {
    title: "Communication & growth",
    eyebrow: "Keeping patients close",
    items: [
      { icon: Bell, title: "Reminders", desc: "Email and text confirmations and reminders at the hours you set, with the practitioner's name included." },
      { icon: MessageSquare, title: "Aftercare", desc: "Per-treatment aftercare sent automatically a set number of hours after the appointment." },
      { icon: Star, title: "Reviews", desc: "Patient review collection and moderation built in." },
      { icon: Stethoscope, title: "Clinic compliance", desc: "Checks, audits and a notes board for your clinic — switch it on only if you want it." },
      { icon: BarChart3, title: "Marketing & automations", desc: "Segmented campaigns, birthday emails, top-up reminders and win-backs with unsubscribes handled." },
      { icon: Sparkles, title: "Rewards & referrals", desc: "Referral codes, loyalty points and reward tiers — fully optional and controlled by you." },
    ],
  },
];

function FeaturesPage() {
  return (
    <MarketingPage>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="The platform"
          title="Every feature,"
          accent="considered."
          blurb="The booking, consultation, clinical, payment and marketing stack — built only for aesthetics, for HCPs and non-HCPs alike."
        >
          <div className="mt-11 flex flex-col justify-center gap-3 sm:flex-row">
            <SolidLink to="/auth">Create your account</SolidLink>
            <OutlineLink to="/demo">Explore the demo</OutlineLink>
          </div>
        </PageHero>

        {groups.map((g, gi) => (
          <section
            key={g.title}
            className="border-b border-[color:var(--hairline)]"
            style={gi % 2 === 1 ? { background: "var(--grad-band)" } : undefined}
          >
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
              <SectionHead eyebrow={g.eyebrow} title={g.title} />
              <HairlineGrid>
                {g.items.map((it) => (
                  <GridCard key={it.title} icon={it.icon} title={it.title} desc={it.desc} />
                ))}
              </HairlineGrid>
            </div>
          </section>
        ))}

        <CtaBand />
      </main>
      <SiteFooter />
    </MarketingPage>
  );
}
