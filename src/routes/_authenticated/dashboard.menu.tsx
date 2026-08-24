import { pilotFeaturesEnabled } from "@/lib/feature-flags";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DoorOpen,
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
  ShieldCheck,
  LogOut,
  ExternalLink,
  Percent,
  Sparkles,
  Search,
  Users,
  Info,
  Mail,
  Megaphone,
  Gift,
  GraduationCap,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/admin.functions";
import { ComingSoonDialog, type ComingSoonKey } from "@/components/ComingSoonDialog";
import { canAccessRoute, type ClinicRole } from "@/lib/staff-nav";

export const Route = createFileRoute("/_authenticated/dashboard/menu")({
  ssr: false,
  loader: async () => {
    try { return await amIAdmin(); } catch { return { admin: false }; }
  },
  component: MenuPage,
});

type Item = { label: string; description: string; to: string; icon: React.ElementType; tone: string; iconColor: string };

type Group = { title: string; items: Item[] };

// Theme-aware icon tones — pull from the practitioner's branding tokens so
// changing the preset/colours updates every icon chip across the dashboard.
const T = {
  espresso: { tone: "bg-primary",                    iconColor: "text-primary-foreground" },
  mocha:    { tone: "bg-primary/80",                 iconColor: "text-primary-foreground" },
  taupe:    { tone: "bg-accent",                     iconColor: "text-accent-foreground" },
  sand:     { tone: "bg-muted",                      iconColor: "text-foreground" },
  cream:    { tone: "bg-secondary",                  iconColor: "text-secondary-foreground" },
  ivory:    { tone: "bg-card border border-border",  iconColor: "text-foreground" },
};



const groups: Group[] = [
  {
    title: "Your business",
    items: [
      { label: "Dashboard home", description: "Today's overview & analytics", to: "/dashboard", icon: Sparkles, ...T.taupe },
      { label: "Import with AI", description: "Upload PDFs, photos or a website to set up faster", to: "/dashboard/ai-import", icon: Sparkles, ...T.ivory },
      { label: "Business & Profile", description: "Clinic name, contact details & socials", to: "/dashboard/clinic", icon: Store, ...T.espresso },
      { label: "About page", description: "Your story shown to patients", to: "/dashboard/about", icon: FileText, ...T.sand },
      { label: "Branding", description: "Colours, fonts, logo & favicon", to: "/dashboard/branding", icon: Palette, ...T.sand },
      { label: "Welcome & policies", description: "Intro heading, welcome message, deposits, cancellation, T&Cs", to: "/dashboard/policies", icon: Shield, ...T.mocha },
      { label: "Locations", description: "Manage your clinic addresses", to: "/dashboard/locations", icon: MapPin, ...T.cream },
      { label: "Booking profiles", description: "Photos, titles & locations for treating staff", to: "/dashboard/practitioners", icon: Users, ...T.taupe },
      { label: "Staff", description: "Invite team members & control what they can see", to: "/dashboard/staff", icon: ShieldCheck, ...T.espresso },
    ],
  },
  {
    title: "Clinic owner",
    items: [
      { label: "Associates", description: "Self-employed practitioners hosted in your clinic — oversight, compliance & records", to: "/dashboard/associates", icon: ShieldCheck, ...T.sand },
      { label: "Room rental", description: "Rent your rooms by the hour, half day or full day", to: "/dashboard/room-rental", icon: DoorOpen, ...T.cream },
    ],
  },

  {
    title: "Services & forms",
    items: [
      { label: "Services", description: "Treatments, categories, pricing", to: "/dashboard/services", icon: Scissors, ...T.taupe },
      { label: "Add-ons", description: "Optional extras offered with treatments", to: "/dashboard/addons", icon: Sparkles, ...T.ivory },
      { label: "Packages", description: "Bundle treatments for patients", to: "/dashboard/packages", icon: Package, ...T.espresso },
      { label: "Discounts", description: "Menu discounts & promo codes", to: "/dashboard/discounts", icon: Percent, ...T.sand },
      { label: "Gift cards", description: "Sell branded gift cards — value, treatment or package", to: "/dashboard/gift-cards", icon: Gift, ...T.cream },
      { label: "Model slots", description: "Discounted dates & times", to: "/dashboard/model-slots", icon: Sparkles, ...T.mocha },
      { label: "Medical forms", description: "Pre-treatment questionnaires", to: "/dashboard/medical-forms", icon: FileText, ...T.cream },
      { label: "Consent forms", description: "Templates sent at booking", to: "/dashboard/consent-forms", icon: FileSignature, ...T.ivory },
      { label: "Pre-treatment info", description: "Advice patients can read before booking", to: "/dashboard/pre-treatment", icon: Info, ...T.mocha },
      { label: "Aftercare templates", description: "Reusable post-treatment messages — auto-sent 2h after", to: "/dashboard/aftercare", icon: FileText, ...T.sand },
      { label: "Attach forms", description: "Allocate medical, consent & aftercare to each treatment — auto-sent on booking", to: "/dashboard/form-allocation", icon: Sparkles, ...T.taupe },
      { label: "Training", description: "Create courses, set locations, manage bookings", to: "/dashboard/training", icon: GraduationCap, ...T.espresso },
    ],
  },
  {
    title: "Bookings",
    items: [
      { label: "Booking flow", description: "Concern picker shown before treatments", to: "/dashboard/booking-flow", icon: HelpCircle, ...T.taupe },
      { label: "Availability", description: "Opening times & ad-hoc slots", to: "/dashboard/availability", icon: CalendarDays, ...T.espresso },
      { label: "Upcoming appointments", description: "Every booking in one list with AI patient briefs", to: "/dashboard/upcoming", icon: CalendarDays, ...T.ivory },
      { label: "New appointment", description: "Book in a patient manually", to: "/dashboard/new-appointment", icon: CalendarPlus, ...T.sand },
      { label: "Consultations", description: "MODO step-by-step records", to: "/dashboard/consultations", icon: ClipboardList, ...T.mocha },
      { label: "Patients", description: "Client list, history & files", to: "/dashboard/patients", icon: Users, ...T.cream },
      { label: "Reviews", description: "Moderate patient reviews", to: "/dashboard/reviews", icon: Star, ...T.ivory },
      { label: "Referrals & Rewards", description: "Referral bonuses, loyalty points & tiers", to: "/dashboard/rewards", icon: Gift, ...T.espresso },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Payments & payouts", description: "Connect Stripe & manage payouts", to: "/dashboard/payments", icon: CreditCard, ...T.espresso },
      { label: "Plan & billing", description: "Choose your MODO plan, add-ons & direct debit", to: "/dashboard/billing", icon: CreditCard, ...T.mocha },
      { label: "Invoices", description: "MODO subscription invoices & any arrears", to: "/dashboard/invoices", icon: FileText, ...T.sand },
    ],
  },
  {
    title: "Communications",
    items: [
      { label: "Emails", description: "Edit wording, set up appointment reminders & more", to: "/dashboard/emails", icon: Mail, ...T.taupe },
      { label: "Marketing", description: "Send branded campaigns to opted-in patients", to: "/dashboard/marketing", icon: Megaphone, ...T.espresso },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Booking settings", description: "Notice, buffers, deposits, reminders & patient rules", to: "/dashboard/settings", icon: Shield, ...T.mocha },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Help & FAQ", description: "How-to guides for running your clinic", to: "/dashboard/help", icon: HelpCircle, ...T.taupe },
    ],
  },
];

