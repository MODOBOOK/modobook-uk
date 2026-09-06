import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Inbox, Network, ShieldCheck, Stethoscope, Building2, CalendarDays, Pill, LayoutDashboard, ClipboardList, MoreHorizontal, FileText, MessageSquareText, Compass } from "lucide-react";
import { getHubContext } from "@/lib/hub.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { listMyReferrals } from "@/lib/prescriber.functions";
import { listConnectRequests } from "@/lib/prescriber-directory.functions";
import { listMyPrescriberVisits } from "@/lib/clinic-visits.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prescriber")({
  ssr: false,
  beforeLoad: async () => {
    const ctx = await getHubContext();
    // Any approved prescriber can access this workspace — including dual-role
    // users who also run a clinic. Non-prescribers bounce back to the Hub.
    if (!ctx.isPrescriber) {
      throw redirect({ to: "/hub" });
    }
    const profile = await getMyProfile().catch(() => null);
    return { hubCtx: ctx, hasClinic: !!profile };
  },
  component: PrescriberLayout,
});

type NavItem = { to: string; label: string; icon: typeof Inbox; exact?: boolean; key: string };

// Core day-to-day destinations — everything else lives under "More".
const nav: (NavItem & { shortLabel: string })[] = [
  { to: "/prescriber/dashboard", label: "Home", shortLabel: "Home", icon: LayoutDashboard, key: "dashboard" },
  { to: "/prescriber/requests", label: "Requests", shortLabel: "Requests", icon: MessageSquareText, key: "requests" },
  { to: "/prescriber/library", label: "Prescriptions", shortLabel: "Rx", icon: Pill, key: "library" },
  { to: "/prescriber/directory", label: "Discovery", shortLabel: "Discovery", icon: Compass, key: "directory" },
];

// Secondary items — desktop sidebar section & mobile More sheet.
const moreNav: NavItem[] = [
  { to: "/prescriber/connections", label: "Practitioners", icon: Network, key: "connections" },
  { to: "/prescriber", label: "Referrals", icon: Inbox, exact: true, key: "referrals" },
  { to: "/prescriber/visits", label: "Clinic visits", icon: CalendarDays, key: "visits" },
  { to: "/prescriber/directions", label: "Directions", icon: ClipboardList, key: "directions" },
  { to: "/prescriber/invoices", label: "Invoices", icon: FileText, key: "invoices" },
  { to: "/hub/verification", label: "Verification", icon: ShieldCheck, key: "verification" },
];

// Clinic-side prescribing settings — only shown to users who also run a clinic.
const clinicNav: NavItem[] = [
  { to: "/hub/prescribing", label: "Clinic prescribing rules", icon: Pill, key: "clinic-rules" },
  { to: "/hub/connections", label: "My clinic's prescribers", icon: Network, key: "clinic-connections" },
];





