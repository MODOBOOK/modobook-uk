import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Sparkles,
  CalendarDays,
  Users,
  CreditCard,
  Mail,
  Stethoscope,
  ArrowRight,
  MessageCircle,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/help")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Help & FAQ | MODO Studio" },
      { name: "description", content: "Practitioner help centre for MODO — how to set up your clinic, manage bookings, patients, payments and more." },
      { property: "og:title", content: "Help & FAQ | MODO Studio" },
      { property: "og:description", content: "Practitioner help centre for MODO." },
    ],
  }),
  component: HelpPage,
});

type FaqItem = { q: string; a: React.ReactNode };
type FaqGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: FaqItem[];
};

const groups: FaqGroup[] = [
  {
    id: "getting-started",
    label: "Getting started",
    icon: Sparkles,
    items: [
      { q: "What should I set up first?", a: "Start with Business & Profile, then add your Services, Locations and Availability. Once that's done, preview your public booking page and share your /m/your-name link." },
      { q: "How do I change my clinic colours and logo?", a: "Go to Branding. You can pick a preset palette or set your own colours, upload a logo and choose fonts. Changes apply instantly to your public page." },
      { q: "Can I use my own domain?", a: "Yes — your MODO page works on modobook.uk/your-name by default. Custom domain support can be enabled from the booking settings or by contacting support." },
    ],
  },
  {
    id: "bookings",
    label: "Bookings & calendar",
    icon: CalendarDays,
    items: [
      { q: "How do I block time off?", a: "Use Availability to add ad-hoc closures or recurring opening hours. You can choose which locations and practitioners each block applies to." },
      { q: "Can patients reschedule themselves?", a: "Yes, if you allow it in Booking settings. Patients can reschedule within the window you set without calling you." },
      { q: "How do deposits and cancellation fees work?", a: "Set a deposit or full-payment rule per treatment in Welcome & policies. MODO captures the card at booking and applies your cancellation policy automatically." },
      { q: "What happens if a patient doesn't show?", a: "You can charge the card on file from the appointment details. Make sure card capture is enabled in Payments & payouts." },
    ],
  },
  {
    id: "patients",
    label: "Patients & records",
    icon: Users,
    items: [
      { q: "Where do I see a patient's full history?", a: "Open Patients, choose a patient, then view their appointments, consultations, medical forms, consents and photos in one place." },
      { q: "How are medical forms sent?", a: "Attach the forms you want to each treatment under Attach forms. They are sent automatically when a patient books, and only once per appointment even if multiple treatments are chosen." },
      { q: "Can I write consultation notes?", a: "Yes — start a Consultation from an appointment or the Consultations page. You can also use note templates to speed up common entries." },
      { q: "How do I export a consultation for printing?", a: "Inside a consultation, use the PDF export option. It includes clinic branding, practitioner name and a signature line." },
    ],
  },
  {
    id: "payments",
    label: "Payments & billing",
    icon: CreditCard,
    items: [
      { q: "How do I get paid?", a: "Connect your Stripe account in Payments & payouts. Booking revenue goes to your Stripe balance and is paid out according to your Stripe schedule." },
      { q: "What are MODO's platform fees?", a: "MODO charges a monthly subscription after your free trial. You keep the full treatment revenue; MODO does not take a percentage of bookings." },
      { q: "Can I send a payment link for extras?", a: "Yes — create a payment link from the Payments section. You can include the platform fee in the total and it appears on the invoice." },
      { q: "Where do I update my subscription?", a: "Go to Plan & billing to view your package, add-ons and payment method." },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & emails",
    icon: Mail,
    items: [
      { q: "How do I email my patients?", a: "Use Marketing to build campaigns with merge tags, images and buttons. Patients must be opted in; unsubscribe links are added automatically." },
      { q: "Can I set up automated emails?", a: "Yes — appointment reminders, birthday offers, rebook reminders and top-up reminders can be configured in Emails and Booking settings." },
      { q: "How do referrals and rewards work?", a: "Turn on Referrals & Rewards to give patients a code. Points accrue per booking and you can adjust balances manually from a patient's profile." },
    ],
  },
  {
    id: "prescriber",
    label: "Prescriber Hub",
    icon: Stethoscope,
    items: [
      { q: "How do I request a prescriber?", a: "Go to Prescriber Hub to find and link with a prescriber, send visit requests and manage prescriptions." },
      { q: "What is a prescribing clinic?", a: "A prescribing clinic lets you publish dates when a prescriber will be on site. Patients book a prescribing slot just like a treatment." },
    ],
  },
];

function HelpPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.q.toLowerCase().includes(query.toLowerCase()) ||
          String(i.a).toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <HelpCircle className="h-3.5 w-3.5" /> Help centre
        </div>
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">How to run your clinic on MODO</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Quick answers to the most common practitioner questions. Can't find what you need? Message us on WhatsApp.
        </p>
      </div>

      {/* Search */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help articles..."
              className="h-12 rounded-xl border-muted-foreground/20 pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* FAQ groups */}
      <div className="space-y-10">
        {filtered.map((g) => (
          <section key={g.id} id={g.id}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <g.icon className="h-5 w-5" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl">{g.label}</h2>
            </div>
            <div className="space-y-3">
              {g.items.map((item, i) => {
                const id = `${g.id}-${i}`;
                const isOpen = openId === id;
                return (
                  <Card
                    key={id}
                    className={cn(
                      "overflow-hidden border-border/60 transition-shadow",
                      isOpen && "shadow-luxe",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="font-medium">{item.q}</span>
                      <ArrowRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                    </button>
                    {isOpen && (
                      <CardContent className="border-t border-border/60 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground">No articles match your search.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setQuery("")}
            >
              Clear search
            </Button>
          </div>
        )}
      </div>

      {/* Support CTA */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg">Still need a hand?</h3>
            <p className="text-sm text-muted-foreground">
              Message the MODO team on WhatsApp and we'll walk you through it.
            </p>
          </div>
          <Button asChild className="rounded-full">
            <a
              href="https://wa.me/447385790119"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp support
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
