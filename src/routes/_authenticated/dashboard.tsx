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
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useDashboardThemeStyle } from "@/hooks/use-dashboard-theme";
import { resolveDisplayNames } from "@/lib/display-name";
import { countPendingReviews } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";





export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await getMyProfile();
    if (!profile) throw redirect({ to: "/onboarding" });
    return { profile };
  },
  component: DashboardLayout,
});

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Import with AI", to: "/dashboard/ai-import", icon: Sparkles },
  { label: "Clinic page", to: "/dashboard/clinic", icon: Store },
  { label: "Welcome & policies", to: "/dashboard/policies", icon: Shield },
  { label: "About page", to: "/dashboard/about", icon: FileText },
  { label: "Branding", to: "/dashboard/branding", icon: Palette },
  { label: "Treatment finder quiz", to: "/dashboard/quiz", icon: HelpCircle },
  { label: "Services", to: "/dashboard/services", icon: Scissors },
  { label: "Packages", to: "/dashboard/packages", icon: Package },
  { label: "Locations", to: "/dashboard/locations", icon: MapPin },
  { label: "Practitioners", to: "/dashboard/practitioners", icon: Users },
  { label: "Medical forms", to: "/dashboard/medical-forms", icon: FileText },
  { label: "Consent forms", to: "/dashboard/consent-forms", icon: FileSignature },
  { label: "Availability", to: "/dashboard/availability", icon: CalendarDays },
  { label: "New appointment", to: "/dashboard/new-appointment", icon: CalendarPlus },
  { label: "Bookings", to: "/dashboard/bookings", icon: Users },
  { label: "Patients", to: "/dashboard/patients", icon: Users },
  { label: "Consultations", to: "/dashboard/consultations", icon: ClipboardList },
  { label: "Reviews", to: "/dashboard/reviews", icon: Star },
  { label: "Payments", to: "/dashboard/payments", icon: CreditCard },
  { label: "Booking settings", to: "/dashboard/settings", icon: Settings },
];

const mobileTabs = [
  { label: "Home", to: "/dashboard", icon: Home, exact: true },
  { label: "Calendar", to: "/dashboard/bookings", icon: CalendarDays },
  { label: "Patients", to: "/dashboard/patients", icon: Users },
  { label: "Menu", to: "/dashboard/menu", icon: Menu },
];

function DashboardLayout() {
  const { profile } = Route.useRouteContext();
  const { primary: displayName } = resolveDisplayNames(profile as { clinic_name?: string | null; full_name?: string | null; display_name_mode?: string | null });
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const themeStyle = useDashboardThemeStyle();
  const fetchPending = useServerFn(countPendingReviews);
  const [pendingReviews, setPendingReviews] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => fetchPending().then((r) => { if (alive) setPendingReviews(r.count); }).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [fetchPending, pathname]);



  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen bg-background" style={themeStyle}>
      {/* Desktop sidebar */}
      <aside className="hidden w-72 flex-col border-r border-border/60 bg-sidebar lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-border/60 px-7">
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
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} badge={item.to === "/dashboard/reviews" && pendingReviews > 0 ? pendingReviews : undefined} />
          ))}
        </nav>
        <div className="border-t border-border/60 p-4">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>


      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — slim, back + brand + preview */}
        <header className="flex h-14 items-center justify-between gap-2 border-b px-3 lg:hidden">
          <BackButton />
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <span className="truncate text-sm font-semibold">{displayName || "My Clinic"}</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={`/m/${profile.slug}`} target="_blank" rel="noreferrer">Preview</a>
          </Button>
        </header>


        {/* Desktop header */}
        <header className="hidden h-20 items-center justify-between border-b border-border/60 px-10 lg:flex">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Studio</div>
              <div className="font-serif text-2xl leading-tight">{displayName || "Dashboard"}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-full px-5" asChild>
            <a href={`/m/${profile.slug}`} target="_blank" rel="noreferrer">
              Preview booking link
            </a>
          </Button>
        </header>


        <main className="min-w-0 flex-1 overflow-x-hidden p-5 pb-24 lg:p-10 lg:pb-10">
          <Outlet />
        </main>


        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 backdrop-blur lg:hidden">
          {mobileTabs.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
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
