import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Store,
  Scissors,
  CreditCard,
  MapPin,
  Palette,
  FileText,
  FileSignature,
  Package,
  Shield,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Star,
  HelpCircle,
  ChevronRight,

  LogOut,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/menu")({
  ssr: false,
  component: MenuPage,
});

const groups: {
  title: string;
  items: { label: string; description: string; to: string; icon: React.ElementType; tone: string }[];
}[] = [
  {
    title: "Your business",
    items: [
      { label: "Clinic page", description: "Edit your clinic info & hero", to: "/dashboard/clinic", icon: Store, tone: "bg-rose-100 text-rose-600" },
      { label: "Branding", description: "Colors, fonts, logo & favicon", to: "/dashboard/branding", icon: Palette, tone: "bg-violet-100 text-violet-600" },
      { label: "Welcome & policies", description: "Intro, deposits, cancellation rules", to: "/dashboard/policies", icon: Shield, tone: "bg-emerald-100 text-emerald-600" },
      { label: "Locations", description: "Manage clinic addresses", to: "/dashboard/locations", icon: MapPin, tone: "bg-sky-100 text-sky-600" },
    ],
  },
  {
    title: "Services & forms",
    items: [
      { label: "Services", description: "Treatments, categories, pricing", to: "/dashboard/services", icon: Scissors, tone: "bg-pink-100 text-pink-600" },
      { label: "Packages", description: "Bundle treatments for patients", to: "/dashboard/packages", icon: Package, tone: "bg-indigo-100 text-indigo-600" },
      { label: "Medical forms", description: "Pre-treatment questionnaires", to: "/dashboard/medical-forms", icon: FileText, tone: "bg-amber-100 text-amber-600" },
      { label: "Consent forms", description: "Templates sent at booking", to: "/dashboard/consent-forms", icon: FileSignature, tone: "bg-teal-100 text-teal-600" },
    ],
  },
  {
    title: "Bookings",
    items: [
      { label: "Booking flow", description: "Concern picker shown before treatments", to: "/dashboard/booking-flow", icon: HelpCircle, tone: "bg-cyan-100 text-cyan-700" },
      { label: "Availability", description: "Opening times & ad-hoc slots", to: "/dashboard/availability", icon: CalendarDays, tone: "bg-blue-100 text-blue-600" },

      { label: "New appointment", description: "Book in a patient manually", to: "/dashboard/new-appointment", icon: CalendarPlus, tone: "bg-orange-100 text-orange-600" },
      { label: "Consultations", description: "MODO step-by-step patient records", to: "/dashboard/consultations", icon: ClipboardList, tone: "bg-fuchsia-100 text-fuchsia-700" },
      { label: "Reviews", description: "Moderate patient reviews", to: "/dashboard/reviews", icon: Star, tone: "bg-yellow-100 text-yellow-700" },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Payments & payouts", description: "Connect Stripe & manage bank details", to: "/dashboard/payments", icon: CreditCard, tone: "bg-lime-100 text-lime-700" },
    ],
  },
];

function MenuPage() {
  const { profile } = Route.useRouteContext() as { profile: { slug: string; clinic_name?: string | null } };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight">Menu</h1>
        <p className="text-sm text-muted-foreground">Manage every part of your clinic.</p>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your booking link</p>
            <p className="mt-1 truncate text-sm font-medium">/m/{profile.slug}</p>
          </div>
          <Button size="sm" asChild>
            <a href={`/m/${profile.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open
            </a>
          </Button>
        </CardContent>
      </Card>

      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.title}</h2>
          <div className="space-y-2">
            {g.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block rounded-2xl border bg-card p-3 shadow-sm transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
