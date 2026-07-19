import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter } from "./index";
import consultationPhoto from "@/assets/modo-consultation.png.asset.json";

import {
  ClipboardList, Network, ShieldCheck, Users, FileSignature,
  Stethoscope, Sparkles, CheckCircle2, Lock, Camera, ScanFace, Brain, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/prescriber-hub")({
  head: () => ({
    meta: [
      { title: "Prescriber Hub | MODO — collaborative aesthetics care" },
      { name: "description", content: "How the MODO Prescriber Hub works for prescribers and practitioners — AI photo uploads, face mapping, consultation notes and a shared, consent-based patient record." },
      { property: "og:title", content: "MODO Prescriber Hub" },
      { property: "og:description", content: "One shared workflow for prescribers and the practitioners they support — AI photo uploads, face mapping, consultation notes and a single traceable record." },
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
                <Network className="h-3.5 w-3.5" /> The Prescriber Hub
              </div>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                One shared record.
                <br />
                <span className="text-[color:var(--ink-soft)]">Powered by AI.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base text-[color:var(--ink-soft)] sm:text-lg">
                The MODO Prescriber Hub connects practitioners and prescribers around a single
                patient file — photos, AI face mapping, consultation notes, medical history and
                consent — all in one traceable place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/" hash="waitlist">
                  <Button size="lg" className="rounded-full bg-[color:var(--ink)] px-7 text-white hover:bg-[color:var(--ink)]/90">
                    Join the waitlist <ArrowRight className="ml-1 h-4 w-4" />
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

        {/* AI FRONT AND CENTRE */}
        <section className="border-b border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <div className="eyebrow">§ AI-powered clinical workflow</div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                AI does the heavy lifting.
              </h2>
              <p className="mt-3 text-[color:var(--ink-soft)]">
                Upload photos, dictate notes, scan faces — MODO's AI structures it all into a
                clean, prescriber-ready record automatically.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              <AiFeature
                icon={Camera}
                title="AI photo uploads"
                desc="Snap or drag in before / during / after photos. MODO auto-tags them to the treatment, timeline and body area — ready for prescriber review."
              />
              <AiFeature
                icon={ScanFace}
                title="AI face mapping"
                desc="Automatic muscle, injection-point and area detection from a single photo. Overlay treatment plans and share them straight to the prescriber."
              />
              <AiFeature
                icon={Brain}
                title="AI consultation notes"
                desc="Talk through the consultation — MODO transcribes and structures it into indications, contraindications, plan and aftercare, ready to sign off."
              />
            </div>

            <div className="mt-10 rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--paper)] p-6 text-sm text-[color:var(--ink-soft)]">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" />
                <p>
                  <strong className="text-[color:var(--ink)]">The prescriber never has to chase.</strong>{" "}
                  Photos, face maps and notes land in their queue the moment the practitioner submits — with
                  full patient history and consent already attached.
                </p>
              </div>
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
                You focus on the client in front of you — MODO handles the paperwork and the
                prescriber conversation.
              </p>
            </div>
            <div className="grid gap-4">
              <Step n={1} title="Consultation" desc="Meet the client, take photos, dictate notes. AI structures everything into the record as you go." />
              <Step n={2} title="Send to prescriber" desc="Link a MODO prescriber to the patient. They receive the full file — photos, face map, notes, history and consent." />
              <Step n={3} title="Treat & follow up" desc="Once approved, deliver the treatment. Aftercare, top-ups and review dates auto-flow into both records." />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS - PRESCRIBER */}
        <section className="border-y border-[color:var(--hairline)] bg-[color:var(--paper)]">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="order-2 grid gap-4 lg:order-1">
                <Step n={1} title="Review the queue" desc="Every patient submitted to you appears in one clean queue — with photos, AI face map, notes and medical history." />
                <Step n={2} title="Decide & annotate" desc="Approve, request more info, or add clinical notes. Everything is versioned and timestamped." />
                <Step n={3} title="Stay compliant" desc="Full audit trail per patient — who viewed what, when, and what was prescribed. Ready for any regulator." />
              </div>
              <div className="order-1 lg:order-2">
                <div className="eyebrow">§ For prescribers</div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  How it works for prescribers
                </h2>
                <p className="mt-4 text-[color:var(--ink-soft)]">
                  Support multiple practitioners without drowning in WhatsApps, screenshots and
                  spreadsheets. One queue. One record per patient. One clear audit trail.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SHARED FEATURES */}
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">§ What's in the hub</div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Features, both sides.</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <HubFeature icon={ClipboardList} title="Shared patient record" desc="Medical form, concerns, consultation notes, photos and consent — visible to both sides." />
            <HubFeature icon={FileSignature} title="Collaborative notes" desc="Add notes, decisions and follow-up actions against the patient file. Nothing lost in DMs." />
            <HubFeature icon={Users} title="Multi-prescriber & multi-practitioner" desc="Prescribers can support many practitioners. Practitioners can refer to many prescribers." />
            <HubFeature icon={ShieldCheck} title="Consent-gated sharing" desc="Patients consent to record sharing at booking. Can be withdrawn or exported at any time." />
            <HubFeature icon={Lock} title="Full audit trail" desc="Every view, edit and prescription decision is logged — encrypted at rest, hosted in the UK/EU." />
            <HubFeature icon={Stethoscope} title="Prescription workflow" desc="Prescriber approves and issues — the practitioner sees the plan and can execute with confidence." />
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[color:var(--hairline)] bg-white">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to join the Hub?</h2>
            <p className="mt-3 text-[color:var(--ink-soft)]">
              MODO is rolling out to founding clinics over the next few weeks. Join the waitlist and
              we'll be in touch as soon as your account is ready.
            </p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--accent)]">
              First month free · No card required.
            </p>
            <Link to="/" hash="waitlist">
              <Button size="lg" className="mt-6 rounded-full bg-[color:var(--ink)] px-8 text-white hover:bg-[color:var(--ink)]/90">
                Join the waitlist <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function AiFeature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-[color:var(--paper)] p-7 transition hover:border-[color:var(--accent)]/40 hover:shadow-md">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent)]/10 text-[color:var(--accent)]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-[color:var(--ink)]">{title}</h3>
      <p className="mt-2 text-sm text-[color:var(--ink-soft)]">{desc}</p>
      <div className="mt-5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent)]">
        <Sparkles className="h-3 w-3" /> AI-powered
      </div>
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
