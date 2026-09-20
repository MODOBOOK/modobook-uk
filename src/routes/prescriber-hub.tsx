import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "./index";
import {
  MarketingPage,
  PageHero,
  SectionHead,
  HairlineGrid,
  GridCard,
  StepRow,
  CtaBand,
  SolidLink,
  OutlineLink,
} from "@/components/marketing-kit";

import {
  ClipboardList, Network, ShieldCheck, Users, FileSignature,
  Stethoscope, Lock, CalendarDays, MapPin, UserPlus, CheckCircle2, Handshake,
} from "lucide-react";

export const Route = createFileRoute("/prescriber-hub")({
  head: () => ({
    meta: [
      { title: "Prescriber Hub | In-Person Prescribing | MODO" },
      { name: "description", content: "Prescribers request days at a practitioner's clinic, patients book those days, and every record, consent and prescription is shared and audited." },
      { property: "og:title", content: "MODO Prescriber Hub" },
      { property: "og:description", content: "In-person prescriber collaboration — request clinic days, share the patient record, prescribe on-site with a full audit trail." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/prescriber-hub" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/prescriber-hub" }],
  }),
  component: HubPage,
});

function HubPage() {
  return (
    <MarketingPage>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="The Prescriber Hub · In person"
          title="Prescribers, on-site."
          accent="Not on WhatsApp."
          blurb="Built for in-person prescribing. Prescribers request days to work at a practitioner's clinic, patients book into those days, and every record, consent and prescription is shared, signed and audited in one place."
        >
          <div className="mt-11 flex flex-col justify-center gap-3 sm:flex-row">
            <SolidLink to="/auth">Create your account</SolidLink>
            <OutlineLink to="/features">See all features</OutlineLink>
          </div>
          <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-[color:var(--ink-soft)]">
            <span className="font-semibold text-[color:var(--ink)]">
              First month free · No card details required.
            </span>{" "}
            The Prescriber Hub is included in every MODO subscription.
          </p>
        </PageHero>

        {/* WHAT IT IS */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHead
              eyebrow="Built for in-person prescribing"
              title="Request the days. Fill the diary. Prescribe on-site."
              blurb="A two-way space for in-person prescriber cover — with the clinical record, consent and audit trail wired in."
            />
            <HairlineGrid>
              <GridCard icon={CalendarDays} title="Request days to work together" desc="Prescribers propose dates and a location to a linked practitioner. The practitioner approves, tweaks, or declines — no calls, no calendars flying about." />
              <GridCard icon={MapPin} title="Clinic-day booking pages" desc="Approved days appear on the practitioner's booking page automatically. Patients book prescriber-required treatments straight into those slots." />
              <GridCard icon={UserPlus} title="Walk-in consults on the day" desc="Add unbooked patients on the fly. The prescriber opens the file, consults, and signs off — the practitioner closes the record after." />
              <GridCard icon={Handshake} title="Multi-practitioner cover" desc="One prescriber can cover many clinics; one practitioner can invite several prescribers. Everyone sees only the patients they're linked to." />
              <GridCard icon={CheckCircle2} title="On-site sign-off & prescriptions" desc="Approve treatment plans, issue prescriptions and sign consents in the room. The record updates for both sides in real time." />
              <GridCard icon={ShieldCheck} title="Consent & audit built in" desc="Every clinic day, patient, view and prescription is logged. Ready to hand to a regulator or insurer at any time." />
            </HairlineGrid>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          className="border-b border-[color:var(--hairline)]"
          style={{ background: "var(--grad-band)" }}
        >
          <div className="mx-auto grid max-w-6xl gap-16 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:px-8">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
                For practitioners
              </div>
              <p className="mt-6 font-display text-3xl leading-tight sm:text-4xl">
                Invite a prescriber, approve their days.
              </p>
              <div className="mt-8">
                <StepRow n={1} title="Link a prescriber" desc="Connect any MODO prescriber to your clinic. Choose which treatments require them on-site." />
                <StepRow n={2} title="Approve their clinic days" desc="When a prescriber requests a day at your location, review it and approve, adjust or decline in one tap." />
                <StepRow n={3} title="Patients book in" desc="Approved days go live on your booking page. Prescriber-required treatments only show slots on those days." />
                <StepRow n={4} title="Run the day together" desc="Consult, treat, sign off. The prescriber can add walk-ins; you close each record afterwards." />
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
                For prescribers
              </div>
              <p className="mt-6 font-display text-3xl leading-tight sm:text-4xl">
                Cover more clinics, without the admin.
              </p>
              <div className="mt-8">
                <StepRow n={1} title="Connect to practitioners" desc="Accept invites from the clinics you cover. Set your travel radius, treatments and rates." />
                <StepRow n={2} title="Request days to work together" desc="Propose the dates and locations you can attend. Practitioners approve them into their diary." />
                <StepRow n={3} title="See the day's list" desc="On the day, open every booked patient — record, photos, consents and history in one screen." />
                <StepRow n={4} title="Prescribe & sign off in person" desc="Approve plans, issue prescriptions and add walk-ins on the spot. Every action is audit-logged." />
              </div>
            </div>
          </div>
        </section>

        {/* SHARED FEATURES */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHead
              eyebrow="Also in the hub"
              title="The clinical layer."
              blurb="What sits underneath every clinic day, for both sides."
            />
            <HairlineGrid>
              <GridCard icon={ClipboardList} title="Shared patient record" desc="Medical form, concerns, consultation notes, photos and consent — visible to both sides." />
              <GridCard icon={FileSignature} title="Collaborative notes" desc="Add notes, decisions and follow-up actions against the patient file. Nothing lost in DMs." />
              <GridCard icon={Users} title="Multi-prescriber & multi-practitioner" desc="Prescribers can support many practitioners. Practitioners can invite several prescribers." />
              <GridCard icon={Lock} title="Full audit trail" desc="Every view, edit and prescription decision is logged — encrypted at rest, hosted in the UK/EU." />
              <GridCard icon={Stethoscope} title="Prescription workflow" desc="Prescriber approves and issues on-site — the practitioner sees the plan and executes with confidence." />
              <GridCard icon={Network} title="Consent-gated sharing" desc="Patients consent to record sharing at booking. It can be withdrawn or exported at any time." />
            </HairlineGrid>
          </div>
        </section>

        <CtaBand
          title="Join the Hub today."
          blurb="MODO is open to every UK aesthetics practitioner and prescriber — create your account and you're set up in minutes. First month free, cancel anytime."
        />
      </main>
      <SiteFooter />
    </MarketingPage>
  );
}
