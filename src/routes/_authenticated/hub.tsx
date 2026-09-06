import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ArrowLeft,
  LayoutDashboard,
  CalendarDays,
  Send,
  Network,
  ShieldCheck,
  Pill,
  Stethoscope,
  MoreHorizontal,
} from "lucide-react";
import { getHubContext } from "@/lib/hub.functions";
import { listMyClinicVisits } from "@/lib/clinic-visits.functions";
import { listSentReferrals } from "@/lib/prescriber.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hub")({
  ssr: false,
  component: HubLayout,
});

// Prescriber-ONLY users (no clinic profile) get bounced to their dedicated
// workspace. Dual-role users (practitioner + approved prescriber) keep full
// access to both the Hub and the /prescriber workspace and switch via the
// header links below.
// Being an APPROVED prescriber overrides the clinic view: those users always
// land in the prescriber workspace for anything that has a prescriber-side
// equivalent. Clinic-only settings (prescribing rules, connected prescribers,
// verification) stay here and are linked from the prescriber workspace.
const PRESCRIBER_REDIRECTS: Record<string, string> = {
  "/hub/visits": "/prescriber/visits",
  "/hub/referrals": "/prescriber",
  "/hub/invoices": "/prescriber/invoices",
  "/hub": "/prescriber/dashboard",
};

// The Hub is the PRACTITIONER-side prescribing surface. Prescriber-only
// features (Rx approvals, Invoices they issue, Directions, Library) live
// in the dedicated /prescriber workspace — reached via the "Prescriber
// view" button in the header. Do not mix them in here or the nav
// overflows on mobile for dual-role users.
const nav = [
  { to: "/hub", label: "Overview", icon: LayoutDashboard, exact: true, key: "overview" as const, primary: true },
  { to: "/dashboard/rx-requests", label: "Rx", icon: Send, key: "rx-requests" as const, primary: true },
  { to: "/hub/visits", label: "Clinic days", icon: CalendarDays, key: "visits" as const, primary: true },
  { to: "/hub/referrals", label: "Referrals", icon: Send, key: "referrals" as const, primary: true },
  { to: "/hub/prescribing", label: "Rules", icon: Pill, key: "prescribing" as const },
  { to: "/hub/connections", label: "Prescribers", icon: Network, key: "connections" as const },
  { to: "/hub/verification", label: "Verification", icon: ShieldCheck, key: "verification" as const },
];

const primaryNav = nav.filter((n) => n.primary);
const moreNav = nav.filter((n) => !n.primary);

function HubLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getHubContext);
  const fetchVisits = useServerFn(listMyClinicVisits);
  const fetchRefs = useServerFn(listSentReferrals);
  const [moreOpen, setMoreOpen] = useState(false);

  const ctxQ = useQuery({ queryKey: ["hub-context"], queryFn: () => fetchCtx() });
  const isPractitioner = ctxQ.data?.isPractitioner ?? false;
  const isPrescriber = ctxQ.data?.isPrescriber ?? false;
  const prescriberOnly = isPrescriber && !isPractitioner;
  // Approved prescribers (with or without a clinic) work from /prescriber.
  const routeToPrescriber = ctxQ.data?.prescriber?.status === "approved";

  useEffect(() => {
    if (!routeToPrescriber) return;
    const target = PRESCRIBER_REDIRECTS[pathname];
    if (target) navigate({ to: target, replace: true });
  }, [routeToPrescriber, pathname, navigate]);

  const visitsQ = useQuery({
    queryKey: ["hub-nav-visits"],
    queryFn: () => fetchVisits(),
    enabled: !prescriberOnly,
    refetchInterval: 60_000,
  });
  const refsQ = useQuery({
    queryKey: ["hub-nav-sent-refs"],
    queryFn: () => fetchRefs(),
    enabled: !prescriberOnly,
    refetchInterval: 60_000,
  });

  const awaitingVisits = (visitsQ.data ?? []).filter(
    (v) => v.status !== "cancelled" && !v.confirmed_by_prescriber && v.status !== "pending_approval",
  ).length;
  const pendingRefs = (refsQ.data ?? []).filter((r) => r.status === "pending").length;

  const badges: Record<string, number> = {
    visits: awaitingVisits,
    referrals: pendingRefs,
  };

  const moreCount = moreNav.reduce((n, i) => n + (badges[i.key] ?? 0), 0);
  const name = ctxQ.data?.displayName ?? "Prescriber Hub";
  const activeLabel = nav.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? "Overview";

  return (
    <div className="rx-theme flex min-h-screen bg-background text-foreground">
      <aside className="rx-rail hidden w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-20 items-center gap-3 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-tight tracking-tight">{name}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Prescriber Hub</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const count = badges[item.key] ?? 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 opacity-90" />
                <span className="flex-1">{item.label === "Rx" ? "Rx requests" : item.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            to="/dashboard"
            className="mt-4 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-primary/5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to dashboard</span>
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-2 px-4 lg:h-20 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:hidden">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Prescriber Hub
                </div>
                <div className="truncate text-lg font-semibold tracking-tight lg:text-2xl">
                  <span className="lg:hidden">{activeLabel}</span>
                  <span className="hidden lg:inline">{name}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPrescriber && (
                <Link to="/prescriber">
                  <Button variant="outline" size="sm" className="rounded-full">
                    <Stethoscope className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Prescriber view</span>
                  </Button>
                </Link>
              )}
              <Link to="/dashboard" className="lg:hidden">
                <Button variant="ghost" size="sm" className="rounded-full">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-32 sm:p-5 lg:p-10">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5">
            {primaryNav.map((tab) => {
              const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
              const count = badges[tab.key] ?? 0;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-12 items-center justify-center rounded-full transition",
                      active && "bg-primary/12",
                    )}
                  >
                    <tab.icon className="h-5 w-5" />
                  </span>
                  <span className="max-w-full truncate px-1">{tab.label}</span>
                  {count > 0 && (
                    <span className="absolute right-3 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
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
                  className="relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground"
                >
                  <span className="flex h-8 w-12 items-center justify-center rounded-full">
                    <MoreHorizontal className="h-5 w-5" />
                  </span>
                  <span>More</span>
                  {moreCount > 0 && (
                    <span className="absolute right-3 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {moreCount}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl pb-8">
                <SheetHeader className="text-left">
                  <SheetTitle>More</SheetTitle>
                </SheetHeader>
                <div className="mt-3 space-y-1">
                  {moreNav.map((item) => {
                    const count = badges[item.key] ?? 0;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm font-medium"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                            {count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  <Link
                    to="/dashboard"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to dashboard
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </div>
  );
}
