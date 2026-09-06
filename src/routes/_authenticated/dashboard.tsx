import { pilotFeaturesEnabled, practitionerReferralsEnabled } from "@/lib/feature-flags";
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DoorOpen,
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
  CalendarClock,

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
  
  TrendingUp,
  MessageCircle,
  ShieldCheck,
  ClipboardCheck,

} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardThemeStyle } from "@/hooks/use-dashboard-theme";
import { resolveDisplayNames } from "@/lib/display-name";
import { countPendingReviews } from "@/lib/patient.functions";
import { getHubNotifications } from "@/lib/hub.functions";
import { useServerFn } from "@tanstack/react-start";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PlatformBillingGate } from "@/components/PlatformBillingGate";
import { ComingSoonDialog, type ComingSoonKey } from "@/components/ComingSoonDialog";
import { ClinicSwitcher } from "@/components/ClinicSwitcher";
import { canAccessRoute, type ClinicRole } from "@/lib/staff-nav";





export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const { getHubContext } = await import("@/lib/hub.functions");
    const ctx = await getHubContext().catch(() => null);
    const profile = await getMyProfile();
    // Pure prescriber (no clinic profile): send them to the prescriber workspace
    if (!profile && ctx?.isPrescriber) {
      throw redirect({ to: "/prescriber" });
    }
    if (!profile) throw redirect({ to: "/onboarding" });
    return { profile, isPrescriber: !!ctx?.isPrescriber };
  },
  component: DashboardLayout,
});


const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Analytics", to: "/dashboard/analytics", icon: TrendingUp },
  { label: "Income report", to: "/dashboard/income-report", icon: TrendingUp },
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
{ label: "Staff", to: "/dashboard/staff", icon: Users },
  { section: "Clinic owner" as const, label: "Clinic Compliance", to: "/dashboard/compliance", icon: ClipboardCheck, pilot: true },
  { section: "Clinic owner" as const, label: "Associates", to: "/dashboard/associates", icon: ShieldCheck, flag: "associates_enabled" as const, pilot: true },
  { section: "Clinic owner" as const, label: "Room rental", to: "/dashboard/room-rental", icon: DoorOpen },


  { label: "Medical forms", to: "/dashboard/medical-forms", icon: FileText },
  { label: "Consent forms", to: "/dashboard/consent-forms", icon: FileSignature },
  { label: "Pre-treatment info", to: "/dashboard/pre-treatment", icon: Info },
  { label: "Aftercare templates", to: "/dashboard/aftercare", icon: HeartPulse },
  { label: "Attach forms", to: "/dashboard/form-allocation", icon: Sparkles },

  { label: "Booking flow", to: "/dashboard/booking-flow", icon: HelpCircle },
  { label: "Availability", to: "/dashboard/availability", icon: CalendarDays },
  { label: "New appointment", to: "/dashboard/new-appointment", icon: CalendarPlus },
  { label: "Bookings", to: "/dashboard/bookings", icon: Users },
  { label: "Upcoming", to: "/dashboard/upcoming", icon: CalendarDays },
  { label: "Patients", to: "/dashboard/patients", icon: Users },
  { label: "Consultations", to: "/dashboard/consultations", icon: ClipboardList },
  
  { label: "Reviews", to: "/dashboard/reviews", icon: Star },
  { label: "Referrals & Rewards", to: "/dashboard/rewards", icon: Gift },
  { label: "Refer a practitioner", to: "/dashboard/partner-referrals", icon: Gift, referrals: true },