function MenuPage() {
  const { profile } = Route.useRouteContext() as {
    profile: {
      slug: string;
      clinic_name?: string | null;
      associates_enabled?: boolean | null;
      __clinic_role?: ClinicRole;
    };
  };
  const clinicRole: ClinicRole = profile.__clinic_role ?? "owner";
  const { admin } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [comingSoon, setComingSoon] = useState<ComingSoonKey | null>(null);


  const pilot = pilotFeaturesEnabled(profile.slug);

function comingSoonFor(to: string): ComingSoonKey | null {
    // Not-yet-built features: coming soon for everyone, including pilot clinics.
    if (to === "/dashboard/sms-marketing") return "sms-marketing";
    if (to === "/dashboard/staff-updates") return "staff-updates";
    // Pilot-rolled features: open for pilot clinics, coming soon for everyone else.
    if (pilot) return null;
    if (to === "/dashboard/associates") return "associates";
    if (to === "/dashboard/notifications/sms") return "sms-reminders";
    return null;
  }

  const filtered = useMemo(() => {
    const visible = groups.map((g) => ({
      ...g,
      items: g.items
        .filter((i) => canAccessRoute(clinicRole, i.to))
        .filter((i) =>
          i.to === "/dashboard/associates"
            ? pilot
              ? !!profile.associates_enabled
              : true // non-pilot clinics see it as "coming soon"
            : true,
        ),
    })).filter((g) => g.items.length > 0);
    if (!query.trim()) return visible;
    const q = query.toLowerCase();
    return visible
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query, profile.associates_enabled, pilot, clinicRole]);


  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1">
      <div className="pt-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">My Clinic</h1>
        <p className="mt-1 text-sm text-muted-foreground">{profile.clinic_name || "Manage your clinic"}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you looking for?"
          className="h-12 rounded-full border-muted-foreground/20 pl-11 pr-4 shadow-sm"
        />
      </div>

      <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your booking link</p>
            <p className="mt-0.5 truncate text-sm font-semibold">/m/{profile.slug}</p>
          </div>
          <Button size="sm" asChild className="rounded-full">
            <a href={`/m/${profile.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open
            </a>
          </Button>
        </CardContent>
      </Card>

      {filtered.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{g.title}</h2>
          <div className="space-y-3">
            {g.items.map((item) => {
              const soon = comingSoonFor(item.to);
              const Wrapper = ({ children }: { children: React.ReactNode }) =>
                soon ? (
                  <button
                    type="button"
                    onClick={() => setComingSoon(soon)}
                    className="group block w-full rounded-2xl border border-primary/20 bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-primary/40 active:scale-[0.99]"
                  >
                    {children}
                  </button>
                ) : (
                  <Link
                    to={item.to}
                    className="group block rounded-2xl border border-muted-foreground/10 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
                  >
                    {children}
                  </Link>
                );
              return (
              <Wrapper key={item.to}>
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 ${item.tone}`}>
                    <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-base font-semibold leading-tight">
                      {item.label}
                      {soon && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                          Soon
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                </div>
              </Wrapper>
              );
            })}
          </div>
        </section>
      ))}


      {admin && (
        <section className="space-y-3">
          <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Platform</h2>
          <Link to="/admin" className="block rounded-2xl border border-muted-foreground/10 bg-card p-4 shadow-sm transition active:scale-[0.99]">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-black/5">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-tight">Platform admin</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">Practitioners, admins & invites</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          </Link>
        </section>
      )}

      <a
        href="https://wa.me/447385790119"
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white ring-1 ring-black/5">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">WhatsApp support</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Message the MODO team — +44 7385 790119</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </a>

      <Button
        variant="outline"
        size="lg"
        className="w-full rounded-full"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut className="mr-2 h-4 w-4" /> Log out
      </Button>
      <div className="h-4" />
      <ComingSoonDialog
        open={comingSoon !== null}
        onOpenChange={(v) => !v && setComingSoon(null)}
        feature={comingSoon ?? "general"}
      />
    </div>
  );
}
