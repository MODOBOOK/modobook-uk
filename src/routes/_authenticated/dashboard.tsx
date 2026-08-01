import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Store,
  Scissors,
  CalendarDays,
  Users,
  CreditCard,
  MapPin,
  Palette,
  FileText,
  FileSignature,
  LogOut,
  Package,
  Menu,
  CalendarPlus,
  Shield,
  Home,
  Star,
  ClipboardList,
  Settings,
  HelpCircle,
  ChevronLeft,
  Sparkles,
  Percent,
  HeartPulse,
  Info,
  Stethoscope,
  Mail,
  Gift,
  GraduationCap,
  ExternalLink,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useDashboardThemeStyle } from "@/hooks/use-dashboard-theme";
import { resolveDisplayNames } from "@/lib/display-name";
import { countPendingReviews } from "@/lib/patient.functions";
import { getHubNotifications } from "@/lib/hub.functions";
import { useServerFn } from "@tanstack/react-start";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PlatformBillingGate } from "@/components/PlatformBillingGate";





export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const { getHubContext } = await import("@/lib/hub.functions");
    const ctx = await getHubContext().catch(() => null);
    const profile = await getMyProfile();
    // Pure prescriber (no clinic profile): send them to the prescriber workspace
    if (!profile && ctx?.role === "prescriber") {
      throw redirect({ to: "/prescriber" });
    }
    if (!profile) throw redirect({ to: "/onboarding" });
    return { profile, isPrescriber: ctx?.role === "prescriber" };
  },
  component: DashboardLayout,
});


const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Analytics", to: "/dashboard/analytics", icon: TrendingUp },
  { label: "Import with AI", to: "/dashboard/ai-import", icon: Sparkles },
  { label: "Clinic page", to: "/dashboard/clinic", icon: Store },
  { label: "Welcome & policies", to: "/dashboard/policies", icon: Shield },
  { label: "About page", to: "/dashboard/about", icon: FileText },
  { label: "Branding", to: "/dashboard/branding", icon: Palette },
  
  { label: "Services", to: "/dashboard/services", icon: Scissors },
  { label: "Training", to: "/dashboard/training", icon: GraduationCap },
  { label: "Add-ons", to: "/dashboard/addons", icon: Sparkles },
  { label: "Packages", to: "/dashboard/packages", icon: Package },
  { label: "Gift cards", to: "/dashboard/gift-cards", icon: Gift },
  { label: "Discounts", to: "/dashboard/discounts", icon: Percent },
  { label: "Model slots", to: "/dashboard/model-slots", icon: Sparkles },
  { label: "Locations", to: "/dashboard/locations", icon: MapPin },
  { label: "Practitioners", to: "/dashboard/practitioners", icon: Users },
  { label: "Staff", to: "/dashboard/staff", icon: Users },
  { label: "Medical forms", to: "/dashboard/medical-forms", icon: FileText },
  { label: "Consent forms", to: "/dashboard/consent-forms", icon: FileSignature },
  { label: "Pre-treatment info", to: "/dashboard/pre-treatment", icon: Info },
  { label: "Aftercare templates", to: "/dashboard/aftercare", icon: HeartPulse },
  { label: "Attach forms", to: "/dashboard/form-allocation", icon: Sparkles },

  { label: "Booking flow", to: "/dashboard/booking-flow", icon: HelpCircle },
  { label: "Availability", to: "/dashboard/availability", icon: CalendarDays },
  { label: "New appointment", to: "/dashboard/new-appointment", icon: CalendarPlus },
  { label: "Bookings", to: "/dashboard/bookings", icon: Users },
  { label: "Patients", to: "/dashboard/patients", icon: Users },
  { label: "Consultations", to: "/dashboard/consultations", icon: ClipboardList },
  
  { label: "Reviews", to: "/dashboard/reviews", icon: Star },
  { label: "Referrals & Rewards", to: "/dashboard/rewards", icon: Gift },
  { label: "Marketing", to: "/dashboard/marketing", icon: Mail },
  { label: "Payments", to: "/dashboard/payments", icon: CreditCard },
  { label: "Plan & billing", to: "/dashboard/billing", icon: CreditCard },
  { label: "Invoices", to: "/dashboard/invoices", icon: CreditCard },
  { label: "Booking settings", to: "/dashboard/settings", icon: Settings },
  { label: "Prescriber Hub", to: "/hub", icon: Stethoscope },
  { label: "Prescription requests", to: "/dashboard/rx-requests", icon: ClipboardList },
  { label: "Prescriber referrals", to: "/dashboard/referrals", icon: ClipboardList },

];