function PrescriberLayout() {
  const { hubCtx, hasClinic } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const name = hubCtx.prescriber?.full_name ?? hubCtx.displayName ?? "Prescriber";
  const [moreOpen, setMoreOpen] = useState(false);

  const fetchRefs = useServerFn(listMyReferrals);
  const fetchVisits = useServerFn(listMyPrescriberVisits);
  const fetchConnects = useServerFn(listConnectRequests);
  const refsQ = useQuery({
    queryKey: ["prescriber-nav-refs"],
    queryFn: () => fetchRefs(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const visitsQ = useQuery({
    queryKey: ["prescriber-nav-visits"],
    queryFn: () => fetchVisits(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const connectsQ = useQuery({
    queryKey: ["connect-requests"],
    queryFn: () => fetchConnects(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const pendingRefs = (refsQ.data ?? []).filter((r) => r.status === "pending").length;
  const pendingVisits = (visitsQ.data ?? []).filter((v) => v.status === "pending_approval").length;
  const pendingConnects = (connectsQ.data ?? []).filter((r) => r.direction === "received" && r.status === "pending").length;
  const totalPending = pendingRefs + pendingVisits + pendingConnects;

  useEffect(() => {
    const base = "Prescriber Hub";
    document.title = totalPending > 0 ? `(${totalPending}) ${base}` : base;
    return () => { document.title = base; };
  }, [totalPending]);

  const badges: Record<string, number> = {
    referrals: pendingRefs,
    visits: pendingVisits,
    directory: pendingConnects,
  };

  async function signOut() {
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <div className="rx-theme flex min-h-screen bg-background text-foreground">
      <aside className="rx-rail hidden w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-[var(--sidebar-border)] px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold leading-tight">{name}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Prescriber Hub</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-6">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const count = badges[item.key] ?? 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                data-active={active}
                className="rx-rail-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all"
              >
                <item.icon className="h-4 w-4 opacity-80" />
                <span className="flex-1 tracking-wide">{item.label}</span>
                {count > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sidebar-primary)] px-1.5 text-[11px] font-semibold text-[var(--sidebar-primary-foreground)]">{count}</span>
                )}
              </Link>
            );
          })}
          <div className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-50">More</div>
          {moreNav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const count = badges[item.key] ?? 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                data-active={active}
                className="rx-rail-link flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all"
              >
                <item.icon className="h-4 w-4 opacity-80" />
                <span className="flex-1 tracking-wide">{item.label}</span>
                {count > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sidebar-primary)] px-1.5 text-[11px] font-semibold text-[var(--sidebar-primary-foreground)]">{count}</span>
                )}
              </Link>
            );
          })}
          {hasClinic && (
            <>
              <div className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-50">My clinic</div>
              {clinicNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  data-active={pathname.startsWith(item.to)}
                  className="rx-rail-link flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all"
                >
                  <item.icon className="h-4 w-4 opacity-80" />
                  <span className="flex-1 tracking-wide">{item.label}</span>
                </Link>
              ))}
            </>
          )}
          {hasClinic && (
            <Link
              to="/dashboard"
              className="rx-rail-link mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[var(--sidebar-border)] px-3 py-2.5 text-sm"
            >
              <Building2 className="h-4 w-4" />
              <span>Switch to clinic dashboard</span>
            </Link>
          )}
        </nav>
        <div className="border-t border-[var(--sidebar-border)] p-4">
          <Button variant="ghost" className="rx-rail-link w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>


      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-[var(--sidebar-border)] bg-[var(--sidebar)] px-4 text-[var(--sidebar-foreground)] lg:px-10">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] lg:hidden">
              <Stethoscope className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold lg:text-xl">{name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Prescriber Hub</div>
            </div>
          </div>
          {hasClinic && (
            <Link to="/dashboard" className="lg:hidden">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--sidebar-border)] px-3 py-1.5 text-xs font-medium">
                <Building2 className="h-3.5 w-3.5" /> Clinic
              </span>
            </Link>
          )}
        </header>


        <main className="min-w-0 flex-1 overflow-x-hidden p-5 pb-24 lg:p-10">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {nav.map((tab) => {
            const active = pathname.startsWith(tab.to);
            const count = badges[tab.key] ?? 0;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className="h-5 w-5" />
                <span className="truncate">{tab.shortLabel}</span>
                {count > 0 && (
                  <span className="absolute right-4 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground transition"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
              <SheetHeader>
                <SheetTitle className="font-serif text-lg">More</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {moreNav.map((tab) => {
                  const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
                  const count = badges[tab.key] ?? 0;
                  return (
                    <Link
                      key={tab.to}
                      to={tab.to}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs font-medium transition",
                        active ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <tab.icon className="h-5 w-5" />
                      <span className="text-center">{tab.label}</span>
                      {count > 0 && (
                        <span className="absolute right-2 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {count}
                        </span>
                      )}
                    </Link>
                  );
                })}
                {hasClinic && clinicNav.map((tab) => (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs font-medium transition",
                      pathname.startsWith(tab.to) ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <tab.icon className="h-5 w-5" />
                    <span className="text-center">{tab.label}</span>
                  </Link>
                ))}
                {hasClinic && (
                  <Link
                    to="/dashboard"
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    <Building2 className="h-5 w-5" />
                    <span className="text-center">Clinic dashboard</span>
                  </Link>
                )}
              </div>
              <Button
                variant="ghost"
                className="mt-4 w-full justify-center text-muted-foreground"
                onClick={() => { setMoreOpen(false); void signOut(); }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </div>
  );
}
