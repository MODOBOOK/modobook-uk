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
      { q: "What is MODO?", a: "MODO is an all-in-one booking and clinic management platform created for aesthetics. Manage bookings, payments, patient records, consultations, communications, marketing and more." },
      { q: "Who is MODO for?", a: "MODO is designed for aesthetics practitioners and clinics of every size — from solo practitioners to growing, multi-practitioner teams." },
      { q: "How quickly can I get set up?", a: "You can start building your clinic as soon as your account is created. Add your treatments, availability, branding and booking preferences, then share your personalised MODO booking link when you're ready." },
      { q: "Can I move from another booking system?", a: "Yes. Switching doesn't have to mean starting again. Upload or screenshot your existing treatment list, client list and reviews, and MODO can help organise and import your information." },
      { q: "Do I need my own website?", a: "No. Every clinic receives its own branded MODO booking page, ready to share across Instagram, TikTok, Google or anywhere else your clients find you." },
    ],
  },
  {
    id: "bookings",
    label: "Bookings & payments",
    items: [
      { q: "How do clients pay?", a: "You decide. Take a deposit, request full payment at booking or allow clients to pay in clinic — with payment options set individually for each treatment." },
      { q: "Can I take deposits or full payment?", a: "Yes. Set the amount or payment requirement that works for each treatment, including the option to take no upfront payment at all." },
      { q: "Can I offer Klarna or Clearpay?", a: "Yes. Eligible clients can choose Klarna or Clearpay at checkout, giving them more flexibility when paying for their treatment." },
      { q: "How are cancellations and no-shows handled?", a: "Set your own cancellation policy and securely capture a client's card when required. You can create cancellation fee rules around your clinic's notice periods, helping protect your diary from late cancellations and no-shows." },
      { q: "Can clients reschedule their own appointments?", a: "Yes. Clients can manage eligible bookings themselves, within the rules and notice periods you set — saving you from unnecessary back-and-forth." },
      { q: "Can each practitioner set their own availability and booking rules?", a: "Yes. Each practitioner can have their own working hours, availability and booking preferences, so MODO works around the way your team actually operates." },
    ],
  },
  {
    id: "team-locations",
    label: "Team & locations",
    items: [
      { q: "Can I add team members?", a: "Yes. Build your team within MODO and give each practitioner their own calendar and secure login." },
      { q: "Can I manage multiple locations?", a: "Yes. Run multiple clinic locations from one MODO account, with availability, practitioners and appointments organised across each location." },
      { q: "Can practitioners receive payments directly?", a: "Where your clinic structure requires it, payments can be directed to the clinic or an individual practitioner's connected account." },
      { q: "Can I track commission?", a: "Yes. MODO can track practitioner commission against bookings, making team payments easier to manage and understand." },
    ],
  },
  {
    id: "rewards",
    label: "Memberships & loyalty",
    items: [
      { q: "Can I create client memberships?", a: "Yes. Create your own memberships and let clients subscribe with a recurring monthly payment, helping them build credit towards future treatments with you." },
      { q: "How do monthly memberships work?", a: "You choose the membership amount and structure. The client's recurring payment is collected directly for your business, creating an ongoing balance they can use towards eligible future treatments." },
      { q: "Do I have to offer rewards?", a: "Not at all. Rewards and loyalty features are completely optional — switch them on only if they suit your clinic." },
      { q: "How do referrals work?", a: "Create your own referral programme and reward clients for introducing someone new to your clinic. You stay in control of how rewards are earned and what they're worth." },
      { q: "Can I create different rewards?", a: "Yes. Tailor rewards to your clinic rather than working around a fixed loyalty programme, with different options for the treatments or offers you choose." },
      { q: "Do points or credit expire?", a: "You control the rules of your loyalty programme, including how rewards are redeemed and, where supported, when they expire." },
    ],
  },
  {
    id: "training",
    label: "Training & courses",
    items: [
      { q: "Can I sell my own training through MODO?", a: "Yes. If you offer practitioner training, you can showcase your own courses through your clinic's MODO page, keeping training alongside the rest of your business without it appearing to be a MODO-run academy." },
      { q: "Can I create a course before publishing it?", a: "Yes. Build and review your course privately first, then make it available to book when everything is ready." },
      { q: "Can I offer courses across multiple locations?", a: "Yes. If you teach from more than one location, courses can be organised around the relevant venue, date and availability." },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & communications",
    items: [
      { q: "Can I send marketing emails?", a: "Yes. Create targeted campaigns and communicate directly with your client base from within MODO, without needing a separate marketing platform for everyday clinic communications." },
      { q: "Does MODO send SMS appointment reminders?", a: "Yes. Clients can receive SMS booking confirmations and appointment reminders automatically, helping keep them informed and reduce missed appointments." },
      { q: "Can aftercare be sent automatically?", a: "Yes. Set treatment-specific aftercare to send automatically after an appointment, at the time you choose — so every client receives the right information without you having to send it manually." },
      { q: "Can MODO request reviews automatically?", a: "Yes. Review requests can be sent after treatment, making it easier to consistently collect client feedback without having to remember to ask." },
      { q: "Are unsubscribe preferences handled?", a: "Clients can manage their marketing preferences, helping you keep your communications organised and respect opt-out choices." },
      { q: "Can communications match my brand?", a: "Your patient-facing experience is designed to feel like an extension of your clinic, with your own branding carried through the MODO experience." },
    ],
  },
  {
    id: "ai",
    label: "Intelligent features",
    items: [
      { q: "What does the AI actually do?", a: "It drafts the writing you'd otherwise do yourself — treatment descriptions for your menu, consent and medical forms, and aftercare instructions per treatment. You review and edit everything before it goes live." },
      { q: "Does it cost extra?", a: "No. The AI features are included in your MODO subscription." },
      { q: "Is patient data used to train it?", a: "No. Patient records are never used to train models." },
    ],
  },
  {
    id: "patients",
    label: "For clients",
    items: [
      { q: "Do I need an account to book?", a: "You'll create one at the point of booking so your practitioner can hold your medical form, consent and treatment history. It only takes a moment." },
      { q: "Where do I see my rewards?", a: "Sign in to your practitioner's MODO page and open My account → Rewards. You'll see your code, credit and any points balance." },
      { q: "How do I contact my practitioner?", a: "Every MODO clinic page has direct contact details and secure messaging where the practitioner has enabled it." },
    ],
  },
  {
    id: "account-billing",
    label: "Account & Billing",
    items: [
      { q: "How much does MODO cost?", a: "MODO Solo is £39.99 a month and MODO Collective is £59.99 a month, with additional practitioners at £9.99 each. All prices are in GBP and include VAT, and your first month is free." },
      { q: "How does the free trial work?", a: "Every account starts with a 30-day free trial with full access to every feature. No card details are needed to start, and nothing is charged until your trial ends." },
      { q: "How do I pay for my subscription?", a: "Your paid subscription begins automatically at the end of your 30-day free trial unless cancelled, and is billed monthly to the card on your account." },
      { q: "Can I cancel any time?", a: "Yes. There are no notice periods or cancellation fees — cancel from your account settings and you won't be billed again." },
      { q: "Can I change plan or add practitioners?", a: "Yes. Move between plans or add practitioners whenever you like, and the change applies straight away with no penalty." },
      { q: "Does MODO take a percentage of my revenue?", a: "No. MODO never takes a percentage of your treatment revenue — you pay your subscription and your revenue stays yours." },
    ],
  },
  {
    id: "security",
    label: "Privacy & security",
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
                          <span className="text-base font-medium text-[color:var(--ink)]">
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
