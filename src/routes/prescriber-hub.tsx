import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter } from "./index";
import consultationPhoto from "@/assets/modo-consultation.png.asset.json";

import {
  ClipboardList, Network, ShieldCheck, Users, FileSignature,
  Stethoscope, Lock, ArrowRight, CalendarDays, MapPin, UserPlus, CheckCircle2, Handshake,
} from "lucide-react";

export const Route = createFileRoute("/prescriber-hub")({
  head: () => ({
    meta: [
      { title: "Prescriber Hub | MODO — in-person prescriber collaboration" },
      { name: "description", content: "The MODO Prescriber Hub is built for in-person prescribing — prescribers request days to work at a practitioner's clinic, patients book into those days, and every record, consent and prescription is shared and audited." },
      { property: "og:title", content: "MODO Prescriber Hub" },
      { property: "og:description", content: "In-person prescriber collaboration — request clinic days, share the patient record, prescribe on-site with a full audit trail." },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="border-b border-[color:var(--hairline)] bg-[color:var(--paper)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/25 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                <Network className="h-3.5 w-3.5" /> The Prescriber Hub · In-person
              </div>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Prescribers, on-site.
                <br />
                <span className="text-[color:var(--ink-soft)]">Not on WhatsApp.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base text-[color:var(--ink-soft)] sm:text-lg">
                The MODO Prescriber Hub is built for <strong className="text-[color:var(--ink)]">in-person</strong>{" "}
                prescribing. Prescribers request days to work at a practitioner's clinic, patients
                book into those days, and every record, consent and prescription is shared, signed
                and audited in one place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
<Link to="/auth">
                  <Button size="lg" className="rounded-full bg-[color:var(--ink)] px-7 text-white hover:bg-[color:var(--ink)]/90">
                    Create your account <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/features">
                  <Button size="lg" variant="outline" className="rounded-full border-[color:var(--hairline)] bg-white px-7 text-[color:var(--ink)]">
                    See all features
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-[color:var(--ink-soft)]">
                <span className="font-semibold text-[color:var(--accent)]">First month free · No card required.</span>{" "}
                Launching in the next few weeks.
              </p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-white shadow-sm">
              <img src={consultationPhoto.url} alt="Consultation using MODO" className="aspect-[4/5] w-full object-cover sm:aspect-[4/3]" loading="lazy" />
            </div>
          </div>
        </section>

        {/* WHAT IT IS */}
        <section className="border-b border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <div className="eyebrow">§ Built for in-person prescribing</div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Request the days. Fill the diary. Prescribe on-site.
              </h2>
              <p className="mt-3 text-[color:var(--ink-soft)]">
                MODO's Hub is a two-way marketplace for in-person prescriber cover — with the
                clinical record, consent and audit trail wired in.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              <HubFeature
                icon={CalendarDays}
                title="Request days to work together"
                desc="Prescribers propose dates and a location to a linked practitioner. The practitioner approves, tweaks, or declines — no calls, no calendars flying about."
              />
              <HubFeature
                icon={MapPin}
                title="Clinic-day booking pages"
                desc="Approved days appear on the practitioner's booking page automatically. Patients book prescriber-required treatments straight into those slots."
              />
              <HubFeature
                icon={UserPlus}
                title="Walk-in consults on the day"
                desc="Add unbooked patients on the fly. The prescriber opens the file, consults, and signs off — the practitioner closes the record after."
              />
              <HubFeature
                icon={Handshake}
                title="Multi-practitioner cover"
                desc="One prescriber can cover many clinics; one practitioner can invite several prescribers. Everyone sees only the patients they're linked to."
              />
              <HubFeature
                icon={CheckCircle2}
                title="On-site sign-off & prescriptions"
                desc="Approve treatment plans, issue prescriptions and sign consents in the room. The record updates for both sides in real time."
              />
              <HubFeature
                icon={ShieldCheck}
                title="Consent & audit built in"
                desc="Every clinic day, patient, view and prescription is logged. Ready to hand to a regulator or insurer at any time."
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS - PRACTITIONER */}
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="eyebrow">§ For practitioners</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                How it works for practitioners
              </h2>
              <p className="mt-4 text-[color:var(--ink-soft)]">
                Invite a prescriber, approve the days they can work in your clinic, and let MODO
                fill the diary with prescriber-required treatments.
              </p>
            </div>
            <div className="grid gap-4">
              <Step n={1} title="Link a prescriber" desc="Connect any MODO prescriber to your clinic. Choose which treatments require them on-site." />
              <Step n={2} title="Approve their clinic days" desc="When a prescriber requests a day at your location, review it and approve, adjust or decline in one tap." />
              <Step n={3} title="Patients book in" desc="Approved days go live on your booking page. Prescriber-required treatments only show slots on those days." />
              <Step n={4} title="Run the day together" desc="Consult, treat, sign off. The prescriber can add walk-ins; you close each record afterwards." />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS - PRESCRIBER */}
        <section className="border-y border-[color:var(--hairline)] bg-[color:var(--paper)]">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="order-2 grid gap-4 lg:order-1">
                <Step n={1} title="Connect to practitioners" desc="Accept invites from the clinics you cover. Set your travel radius, treatments and rates." />
                <Step n={2} title="Request days to work together" desc="Propose the dates and locations you can attend. Practitioners approve them into their diary." />
                <Step n={3} title="See the day's list" desc="On the day, open every booked patient — record, photos, consents and history in one screen." />
                <Step n={4} title="Prescribe & sign off in person" desc="Approve plans, issue prescriptions and add walk-ins on the spot. Every action is audit-logged." />
              </div>
              <div className="order-1 lg:order-2">
                <div className="eyebrow">§ For prescribers</div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  How it works for prescribers
                </h2>
                <p className="mt-4 text-[color:var(--ink-soft)]">
                  Cover multiple clinics without the admin. Request your days, see the patients
                  booked in, and prescribe in person with a full record in front of you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SHARED FEATURES */}
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">§ Also in the hub</div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">The clinical layer.</h2>
            <p className="mt-3 text-[color:var(--ink-soft)]">
              What sits underneath every clinic day, for both sides.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <HubFeature icon={ClipboardList} title="Shared patient record" desc="Medical form, concerns, consultation notes, photos and consent — visible to both sides." />
            <HubFeature icon={FileSignature} title="Collaborative notes" desc="Add notes, decisions and follow-up actions against the patient file. Nothing lost in DMs." />
            <HubFeature icon={Users} title="Multi-prescriber & multi-practitioner" desc="Prescribers can support many practitioners. Practitioners can invite several prescribers." />
            <HubFeature icon={Lock} title="Full audit trail" desc="Every view, edit and prescription decision is logged — encrypted at rest, hosted in the UK/EU." />
            <HubFeature icon={Stethoscope} title="Prescription workflow" desc="Prescriber approves and issues on-site — the practitioner sees the plan and executes with confidence." />
            <HubFeature icon={ShieldCheck} title="Consent-gated sharing" desc="Patients consent to record sharing at booking. Can be withdrawn or exported at any time." />
          </div>
        </section>


        {/* CTA */}
        <section className="border-t border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to join the Hub?</h2>
            <p className="mt-3 text-[color:var(--ink-soft)]">
              MODO is open to founding clinics on our launch list. Create your account and
              we'll be in touch as soon as your account is ready.
            </p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--accent)]">
              First month free · No card required.
            </p>
            <Link to="/auth">
              <Button size="lg" className="mt-6 rounded-full bg-[color:var(--ink)] px-8 text-white hover:bg-[color:var(--ink)]/90">
                Create your account <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function HubFeature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card className="rounded-3xl border-[color:var(--hairline)] bg-white">
      <CardHeader>
        <Icon className="mb-2 h-7 w-7 text-[color:var(--accent)]" />
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-[color:var(--hairline)] bg-white p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--ink)] text-sm font-semibold text-white">{n}</div>
      <div>
        <div className="font-semibold text-[color:var(--ink)]">{title}</div>
        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">{desc}</p>
      </div>
    </div>
  );
}
