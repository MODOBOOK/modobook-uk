import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader, SiteFooter, IconTile } from "./index";
import {
  ClipboardList, Network, ShieldCheck, Users, FileSignature,
  Stethoscope, HeartHandshake, CheckCircle2, Lock,
} from "lucide-react";

export const Route = createFileRoute("/prescriber-hub")({
  head: () => ({
    meta: [
      { title: "Prescriber Hub | MODO Book — collaborative aesthetics care" },
      { name: "description", content: "The MODO Prescriber Hub: a safe, traceable place for HCPs and non-HCPs to collaborate around a shared patient record." },
      { property: "og:title", content: "MODO Prescriber Hub" },
      { property: "og:description", content: "One workflow for prescribers and the practitioners they support — accountable, safe, professional." },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Network className="h-3.5 w-3.5" /> Coming soon · included on every plan
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">The Prescriber Hub.</h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Aesthetics is collaborative — and MODO's Prescriber Hub is where that collaboration
                lives. One safe, traceable workflow for prescribers and the practitioners they
                support. Shared patient records and collaborative notes, all linked to the booking
                that started it.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/auth"><Button size="lg">Join MODO Book</Button></Link>
                <Link to="/features"><Button size="lg" variant="outline">See all features</Button></Link>
              </div>
            </div>
            <div className="grid aspect-[5/4] w-full grid-cols-2 grid-rows-2 gap-3 rounded-3xl bg-background/60 p-6 shadow-lg ring-1 ring-black/5 sm:gap-5 sm:p-10">
              <IconTile icon={Stethoscope} label="Prescribers" />
              <IconTile icon={Users} label="Practitioners" />
              <IconTile icon={ClipboardList} label="Shared record" />
              <IconTile icon={HeartHandshake} label="One workflow" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for safer, more accountable aesthetics.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Whether you're a prescriber supporting multiple non-HCPs, or a practitioner who works
              with one — the Hub keeps everyone on the same record.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <HubFeature icon={ClipboardList} title="Shared patient record" desc="Prescriber sees the medical form, concerns, consultation notes and photos — with the patient's consent." />
            <HubFeature icon={FileSignature} title="Collaborative notes" desc="Add notes, decisions and review actions against the patient file, visible to both sides." />
            <HubFeature icon={Users} title="Multi-prescriber, multi-practitioner" desc="Prescribers can support many practitioners. Practitioners can refer to many prescribers." />
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <Step n={1} title="Connect" desc="Practitioner and prescriber link accounts inside MODO. Patients consent to data sharing as part of booking." />
              <Step n={2} title="Collaborate" desc="Prescriber reviews the medical form, photos and consultation notes alongside the practitioner." />
              <Step n={3} title="Treat" desc="Aftercare, review periods and follow-ups all flow back to both records — one shared timeline." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <ShieldCheck className="mb-2 h-7 w-7 text-primary" />
                <CardTitle>Why this matters</CardTitle>
                <CardDescription>
                  UK aesthetics is moving fast toward stricter regulation. The Hub is built around
                  the principle that <strong>every patient deserves a documented, prescriber-backed
                  plan</strong> — regardless of who is holding the needle.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {[
                    "One clinical standard across HCPs and non-HCPs.",
                    "Granular consent and traceability for every treatment.",
                    "Removes risky WhatsApp-based collaboration workflows.",
                    "Designed with input from practising prescribers.",
                  ].map((p) => (
                    <li key={p} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Lock className="mb-2 h-7 w-7 text-primary" />
                <CardTitle>Privacy & data</CardTitle>
                <CardDescription>
                  Patient data is shared between practitioner and prescriber only with explicit
                  consent. Encrypted at rest, hosted in the UK/EU, with full audit trails on who
                  viewed what and when.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {[
                    "Consent-gated record sharing per patient.",
                    "Audit log of every access event.",
                    "Patient can withdraw consent and export their record at any time.",
                  ].map((p) => (
                    <li key={p} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8">
            <HeartHandshake className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold sm:text-3xl">Want early access to the Prescriber Hub?</h2>
            <p className="mt-3 text-muted-foreground">Sign up to MODO Book now — Hub access is included as it rolls out.</p>
            <Link to="/auth"><Button size="lg" className="mt-6">Create your account</Button></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function HubFeature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card>
      <CardHeader>
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">{n}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
    </Card>
  );
}
