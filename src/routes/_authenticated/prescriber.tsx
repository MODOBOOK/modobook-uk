import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Inbox, Network, ShieldCheck, Stethoscope, Building2, CalendarDays, Pill, LayoutDashboard, ClipboardList, MoreHorizontal } from "lucide-react";
import { getHubContext } from "@/lib/hub.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { listMyReferrals } from "@/lib/prescriber.functions";
import { listMyPrescriberVisits } from "@/lib/clinic-visits.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prescriber")({
  ssr: false,
  beforeLoad: async () => {
    const ctx = await getHubContext();
    if (ctx.role !== "prescriber") {
      throw redirect({ to: "/hub" });
    }
    const profile = await getMyProfile().catch(() => null);
    return { hubCtx: ctx, hasClinic: !!profile };
  },
  component: PrescriberLayout,
});

const nav = [
  { to: "/prescriber/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, key: "dashboard" as const },
  { to: "/prescriber", label: "Referrals", shortLabel: "Referrals", icon: Inbox, exact: true, key: "referrals" as const },
  { to: "/prescriber/visits", label: "Clinic visits", shortLabel: "Visits", icon: CalendarDays, key: "visits" as const },
  { to: "/prescriber/library", label: "Prescriptions", shortLabel: "Rx", icon: Pill, key: "library" as const },
  { to: "/prescriber/directions", label: "Directions", shortLabel: "Directions", icon: ClipboardList, key: "directions" as const },
  { to: "/prescriber/connections", label: "Practitioners", shortLabel: "Team", icon: Network, key: "connections" as const },
  { to: "/hub/verification", label: "Verification", shortLabel: "Verify", icon: ShieldCheck, key: "verification" as const },
];

// Mobile: primary 4 tabs + More sheet for the rest
const mobilePrimaryKeys = ["referrals", "visits", "library", "connections"] as const;



function PrescriberLayout() {
  const { hubCtx, hasClinic } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const name = hubCtx.prescriber?.full_name ?? hubCtx.displayName ?? "Prescriber";

  const fetchRefs = useServerFn(listMyReferrals);
  const fetchVisits = useServerFn(listMyPrescriberVisits);
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
  const pendingRefs = (refsQ.data ?? []).filter((r) => r.status === "pending").length;
  const pendingVisits = (visitsQ.data ?? []).filter((v) => v.status === "pending_approval").length;
  const totalPending = pendingRefs + pendingVisits;

  useEffect(() => {
    const base = "Prescriber Hub";
    document.title = totalPending > 0 ? `(${totalPending}) ${base}` : base;
    return () => { document.title = base; };
  }, [totalPending]);

  const badges: Record<string, number> = {
    referrals: pendingRefs,
    visits: pendingVisits,
  };

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-20 items-center gap-3 border-b px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-serif text-lg leading-tight">{name}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prescriber</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-6">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const count = badges[item.key] ?? 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-luxe"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 opacity-80" />
                <span className="flex-1 tracking-wide">{item.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground",
                  )}>{count}</span>
                )}
              </Link>
            );
          })}
          {hasClinic && (
            <Link
              to="/dashboard"
              className="mt-4 flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Building2 className="h-4 w-4" />
              <span>Switch to clinic dashboard</span>
            </Link>
          )}
        </nav>
        <div className="border-t p-4">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b px-3 lg:h-20 lg:px-10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Prescriber Hub</div>
            <div className="font-serif text-lg lg:text-2xl">{name}</div>
          </div>
          {hasClinic && (
            <Link to="/dashboard" className="lg:hidden">
              <Button variant="outline" size="sm">Clinic</Button>
            </Link>
          )}
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-5 pb-24 lg:p-10">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t bg-background/95 backdrop-blur lg:hidden">
          {nav.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            const count = badges[tab.key] ?? 0;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {count > 0 && (
                  <span className="absolute right-3 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
