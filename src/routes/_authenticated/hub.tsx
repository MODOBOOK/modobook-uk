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
                data-active={active}
                className="rx-rail-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              >
                <item.icon className="h-4 w-4 opacity-90" />
                <span className="flex-1">{item.label === "Rx" ? "Rx requests" : item.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                      active
                        ? "bg-[var(--sidebar-primary-foreground)]/20 text-[var(--sidebar-primary-foreground)]"
                        : "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]",
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
            className="rx-rail-link mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition"
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

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 pb-32 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5">
            <Outlet />
          </div>
        </main>

        <PrescriberBottomNav
          tabs={primaryNav.map((t) => ({
            to: t.to,
            label: t.label,
            icon: t.icon,
            exact: t.exact,
            count: badges[t.key] ?? 0,
          }))}
          moreItems={[
            ...moreNav.map((t) => ({
              to: t.to,
              label: t.label,
              icon: t.icon,
              count: badges[t.key] ?? 0,
            })),
            { to: "/dashboard", label: "Clinic dashboard", icon: ArrowLeft },
          ]}
        />
      </div>
    </div>
  );
}
