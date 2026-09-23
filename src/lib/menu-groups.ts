import {
  Store,
  ShieldCheck,
  MapPin,
  Palette,
  Scissors,
  CalendarDays,
  CreditCard,
  Mail,
  Megaphone,
  Shield,
  DoorOpen,
  FileText,
  FileSignature,
  Package,
  CalendarPlus,
  ClipboardList,
  Star,
  HelpCircle,
  ChevronRight,
  LogOut,
  ExternalLink,
  Percent,
  Sparkles,
  Search,
  Users,
  Info,
  Crown,
  GraduationCap,
  MessageCircle,
  Stethoscope,
  Gift,
} from "lucide-react";
import type { ElementType } from "react";

export type MenuItem = {
  label: string;
  description: string;
  to: string;
  icon: ElementType;
  tone: string;
  iconColor: string;
};

export type MenuGroup = {
  title: string;
  icon: ElementType;
  blurb: string;
  items: MenuItem[];
};

// Theme-aware icon tones — pull from the practitioner's branding tokens so
// changing the preset/colours updates every icon chip across the dashboard.
export const T = {
  espresso: { tone: "bg-primary", iconColor: "text-primary-foreground" },
  mocha: { tone: "bg-primary/80", iconColor: "text-primary-foreground" },
  taupe: { tone: "bg-accent", iconColor: "text-accent-foreground" },
  sand: { tone: "bg-muted", iconColor: "text-foreground" },
  cream: { tone: "bg-secondary", iconColor: "text-secondary-foreground" },
  ivory: { tone: "bg-card border border-border", iconColor: "text-foreground" },
};

// Single source of truth for the mobile Menu page (/dashboard/menu) AND the
// desktop sidebar — both surfaces always show the same features, grouped the
// same way, in the same order.
export const menuGroups: MenuGroup[] = [
  {
    title: "Your business",
    icon: Store,
    blurb: "Profile, branding, locations & staff",
    items: [
      { label: "Dashboard home", description: "Today's overview & analytics", to: "/dashboard", icon: Sparkles, ...T.taupe },
      { label: "Import with AI", description: "Upload PDFs, photos or a website to set up faster", to: "/dashboard/ai-import", icon: Sparkles, ...T.ivory },
      { label: "Business & Profile", description: "Clinic name, contact details & socials", to: "/dashboard/clinic", icon: Store, ...T.espresso },
      { label: "About page", description: "Your story shown to patients", to: "/dashboard/about", icon: FileText, ...T.sand },
      { label: "Branding", description: "Colours, fonts, logo & favicon", to: "/dashboard/branding", icon: Palette, ...T.sand },
      { label: "Workspace appearance", description: "Colours & fonts for your own dashboard only", to: "/dashboard/appearance", icon: Palette, ...T.ivory },
      { label: "Welcome & policies", description: "Intro heading, welcome message, deposits, cancellation, T&Cs", to: "/dashboard/policies", icon: Shield, ...T.mocha },
      { label: "Locations", description: "Manage your clinic addresses", to: "/dashboard/locations", icon: MapPin, ...T.cream },
      { label: "Practitioners", description: "Photos, titles & locations for treating staff", to: "/dashboard/practitioners", icon: Users, ...T.taupe },
      { label: "Staff", description: "Invite team members, individual rotas & staff payments", to: "/dashboard/staff", icon: ShieldCheck, ...T.espresso },
    ],
  },
  {
    title: "Clinic owner",
    icon: ShieldCheck,
    blurb: "Compliance, associates & room rental",
    items: [
      { label: "Clinic Compliance", description: "Regulated checks & audits — fridge, cleaning, equipment, HIS-style audits", to: "/dashboard/compliance", icon: ClipboardList, ...T.mocha },
      { label: "Associates", description: "Self-employed practitioners hosted in your clinic — oversight, compliance & records", to: "/dashboard/associates", icon: ShieldCheck, ...T.sand },
      { label: "Room rental", description: "Rent your rooms by the hour, half day or full day", to: "/dashboard/room-rental", icon: DoorOpen, ...T.cream },
      { label: "Find a prescriber", description: "Browse approved prescribers near you & request to connect", to: "/hub/find-prescriber", icon: Stethoscope, ...T.taupe },
    ],
  },

  {
    title: "Services & forms",
    icon: Scissors,
    blurb: "Treatments, packages, forms & training",
    items: [
      { label: "Services", description: "Treatments, categories, pricing", to: "/dashboard/services", icon: Scissors, ...T.taupe },
      { label: "Add-ons", description: "Optional extras offered with treatments", to: "/dashboard/addons", icon: Sparkles, ...T.ivory },
      { label: "Packages", description: "Bundle treatments for patients", to: "/dashboard/packages", icon: Package, ...T.espresso },
      { label: "Discounts", description: "Menu discounts & promo codes", to: "/dashboard/discounts", icon: Percent, ...T.sand },
      { label: "Gift cards", description: "Sell branded gift cards — value, treatment or package", to: "/dashboard/gift-cards", icon: Gift, ...T.cream },
      { label: "Memberships", description: "Recurring patient plans, savings pots & member perks", to: "/dashboard/memberships", icon: Crown, ...T.ivory },
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
    icon: CalendarDays,
    blurb: "Appointments, patients & reviews",
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
    icon: CreditCard,
    blurb: "Stripe, your MODO plan & invoices",
    items: [
      { label: "Payments & payouts", description: "Connect Stripe & manage payouts", to: "/dashboard/payments", icon: CreditCard, ...T.espresso },
      { label: "Products & stock", description: "Product costs, purchases & stock levels", to: "/dashboard/products", icon: Package, ...T.cream },
      { label: "Business costs", description: "Rent, room rental, bills & other outgoings", to: "/dashboard/expenses", icon: FileText, ...T.taupe },
      { label: "Plan & billing", description: "Choose your MODO plan, add-ons & direct debit", to: "/dashboard/billing", icon: CreditCard, ...T.mocha },
      { label: "Invoices", description: "MODO subscription invoices & any arrears", to: "/dashboard/invoices", icon: FileText, ...T.sand },
    ],
  },
  {
    title: "Patient notifications",
    icon: Mail,
    blurb: "Email & SMS templates and timings",
    items: [
      { label: "Email", description: "Edit wording, timings, reminders & review requests", to: "/dashboard/notifications/email", icon: Mail, ...T.taupe },
      { label: "SMS", description: "Text confirmations, reminders & review requests", to: "/dashboard/notifications/sms", icon: MessageCircle, ...T.cream },
    ],
  },
  {
    title: "Communications",
    icon: Megaphone,
    blurb: "Email & SMS marketing campaigns",
    items: [
      { label: "Marketing", description: "Send branded campaigns to opted-in patients", to: "/dashboard/marketing", icon: Megaphone, ...T.espresso },
      { label: "SMS Marketing", description: "Paid text blasts to opted-in patients", to: "/dashboard/marketing/sms", icon: MessageCircle, ...T.cream },
    ],
  },
  {
    title: "Settings",
    icon: Shield,
    blurb: "Booking rules, deposits & reminders",
    items: [
      { label: "Booking settings", description: "Notice, buffers, deposits, reminders & patient rules", to: "/dashboard/settings", icon: Shield, ...T.mocha },
    ],
  },
];

// Pilot-rolled features: open for pilot clinics, "coming soon" for everyone else.
export function getComingSoonKey(to: string, pilot: boolean): "associates" | "sms-reminders" | null {
  if (pilot) return null;
  if (to === "/dashboard/associates") return "associates";
  if (to === "/dashboard/notifications/sms") return "sms-reminders";
  return null;
}
