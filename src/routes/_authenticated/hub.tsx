import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  LayoutDashboard,
  CalendarDays,
  Send,
  Network,
  ShieldCheck,
  Pill,
  Stethoscope,
  FileText,
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
const PRESCRIBER_ONLY_REDIRECTS: Record<string, string> = {
  "/hub/visits": "/prescriber/visits",
  "/hub/prescribing": "/prescriber",
  "/hub/referrals": "/prescriber",
  "/hub/invoices": "/prescriber/invoices",
  "/hub": "/prescriber",
};

// The Hub is the PRACTITIONER-side prescribing surface. Prescriber-only
// features (Rx approvals, Invoices they issue, Directions, Library) live
// in the dedicated /prescriber workspace — reached via the "Prescriber
// view" button in the header. Do not mix them in here or the nav
// overflows on mobile for dual-role users.
const nav = [
  { to: "/hub", label: "Overview", icon: LayoutDashboard, exact: true, key: "overview" as const },
  { to: "/dashboard/rx-requests", label: "Rx requests", icon: Send, key: "rx-requests" as const },
  { to: "/hub/visits", label: "Clinic days", icon: CalendarDays, key: "visits" as const },
  { to: "/hub/referrals", label: "Referrals", icon: Send, key: "referrals" as const },
  { to: "/hub/prescribing", label: "Rules", icon: Pill, key: "prescribing" as const },
  { to: "/hub/connections", label: "Prescribers", icon: Network, key: "connections" as const },
  { to: "/hub/verification", label: "Verification", icon: ShieldCheck, key: "verification" as const },
];

function HubLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getHubContext);
  const fetchVisits = useServerFn(listMyClinicVisits);
  const fetchRefs = useServerFn(listSentReferrals);

  const ctxQ = useQuery({ queryKey: ["hub-context"], queryFn: () => fetchCtx() });
  const isPractitioner = ctxQ.data?.isPractitioner ?? false;
  const isPrescriber = ctxQ.data?.isPrescriber ?? false;
  // Only prescriber-ONLY users (no clinic) get redirected away from practitioner Hub pages.
  const prescriberOnly = isPrescriber && !isPractitioner;

  useEffect(() => {
    if (!prescriberOnly) return;
    const target = PRESCRIBER_ONLY_REDIRECTS[pathname];
    if (target) navigate({ to: target, replace: true });
  }, [prescriberOnly, pathname, navigate]);

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

  const name = ctxQ.data?.displayName ?? "Prescriber Hub";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-20 items-center gap-3 border-b px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-serif text-lg leading-tight">{name}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prescriber Hub</div>
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
                  <span
                    className={cn(
                      "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-primary text-primary-foreground",
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
            className="mt-4 flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to dashboard</span>
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b px-3 lg:h-20 lg:px-10">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Prescriber Hub</div>
            <div className="truncate font-serif text-lg lg:text-2xl">{name}</div>
          </div>
          <div className="flex items-center gap-2">
            {isPrescriber && (
              <Link to="/prescriber">
                <Button variant="outline" size="sm">
                  <Stethoscope className="mr-1 h-4 w-4" /> Prescriber view
                </Button>
              </Link>
            )}
            <Link to="/dashboard" className="lg:hidden">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-24 sm:p-5 lg:p-10">
          <Outlet />
        </main>

        <nav className={cn(
          "fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 backdrop-blur lg:hidden",
          isPrescriber ? "grid-cols-7" : "grid-cols-6",
        )}>
          {nav.filter((i) => (!i.prescriberOnly || isPrescriber) && (!i.practitionerOnly || isPractitioner)).map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
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
                <span className="max-w-full truncate px-1">{tab.label}</span>
                {count > 0 && (
                  <span className="absolute right-2 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
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
