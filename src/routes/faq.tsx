import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "./index";
import { ArrowRight, HelpCircle, CreditCard, Gift, Users, Shield, Settings2, GraduationCap, Mail } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ | MODO — answers for practitioners & patients" },
      {
        name: "description",
        content:
          "Answers to the most common questions about MODO — booking, payments, rewards, training, data & security, and how to get set up as a practitioner.",
      },
      { property: "og:title", content: "FAQ | MODO" },
      { property: "og:description", content: "Everything you need to know about running your clinic — or booking with one — on MODO." },
    ],
  }),
  component: FaqPage,
});

type FaqItem = { q: string; a: string };
type FaqGroup = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: FaqItem[] };

const groups: FaqGroup[] = [
  {
    id: "getting-started",
    label: "Getting started",
    icon: Settings2,
    items: [
      { q: "What is MODO?", a: "MODO is a booking, patient records and marketing platform built specifically for aesthetics practitioners in the UK. It replaces the patchwork of booking widgets, consent forms, WhatsApp reminders and spreadsheets with one clinical-grade system." },
      { q: "Who is MODO for?", a: "Solo injectors, multi-room clinics, prescribers, aesthetic nurses, dentists offering facial aesthetics and academies running training. If you deliver aesthetic treatments in the UK, MODO is built for you." },
      { q: "How long does set-up take?", a: "Most practitioners are taking bookings the same day. Import your treatments, set your hours, connect Stripe, publish your MODO page — you're live." },
      { q: "Do I need a website already?", a: "No. Your MODO booking page (modobook.uk/your-name) is a full public page with your branding, treatments, reviews and rewards. You can point a custom domain at it too." },
    ],
  },
  {
    id: "bookings",
    label: "Bookings & payments",
    icon: CreditCard,
    items: [
      { q: "How do patients pay?", a: "Card via Stripe at the time of booking — full payment, deposit or pay-in-clinic, per treatment. You keep 100% of the treatment revenue; MODO does not take a percentage of your bookings." },
      { q: "Can I take deposits?", a: "Yes. Set a deposit amount or percentage per treatment. Deposits are captured up-front and applied to the final balance automatically." },
      { q: "What about no-shows and late cancellations?", a: "Configure your own policy per treatment. MODO enforces it — automatic non-refundable deposits, cancellation fees or full charges depending on how much notice was given." },
      { q: "Can patients reschedule themselves?", a: "Yes, within the window you set. Reschedules respect your availability, treatment rules and any cancellation policy." },
    ],
  },
  {
    id: "rewards",
    label: "Rewards & referrals",
    icon: Gift,
    items: [
      { q: "Do I have to run a rewards programme?", a: "No — it's fully optional and off by default. Turn on referrals, loyalty points and reward tiers independently, in any combination you like." },
      { q: "How do referrals work?", a: "Every patient automatically gets a 6-character referral code. When a friend uses it at their first booking, the reward posts to the referrer once that first paid appointment is completed. No manual admin." },
      { q: "Can I use different rewards for different treatments?", a: "Yes. Points earn rates, tier redemptions and referral offers can all be scoped by treatment or category." },
      { q: "Do points or credit expire?", a: "Not by default. You can set expiry rules per programme if you want to." },
    ],
  },
  {
    id: "training",
    label: "Training courses",
    icon: GraduationCap,
    items: [
      { q: "Can I sell training on MODO?", a: "Yes. Publish courses with fixed cohort dates or open them to your normal availability calendar. Learners book, pay and complete pre-course forms through MODO." },
      { q: "Can I preview a course before it's live?", a: "Yes. Set visibility to Hidden (link only), Coming soon (visible but not bookable), or Live." },
      { q: "Can courses have multiple locations?", a: "Yes — attach one or more of your clinic locations per course and learners choose where to attend." },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & emails",
    icon: Mail,
    items: [
      { q: "Can I send marketing emails from MODO?", a: "Yes. Segment your patient list, write campaigns with merge tags and Book-now buttons, and schedule sends. Automations cover birthday emails, treatment-interval reminders, top-up reminders and win-backs." },
      { q: "Are unsubscribe links handled for me?", a: "Yes — every marketing email includes a tokenised unsubscribe link and MODO respects preferences automatically." },
      { q: "Will the emails match my brand?", a: "Yes. Preset transactional emails use your clinic colours and logo, and you can override the body copy per template. Send yourself a test with one click." },
    ],
  },
  {
    id: "patients",
    label: "For patients",
    icon: Users,
    items: [
      { q: "Do I need an account to book?", a: "You'll create one at the point of booking so we can hold your medical form, consent and treatment history. It only takes a moment." },
      { q: "Where do I see my rewards?", a: "Sign in to your practitioner's MODO page and open My account → Rewards. You'll see your code, credit and any points balance." },
      { q: "How do I contact my practitioner?", a: "Every MODO clinic page has direct contact details and secure messaging where the practitioner has enabled it." },
    ],
  },
  {
    id: "security",
    label: "Data & security",
    icon: Shield,
    items: [
      { q: "Is MODO GDPR compliant?", a: "Yes. MODO is built for UK clinical use with row-level security, encrypted storage, a full DPA, a DPIA and breach-response process. You are the data controller for your patient records; MODO is your data processor." },
      { q: "Where is my data stored?", a: "In UK/EU data centres. Backups are encrypted at rest and access is audit-logged." },
      { q: "Can I export my data?", a: "Yes — full CSV export of patients, appointments, treatments and revenue at any time. Your data is always yours." },
    ],
  },
];

function FaqPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="modo-marketing flex min-h-screen flex-col bg-[color:var(--paper)] text-[color:var(--ink)]">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-4xl px-5 py-14 text-center lg:py-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/25 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
              <HelpCircle className="h-3.5 w-3.5" /> Frequently asked
            </div>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Everything you might want to ask.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-[color:var(--ink-soft)] sm:text-lg">
              Answers for practitioners setting up their clinic on MODO — and for patients booking with one.
            </p>
          </div>
        </section>

        {/* Quick nav */}
        <section className="border-b border-[color:var(--hairline)] bg-white/60">
          <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-2">
              {groups.map((g) => (
                <a
                  key={g.id}
                  href={`#${g.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hairline)] bg-white px-4 py-2 text-xs font-medium text-[color:var(--ink)] transition-colors hover:border-[color:var(--accent)]/40 hover:text-[color:var(--accent)]"
                >
                  <g.icon className="h-3.5 w-3.5" />
                  {g.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Groups */}
        <section>
          <div className="mx-auto max-w-4xl px-5 py-12 lg:px-8 lg:py-16">
            {groups.map((g) => (
              <div key={g.id} id={g.id} className="mb-14 scroll-mt-24">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--accent)]/10 text-[color:var(--accent)]">
                    <g.icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl">{g.label}</h2>
                </div>
                <div className="space-y-3">
                  {g.items.map((item, i) => {
                    const id = `${g.id}-${i}`;
                    const isOpen = openId === id;
                    return (
                      <div key={id} className="overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-white">
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? null : id)}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="font-medium text-[color:var(--ink)]">{item.q}</span>
                          <ArrowRight className={`h-4 w-4 shrink-0 text-[color:var(--ink-soft)] transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </button>
                        {isOpen && (
                          <div className="border-t border-[color:var(--hairline)] px-5 py-4 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[color:var(--hairline)] bg-gradient-to-b from-background to-primary/10">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8 lg:py-20">
            <h2 className="font-serif text-3xl sm:text-4xl">Still have a question?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Our team runs aesthetics clinics ourselves — get in touch and we'll help you get set up.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg">Create your account <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>

              <a href="mailto:info@modobook.co.uk">
                <Button size="lg" variant="outline">Email the team</Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