{ label: "Marketing", to: "/dashboard/marketing", icon: Mail },
  { label: "SMS Marketing", to: "/dashboard/sms-marketing", icon: MessageCircle, soon: true, soonKey: "sms-marketing" as ComingSoonKey },
  { label: "Payments", to: "/dashboard/payments", icon: CreditCard },
  { label: "Plan & billing", to: "/dashboard/billing", icon: CreditCard },
  { label: "Invoices", to: "/dashboard/invoices", icon: CreditCard },
{ label: "Booking settings", to: "/dashboard/settings", icon: Settings },
  { section: "Patient notifications" as const, label: "Email", to: "/dashboard/notifications/email", icon: Mail },
  { section: "Patient notifications" as const, label: "SMS", to: "/dashboard/notifications/sms", icon: MessageCircle },
  { label: "Help", to: "/dashboard/help", icon: HelpCircle },
  { label: "Prescriber Hub", to: "/hub", icon: Stethoscope },
  { label: "Prescription requests", to: "/dashboard/rx-requests", icon: ClipboardList },
  { label: "Prescriber referrals", to: "/dashboard/referrals", icon: ClipboardList },

];


const mobileTabs = [
  { label: "Home", to: "/dashboard", icon: Home, exact: true },
  { label: "Calendar", to: "/dashboard/bookings", icon: CalendarDays },
  { label: "New", to: "/dashboard/new-appointment", icon: CalendarPlus, cta: true },
  { label: "Patients", to: "/dashboard/patients", icon: Users },
  { label: "Menu", to: "/dashboard/menu", icon: Menu },
];

// While working inside the prescribing area, the bottom bar stays in that
// context instead of throwing the user back into the clinic dashboard.
const prescribingTabs = [
  { label: "Requests", to: "/dashboard/rx-requests", icon: MessageCircle, exact: true },
  { label: "Prescribing", to: "/hub/prescribing", icon: Stethoscope },
  { label: "New", to: "/dashboard/rx-requests/new", icon: CalendarPlus, cta: true },
  { label: "Hub", to: "/hub", icon: ShieldCheck, exact: true },
  { label: "Clinic", to: "/dashboard", icon: Home, exact: true },
];


