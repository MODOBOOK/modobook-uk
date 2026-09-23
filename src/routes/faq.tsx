import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "./index";
import { MarketingPage, PageHero, Reveal, CtaBand } from "@/components/marketing-kit";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "MODO FAQ | Answers for Practitioners & Patients" },
      {
        name: "description",
        content:
          "Common questions about MODO — booking, payments, rewards, training, data security and getting set up as an aesthetics practitioner.",
      },
      { property: "og:title", content: "FAQ | MODO" },
      { property: "og:description", content: "Everything you need to know about running your clinic — or booking with one — on MODO." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/faq" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: groups.flatMap((g) =>
            g.items.map((it) => ({
              "@type": "Question",
              name: it.q,
              acceptedAnswer: { "@type": "Answer", text: it.a },
            })),
          ),
        }),
      },
    ],
  }),
  component: FaqPage,
});

type FaqItem = { q: string; a: string };
type FaqGroup = { id: string; label: string; items: FaqItem[] };

const groups: FaqGroup[] = [
  {
    id: "getting-started",
    label: "Getting started",
    items: [
      { q: "What is MODO?", a: "MODO is a booking, patient records and marketing platform built specifically for aesthetics practitioners in the UK. It replaces the patchwork of booking widgets, consent forms, WhatsApp reminders and spreadsheets with one clinical-grade system." },
      { q: "Is MODO open to sign up now?", a: "Yes. MODO is live and open to any UK aesthetics practitioner. Create your account, set up your clinic and start taking bookings the same day — your first month is free and no card details are needed to start." },
      { q: "Who is MODO for?", a: "Solo injectors, multi-room clinics, prescribers, aesthetic nurses, dentists offering facial aesthetics and academies running training. If you deliver aesthetic treatments in the UK, MODO is built for you." },
      { q: "How long does set-up take?", a: "Most practitioners are taking bookings the same day. Add your treatments, set your hours, connect your card payments and publish your MODO page — you're live." },
      { q: "Do I need a website already?", a: "No. Your MODO booking page (modobook.uk/m/your-clinic) is a full public page with your branding, treatments, reviews and rewards. You can point a custom domain at it too." },
    ],
  },
  {
    id: "bookings",
    label: "Bookings & payments",
    items: [
      { q: "How do patients pay?", a: "By card at the time of booking — full payment, deposit or pay-in-clinic, set per treatment. Klarna and Clearpay are available too. You keep 100% of the treatment revenue; MODO never takes a percentage of your bookings." },
      { q: "Can I take deposits?", a: "Yes. Set a deposit amount or percentage per treatment, and set it to £0 on any treatment where you'd rather take nothing up front. Deposits are captured at booking and applied to the final balance automatically." },
      { q: "What about no-shows and late cancellations?", a: "Configure your own policy per treatment. MODO enforces it — non-refundable deposits, cancellation fees or full charges depending on how much notice was given." },
      { q: "Can patients reschedule themselves?", a: "Yes, within the window you set. Reschedules respect your availability, treatment rules and any cancellation policy." },
      { q: "Can each practitioner have their own notice period?", a: "Yes. As well as a clinic-wide minimum notice, each team member can have their own — so one person can take bookings three hours ahead while another needs twelve." },
    ],
  },
  {
    id: "rewards",
    label: "Rewards & referrals",
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
    items: [
      { q: "Can I sell training on MODO?", a: "Yes. Publish courses with fixed cohort dates or open them to your normal availability calendar. Learners book, pay and complete pre-course forms through MODO." },
      { q: "Can I preview a course before it's live?", a: "Yes. Set visibility to Hidden (link only), Coming soon (visible but not bookable), or Live." },
      { q: "Can courses have multiple locations?", a: "Yes — attach one or more of your clinic locations per course and learners choose where to attend." },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & emails",
    items: [
      { q: "Can I send marketing emails from MODO?", a: "Yes. Segment your patient list, write campaigns with merge tags and Book-now buttons, and schedule sends. Automations cover birthday emails, treatment-interval reminders, top-up reminders and win-backs." },
      { q: "Are unsubscribe links handled for me?", a: "Yes — every marketing email includes a tokenised unsubscribe link and MODO respects preferences automatically." },
      { q: "Do texts show who the appointment is with?", a: "Yes. Confirmation and reminder texts can include the practitioner's name, so patients always know who they're seeing." },
      { q: "Will the emails match my brand?", a: "Yes. Preset transactional emails use your clinic colours and logo, and you can override the body copy per template. Send yourself a test with one click." },
    ],
  },
  {
    id: "ai",
    label: "Built-in AI",
    items: [
      { q: "What does the AI actually do?", a: "It drafts the writing you'd otherwise do yourself — treatment descriptions for your menu, consent and medical forms, and aftercare instructions per treatment. You review and edit everything before it goes live." },
      { q: "Does it cost extra?", a: "No. The AI features are included in your MODO subscription." },
      { q: "Is patient data used to train it?", a: "No. Patient records are never used to train models." },
    ],
  },
  {
    id: "patients",
    label: "For patients",
    items: [
      { q: "Do I need an account to book?", a: "You'll create one at the point of booking so your practitioner can hold your medical form, consent and treatment history. It only takes a moment." },
      { q: "Where do I see my rewards?", a: "Sign in to your practitioner's MODO page and open My account → Rewards. You'll see your code, credit and any points balance." },
      { q: "How do I contact my practitioner?", a: "Every MODO clinic page has direct contact details and secure messaging where the practitioner has enabled it." },
    ],
  },
  {
    id: "security",
    label: "Data & security",
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
    <MarketingPage>
      <SiteHeader />

      <main className="flex-1">
        <PageHero
          eyebrow="Frequently asked"
          title="A few things"
          accent="you might want to know."
          blurb="Everything you need to know about MODO, from getting started to bookings, payments and beyond."
        >
          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {groups.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="link-underline text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]"
              >
                {g.label}
              </a>
            ))}
          </div>
        </PageHero>

        <section className="border-b border-[color:var(--hairline)]">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            {groups.map((g) => (
              <div key={g.id} id={g.id} className="mb-16 scroll-mt-24 last:mb-0">
                <Reveal>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
                    {g.label}
                  </div>
                </Reveal>
                <div className="mt-6 border-t border-[color:var(--hairline)]">
                  {g.items.map((item, i) => {
                    const id = `${g.id}-${i}`;
                    const isOpen = openId === id;
                    return (
                      <div key={id} className="border-b border-[color:var(--hairline)]">
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? null : id)}
                          className="flex w-full items-center justify-between gap-6 py-5 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="font-display text-lg text-[color:var(--ink)]">
                            {item.q}
                          </span>
                          <ArrowRight
                            className={`h-4 w-4 shrink-0 text-[color:var(--taupe)] transition-transform duration-300 ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <p className="pb-6 pr-10 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                            {item.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <Reveal>
              <div className="mt-14 border border-[color:var(--hairline)] bg-[color:var(--card)] p-8 text-center">
                <p className="font-display text-2xl text-[color:var(--ink)]">
                  Still have a question?
                </p>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  Our team run aesthetics clinics ourselves — get in touch and we'll help you get set up.
                </p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    to="/auth"
                    className="inline-flex h-14 items-center justify-center bg-[color:var(--ink)] px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-colors hover:bg-[color:var(--accent)]"
                  >
                    Create your account
                  </Link>
                  <a
                    href="mailto:info@modobook.co.uk"
                    className="inline-flex h-14 items-center justify-center border border-[color:var(--ink)] px-10 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)]"
                  >
                    Email the team
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <CtaBand />
      </main>

      <SiteFooter />
    </MarketingPage>
  );
}
