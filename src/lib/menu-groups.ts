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
  ClipboardList,
  HelpCircle,
  ShieldCheck,
  Percent,
  Sparkles,
  Users,
  Info,
  Mail,
  Megaphone,
  Gift,
  GraduationCap,
  MessageCircle,
  Stethoscope,
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
} as const;

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
      { label: "Associates", description: "Invite associates to work under your clinic, rent rooms & manage their own clients", to: "/dashboard/associates", icon: Users, ...T.sand },
      { label: "Room Rental", description: "Rent clinic rooms by the hour with live availability", to: "/dashboard/room-rental", icon: MapPin, ...T.cream },
      { label: "Training", description: "Accredited courses students can book & pay for online", to: "/dashboard/training", icon: GraduationCap, ...T.taupe },
    ],
  },
  {
    title: "Bookings",
    icon: CalendarDays,
    blurb: "Appointments, availability & bookings",
    items: [
      { label: "Bookings", description: "Every appointment, past & upcoming", to: "/dashboard/bookings", icon: CalendarDays, ...T.espresso },
      { label: "Availability", description: "Working hours, holidays & one-off dates", to: "/dashboard/availability", icon: CalendarDays, ...T.sand },
      { label: "Treatments", description: "Services, durations, prices & deposits", to: "/dashboard/services", icon: Scissors, ...T.cream },
      { label: "Packages & courses", description: "Multi-session packages & course booking", to: "/dashboard/packages", icon: Package, ...T.mocha },
      { label: "Booking windows", description: "Open dates patients can book directly", to: "/dashboard/booking-windows", icon: CalendarDays, ...T.ivory },
      { label: "Booking link", description: "Your shareable booking page", to: "/dashboard/booking-link", icon: Info, ...T.taupe },
      { label: "Reviews", description: "Patient reviews after visits", to: "/dashboard/reviews", icon: Star, ...T.sand },
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    blurb: "Stripe, invoices & payouts",
    items: [
      { label: "Payments & payouts", description: "Stripe, refunds & payout schedule", to: "/dashboard/payments", icon: CreditCard, ...T.espresso },
      { label: "Invoices", description: "Create & send invoices", to: "/dashboard/invoices", icon: FileText, ...T.mocha },
      { label: "Prescription invoices", description: "Invoices from prescriber appointments", to: "/dashboard/rx-invoices", icon: FileText, ...T.sand },
      { label: "Commission", description: "Split clinic-owned bookings with associates", to: "/dashboard/commission", icon: Percent, ...T.ivory },
      { label: "Gift cards", description: "Sell & track gift cards", to: "/dashboard/gift-cards", icon: Gift, ...T.cream },
    ],
  },
  {
    title: "Clients",
    icon: Users,
    blurb: "Patient records, forms & marketing",
    items: [
      { label: "Patients", description: "Records, notes & treatment history", to: "/dashboard/patients", icon: Users, ...T.espresso },
      { label: "Consultations", description: "Forms, notes & face mapping", to: "/dashboard/consultations", icon: ClipboardList, ...T.sand },
      { label: "Medical forms", description: "Build & send medical history forms", to: "/dashboard/forms", icon: FileSignature, ...T.mocha },
      { label: "Client marketing", description: "Campaigns, audiences & automation", to: "/dashboard/marketing", icon: Megaphone, ...T.taupe },
      { label: "Memberships", description: "Recurring plans & loyalty for your patients", to: "/dashboard/memberships", icon: Percent, ...T.ivory },
    ],
  },
  {
    title: "Patient notifications",
    icon: Mail,
    blurb: "Reminders, emails & alerts",
    items: [
      { label: "Notifications", description: "Email & SMS reminders and alerts", to: "/dashboard/notifications", icon: Mail, ...T.espresso },
      { label: "SMS Marketing", description: "Text campaigns & bulk SMS to opted-in clients", to: "/dashboard/marketing/sms", icon: MessageCircle, ...T.ivory },
    ],
  },
  {
    title: "Settings",
    icon: Shield,
    blurb: "Booking rules, deposits & reminders",
    items: [
      { label: "Booking settings", description: "Notice, buffers, deposits, reminders & patient rules", to: "/dashboard/settings", icon: Shield, ...T.mocha },
et  ],
  },
];

// Pilot-rolled features: open for pilot clinics, "coming soon" for everyone else.
export function getComingSoonKey(to: string, pilot: boolean): "associates" | "sms-reminders" | null {
  if (pilot) return null;
  if (to === "/dashboard/associates") return "associates";
  if (to === "/dashboard/notifications/sms") return "sms-reminders";
  return null;
}