function DashboardLayout() {
  const { profile, isPrescriber } = Route.useRouteContext();
  const { primary: displayName } = resolveDisplayNames(profile as { clinic_name?: string | null; full_name?: string | null; display_name_mode?: string | null });
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isConsultationDetail = /^\/dashboard\/consultations\/[^/]+/.test(pathname);
  const inPrescribing = pathname.startsWith("/dashboard/rx-requests");
  const bottomTabs = inPrescribing ? prescribingTabs : mobileTabs;

  const themeStyle = useDashboardThemeStyle();
  const fetchPending = useServerFn(countPendingReviews);
  const fetchHub = useServerFn(getHubNotifications);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [comingSoon, setComingSoon] = useState<ComingSoonKey | null>(null);
  const [hubCounts, setHubCounts] = useState<{ total: number; links: number; referrals: number; visits: number }>({ total: 0, links: 0, referrals: 0, visits: 0 });
  const [addOpen, setAddOpen] = useState(false);
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
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <div className="clinic-shell flex min-h-screen bg-background" style={themeStyle}>
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
        <ClinicSwitcher />
        {practitionerReferralsEnabled(profile?.slug) && (
          <div className="px-4 pt-4">
            <Link
              to="/dashboard/partner-referrals"
              className="block rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-4 text-primary-foreground shadow-md transition hover:shadow-lg hover:brightness-105"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Gift className="h-4.5 w-4.5" />
                </div>
                <p className="text-sm font-bold leading-tight">Give &amp; get back</p>
              </div>
              <p className="mt-2 text-xs leading-snug text-primary-foreground/90">
                Refer a fellow practitioner to MODO — they save 25%, you earn 50% off a month.
              </p>
              <p className="mt-2 text-[11px] font-semibold underline underline-offset-2">Share your code →</p>
            </Link>
          </div>
        )}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-4 py-6">
          {(() => {
            const pilotOn = pilotFeaturesEnabled(profile?.slug);
            const clinicRole = ((profile as Record<string, unknown>)?.__clinic_role as ClinicRole) ?? "owner";
            const visible = navItems.filter((item) => {
if (!canAccessRoute(clinicRole, item.to)) return false;
              if ((item as { referrals?: boolean }).referrals) return practitionerReferralsEnabled(profile?.slug);
              // Not-yet-built features (soon: true) stay visible for everyone as a "Soon" chip.
              if ((item as { soon?: boolean }).soon) return true;
              // Pilot features stay visible for everyone — non-pilot clinics see
              // a "Soon" chip and get the explainer dialog instead of the page.
              if ((item as { pilot?: boolean }).pilot && !pilotOn) return true;
              return !("flag" in item) || (profile as Record<string, unknown>)?.[(item as { flag: string }).flag];
            });
            let lastSection: string | undefined;
            return visible.map((item) => {
              const badge =
                item.to === "/dashboard/reviews" && pendingReviews > 0
                  ? pendingReviews
                  : item.to === "/hub" && hubCounts.total > 0
                    ? hubCounts.total
                    : undefined;
              const section = (item as { section?: string }).section;
              const showHeading = Boolean(section) && section !== lastSection;
              lastSection = section;
              return (
                <div key={item.to}>
                  {showHeading && (
                    <p className="cl-section-label px-3 pb-1.5 pt-5">
                      {section}
                    </p>
                  )}
{(item as { soon?: boolean }).soon ? (
                    <NavSoon
                      icon={item.icon}
                      label={item.label}
                      onClick={() =>
                        setComingSoon(
                          (item as { soonKey?: ComingSoonKey }).soonKey ?? "general",
                        )
                      }
                    />
                  ) : (item as { pilot?: boolean }).pilot && !pilotOn ? (
                    <NavSoon
                      icon={item.icon}
                      label={item.label}
                      onClick={() =>
                        setComingSoon(
                          item.to === "/dashboard/associates"
                            ? "associates"
                            : item.to === "/dashboard/notifications/sms"
                              ? "sms-reminders"
                              : "general",
                        )
                      }
                    />
                  ) : (
                    <NavLink to={item.to} icon={item.icon} label={item.label} badge={badge} />
                  )}
                </div>
              );
            });
          })()}
        </nav>

        <div className="border-t border-border/60 p-4 space-y-1.5">
          <Button
            variant="ghost"
            className="cl-rail-link w-full justify-start"
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
          <Button variant="ghost" className="cl-rail-link w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      )}


      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile: no sticky top bar — page title + actions sit inline in a brand-coloured band */}
        <div
          className="bg-primary text-primary-foreground lg:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <BackButton className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.22em] text-primary-foreground/70">
                {displayName || "My Clinic"}
              </div>
              <div className="truncate text-lg font-semibold leading-tight">
                {mobilePageTitle(pathname)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 [&_button]:text-primary-foreground">
              <Link
                to="/hub"
                aria-label="Prescriber Hub"
                className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-primary-foreground active:bg-primary-foreground/25"
              >
                <Stethoscope className="h-5 w-5" />
                {hubCounts.total > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-primary">
                    {hubCounts.total > 99 ? "99+" : hubCounts.total}
                  </span>
                )}
              </Link>
              <div className="rounded-full bg-primary-foreground/15 [&_button]:h-11 [&_button]:w-11 [&_svg]:h-5 [&_svg]:w-5">
                <NotificationsBell />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="More pages" className="ml-0.5 shrink-0 rounded-full ring-2 ring-primary-foreground/40">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20 text-sm font-semibold">
                        {(displayName || "M").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{displayName || "My Clinic"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isPrescriber && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/prescriber" className="font-medium text-primary">
                          <Stethoscope className="mr-2 h-4 w-4" /> Prescriber workspace
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild><Link to="/dashboard/settings">Settings</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/dashboard/billing">Plan &amp; billing</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/dashboard/payments">Payments</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/dashboard/marketing">Marketing</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/dashboard/reviews">Reviews</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={`/m/${profile.slug}`} target="_blank" rel="noreferrer">Preview booking page</a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>




        {/* Desktop / iPad header */}
        <header className="sticky top-0 z-40 hidden h-20 items-center justify-between border-b border-border/60 bg-background/85 px-6 backdrop-blur-md lg:flex lg:px-10">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <div className="cl-section-label">Studio</div>
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
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {bottomTabs.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            if ((tab as { cta?: boolean }).cta) {
              if (inPrescribing) {
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition active:scale-[0.97]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15 transition active:scale-95">
                      <tab.icon className="h-5 w-5" />
                    </span>
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.to}
                  type="button"
                  aria-label="Create new"
                  onClick={() => setAddOpen(true)}
                  className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition active:scale-[0.97]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15 transition active:scale-95">
                    <tab.icon className="h-5 w-5" />
                  </span>
                  {tab.label}
                </button>
              );
            }

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-[0.97]",
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

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8 pt-4">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle className="text-lg">Create new</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/dashboard/new-appointment"
                onClick={() => setAddOpen(false)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-background p-4 text-center transition active:scale-95 hover:bg-muted/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <CalendarPlus className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">Appointment</span>
              </Link>
              <Link
                to="/dashboard/services"
                onClick={() => setAddOpen(false)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-background p-4 text-center transition active:scale-95 hover:bg-muted/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Scissors className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">Service</span>
              </Link>
              <Link
                to="/dashboard/packages"
                onClick={() => setAddOpen(false)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-background p-4 text-center transition active:scale-95 hover:bg-muted/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Package className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">Package</span>
              </Link>
              <Link
                to="/dashboard/consultations"
                onClick={() => setAddOpen(false)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-background p-4 text-center transition active:scale-95 hover:bg-muted/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">Consultation</span>
              </Link>
              <Link
                to="/dashboard/availability"
                onClick={() => setAddOpen(false)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-background p-4 text-center transition active:scale-95 hover:bg-muted/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <CalendarClock className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">Availability</span>
              </Link>
            </div>

          </SheetContent>
        </Sheet>

      </div>
      <ComingSoonDialog
        open={comingSoon !== null}
        onOpenChange={(v) => !v && setComingSoon(null)}
        feature={comingSoon ?? "general"}
      />
    </div>
  );
}

function mobilePageTitle(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/dashboard";
  const map: [RegExp, string][] = [
    [/^\/dashboard$/, "Home"],
    [/^\/dashboard\/bookings/, "Calendar"],
    [/^\/dashboard\/new-appointment/, "New booking"],
    [/^\/dashboard\/patients/, "Patients"],
    [/^\/dashboard\/menu/, "Menu"],
    [/^\/dashboard\/settings/, "Settings"],
    [/^\/dashboard\/notifications/, "Notifications"],
    [/^\/dashboard\/consultations/, "Consultation"],
    [/^\/dashboard\/treatments/, "Treatments"],
    [/^\/dashboard\/packages/, "Packages"],
    [/^\/dashboard\/compliance/, "Clinic Compliance"],
    [/^\/dashboard\/staff/, "Staff"],
    [/^\/dashboard\/locations/, "Locations"],
    [/^\/dashboard\/schedule/, "Schedule"],
    [/^\/dashboard\/billing/, "Plan & billing"],
    [/^\/dashboard\/marketing/, "Marketing"],
    [/^\/dashboard\/reviews/, "Reviews"],
    [/^\/dashboard\/gift-cards/, "Gift cards"],
    [/^\/dashboard\/training/, "Training"],
    [/^\/dashboard\/room-rental/, "Room rental"],
    [/^\/dashboard\/associates/, "Associates"],
    [/^\/dashboard\/partner-referrals/, "Refer a friend"],
    [/^\/dashboard\/forms/, "Forms"],
    [/^\/dashboard\/payments/, "Payments"],
  ];
  for (const [re, title] of map) if (re.test(p)) return title;
  const last = p.split("/").pop() ?? "Dashboard";
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function BackButton({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/dashboard" || pathname === "/dashboard/") return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("shrink-0", className)}
      aria-label="Back"
      onClick={() => window.history.back()}
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
  );
}

function NavSoon({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cl-rail-link group flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
    >
      <Icon className="h-4 w-4 opacity-60" />
      <span className="flex-1 tracking-wide opacity-70">{label}</span>
      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
        Soon
      </span>
    </button>
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
      className="cl-rail-link group flex items-center gap-3 px-3 py-2.5 text-sm"
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