const mobileTabs = [
  { label: "Home", to: "/dashboard", icon: Home, exact: true },
  { label: "Calendar", to: "/dashboard/bookings", icon: CalendarDays },
  { label: "Patients", to: "/dashboard/patients", icon: Users },
  { label: "Menu", to: "/dashboard/menu", icon: Menu },
];

function DashboardLayout() {
  const { profile, isPrescriber } = Route.useRouteContext();
  const { primary: displayName } = resolveDisplayNames(profile as { clinic_name?: string | null; full_name?: string | null; display_name_mode?: string | null });
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isConsultationDetail = /^\/dashboard\/consultations\/[^/]+/.test(pathname);
  const themeStyle = useDashboardThemeStyle();
  const fetchPending = useServerFn(countPendingReviews);
  const fetchHub = useServerFn(getHubNotifications);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [hubCounts, setHubCounts] = useState<{ total: number; links: number; referrals: number; visits: number }>({ total: 0, links: 0, referrals: 0, visits: 0 });
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchPending().then((r) => { if (alive) setPendingReviews(r.count); }).catch(() => {});
      fetchHub().then((r) => { if (alive) setHubCounts(r); }).catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [fetchPending, fetchHub, pathname]);



  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen bg-background" style={themeStyle}>
      {/* Desktop / iPad sidebar */}
      {/* Desktop / iPad sidebar — hidden on consultation detail for a focused, full-width workspace */}
      {!isConsultationDetail && (
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar lg:flex lg:w-72">

        <div className="flex h-20 items-center gap-3 border-b border-border/60 px-5 lg:px-7">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <span className="font-serif text-lg">{(displayName).charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-serif text-lg leading-tight">{displayName || "My Clinic"}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">MODO Studio</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-4 py-6">
          {navItems.map((item) => {
            const badge =
              item.to === "/dashboard/reviews" && pendingReviews > 0
                ? pendingReviews
                : item.to === "/hub" && hubCounts.total > 0
                  ? hubCounts.total
                  : undefined;
            return <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} badge={badge} />;
          })}
        </nav>
        <div className="border-t border-border/60 p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            asChild
          >
            <a
              href="https://wa.me/447385790119"
              target="_blank"
              rel="noreferrer"
              aria-label="Chat with MODO support on WhatsApp"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp support
            </a>
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      )}


      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — sticky, compact, back + brand + actions */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between gap-0.5 border-b bg-background px-2 lg:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)", minHeight: 44 }}
        >
          <BackButton />
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
            <span className="truncate text-sm font-semibold">{displayName || "My Clinic"}</span>
          </div>
          <NotificationsBell />
          <Link to="/hub" className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted" aria-label="Prescriber Hub">
            <Stethoscope className="h-4 w-4" />
            {hubCounts.total > 0 && (
              <span className="absolute right-0 top-0 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
                {hubCounts.total > 99 ? "99+" : hubCounts.total}
              </span>
            )}
          </Link>
          <a
            href={`/m/${profile.slug}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Preview booking page"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </header>




        {/* Desktop / iPad header */}
        <header className="sticky top-0 z-40 hidden h-20 items-center justify-between border-b border-border/60 bg-background px-6 lg:flex lg:px-10">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Studio</div>
              <div className="font-serif text-xl leading-tight lg:text-2xl">{displayName || "Dashboard"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            {isPrescriber && (
              <Link to="/prescriber"><Button variant="ghost" size="sm" className="rounded-full">Prescriber view</Button></Link>
            )}
            <Link to="/hub">
              <Button size="sm" className="relative rounded-full px-5">
                <Stethoscope className="mr-2 h-4 w-4" />
                Prescriber Hub
                {hubCounts.total > 0 && (
                  <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {hubCounts.total > 99 ? "99+" : hubCounts.total}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="rounded-full px-5" asChild>
              <a href={`/m/${profile.slug}`} target="_blank" rel="noreferrer">
                Preview booking link
              </a>
            </Button>
          </div>

        </header>


        <main
          className="min-w-0 flex-1 overflow-x-hidden p-4 pb-28 sm:p-5 lg:p-10 lg:pb-10"
          style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}
        >
          <PlatformBillingGate>
            <Outlet />
          </PlatformBillingGate>
        </main>


        {/* Mobile bottom tab bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {mobileTabs.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-[0.97]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <tab.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                </span>
                {tab.label}
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
}

function BackButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/dashboard" || pathname === "/dashboard/") return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0"
      aria-label="Back"
      onClick={() => window.history.back()}
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
        "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        "[&.active]:bg-primary [&.active]:text-primary-foreground [&.active]:shadow-luxe",
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 opacity-80" />
      <span className="flex-1 tracking-wide">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
