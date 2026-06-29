import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  Link2,
  Palette,
  ShieldCheck,
  CreditCard,
  Star,
  Stethoscope,
  Sparkles,
  Users,
  ClipboardList,
  Camera,
  Bell,
  MessageSquare,
  FileSignature,
  PoundSterling,
  Layers,
  CheckCircle2,
  HeartHandshake,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MODO Book | The booking platform built by aesthetics nurses, for aesthetics clinics" },
      {
        name: "description",
        content:
          "MODO Book is the booking, consultation and clinic management platform designed by two UK Nurse Prescribers. Built for aesthetics — not adapted from a hairdressing app.",
      },
      { property: "og:title", content: "MODO Book — Designed by aesthetics nurses, for aesthetics clinics" },
      {
        property: "og:description",
        content:
          "Custom booking pages, full consultation workflows, consent, face mapping, batch tracking, payments and patient records — in one platform built by practitioners.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">MODO Book</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-7xl px-4 py-20 text-center lg:px-8">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-4 py-1.5 text-sm">
            <Stethoscope className="h-4 w-4 text-primary" />
            <span>Designed by two UK Nurse Prescribers working in aesthetics</span>
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The booking platform aesthetics clinics have actually been waiting for.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            MODO Book replaces the patchwork of booking apps, paper consent forms, WhatsApp messages,
            spreadsheets and clunky portals — with one beautifully simple system built from the
            chair, not the boardroom.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/auth">
              <Button size="lg">Start free — set up in minutes</Button>
            </Link>
            <Link to="/demo-clinic">
              <Button size="lg" variant="outline">
                See a live clinic page
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">No card required · Cancel anytime · Your data stays in the UK/EU</p>
        </section>

        {/* BUILT BY PRACTITIONERS */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <HeartHandshake className="h-3.5 w-3.5" /> Built by clinicians, for clinicians
              </div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Designed by two Nurse Prescribers who were sick of the workarounds.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every other "booking system" in aesthetics is a hairdressing or spa app with consent
                forms bolted on. We know — we used them all. MODO Book was designed end-to-end by two
                practising UK Nurse Prescribers who understand consultations, prescribing notes, batch
                numbers, photo consent, model slots, top-ups, review periods and the realities of
                running an aesthetics clinic.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Real consultation workflow — medical history, concerns, assessment, plan, consent, photos, batch numbers, invoice.",
                  "Face mapping that lets you tag products and units without typing essays.",
                  "Photo & social media consent broken down the way it should be — not buried in T&Cs.",
                  "Aftercare that sends itself. Medical forms that auto-link to the patient record.",
                  "Model slots, packages, multi-session treatments, split payments, deposits — all native.",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-background p-8 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Why MODO Book is different
              </div>
              <div className="space-y-5">
                <Compare
                  before="Booking app designed for hairdressers"
                  after="Designed from scratch for aesthetics, by Nurse Prescribers"
                />
                <Compare
                  before="Consent forms emailed as PDFs you chase by hand"
                  after="Auto-sent, auto-signed, auto-attached to the patient record"
                />
                <Compare
                  before="Separate apps for booking, notes, photos, invoices"
                  after="One platform — consultation, photos, batches, invoice all linked"
                />
                <Compare
                  before="Generic booking pages that look like every other clinic"
                  after="Fully branded page with your colours, fonts, hero and packages"
                />
                <Compare
                  before="Paying 3–7% per booking to a marketplace"
                  after="0% booking fees. Your patients, your Stripe, your brand."
                />
              </div>
            </div>
          </div>
        </section>

        {/* EVERYTHING IN ONE PLACE */}
        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything your clinic runs on — finally in one place.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Replace 5–6 separate tools with a single system designed around how aesthetics actually works.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={Palette}
              title="Fully branded booking page"
              desc="Your colours, fonts, hero image, logo and welcome message. Looks like your brand — not ours."
            />
            <Feature
              icon={Link2}
              title="Your own MODO link"
              desc="modo.book/your-clinic. One link for Instagram, TikTok, your website and Google."
            />
            <Feature
              icon={Calendar}
              title="Smart live availability"
              desc="Weekly schedules, buffers, daily caps, lead times, model slots and ad-hoc rota changes."
            />
            <Feature
              icon={ClipboardList}
              title="8-step consultation flow"
              desc="Medical form, concerns, assessment, plan, consent, before/after photos, batch numbers, invoice."
            />
            <Feature
              icon={FileSignature}
              title="Consent & medical forms"
              desc="Build your own or use ours. Auto-sent before treatment, auto-signed, auto-filed."
            />
            <Feature
              icon={Camera}
              title="Face mapping & photos"
              desc="Plan and record treatments with pin-drop product tags, units and before/after pictures."
            />
            <Feature
              icon={Users}
              title="Patient records"
              desc="Full history, allergies, concerns, consultations, photos, forms and comms in one profile."
            />
            <Feature
              icon={Layers}
              title="Packages & multi-session"
              desc="Bundles, courses, top-ups, add-ons and split payments — without the spreadsheet."
            />
            <Feature
              icon={CreditCard}
              title="Payments your way"
              desc="Deposits, pay-in-clinic, full pre-payment, Klarna and Clearpay. Paid into your Stripe."
            />
            <Feature
              icon={Bell}
              title="Reminders that work"
              desc="Confirmations and reminders by email, SMS and WhatsApp. Cancellation rules enforced automatically."
            />
            <Feature
              icon={MessageSquare}
              title="Marketing built-in"
              desc="Email your patient list, follow up after treatment, drive reviews and rebooks."
            />
            <Feature
              icon={ShieldCheck}
              title="GDPR-ready storage"
              desc="Encrypted at rest, UK/EU data residency, granular photo & marketing consent."
            />
          </div>
        </section>

        {/* WHY JOIN */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Why practitioners are switching to MODO Book
              </h2>
              <p className="mt-3 text-muted-foreground">
                Save hours every week, look more professional and protect yourself clinically — all from one login.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Benefit value="5–8 hrs" label="saved per week on admin, consents and follow-ups" />
              <Benefit value="0%" label="booking commission. Ever. Your patients are yours." />
              <Benefit value="1 link" label="for bookings, consultations, consent and payments" />
              <Benefit value="100%" label="GDPR-ready, encrypted, UK/EU hosted patient data" />
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built for the way you actually work</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <WhoCard
              title="Solo Nurse Prescribers"
              points={[
                "One link, one inbox, one calendar",
                "Prescriber-grade consultation notes",
                "Batch & expiry tracking built in",
              ]}
            />
            <WhoCard
              title="Multi-practitioner clinics"
              points={[
                "Assign practitioners to locations",
                "First-available or patient-chooses booking",
                "Per-practitioner pricing and rotas",
              ]}
            />
            <WhoCard
              title="Mobile & home-visit aesthetics"
              points={[
                "Multiple locations and travel days",
                "Take deposits to protect your time",
                "Consent and forms completed at home",
              ]}
            />
          </div>
        </section>

        {/* SECURITY */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Lock className="h-3.5 w-3.5" /> Built for clinical data
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Your patient data, treated like patient data.
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Encrypted at rest and in transit, hosted in the UK/EU, with row-level access controls
                so only your clinic can see your patients. Granular photo and marketing consent is
                captured per patient, per use case — patient file, social media, marketing, training.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge icon={ShieldCheck} label="GDPR-ready" />
              <Badge icon={Lock} label="Encrypted storage" />
              <Badge icon={PoundSterling} label="0% booking fees" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-20 text-center lg:px-8">
            <Star className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Join the platform built by the people doing the job.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Set up your clinic page in under 10 minutes. Import patients later. Cancel anytime.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/auth">
                <Button size="lg">Create your clinic page</Button>
              </Link>
              <Link to="/demo-clinic">
                <Button size="lg" variant="outline">See a live example</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MODO Book. Designed by Nurse Prescribers, for aesthetics clinics.
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
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

function Compare({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 text-sm">
      <div className="pt-0.5 text-muted-foreground line-through">✗</div>
      <div className="text-muted-foreground line-through">{before}</div>
      <div className="pt-0.5 text-primary">✓</div>
      <div className="font-medium">{after}</div>
    </div>
  );
}

function Benefit({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="text-3xl font-bold tracking-tight text-primary">{value}</div>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function WhoCard({ title, points }: { title: string; points: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Badge({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5">
      <Icon className="h-4 w-4 text-primary" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
