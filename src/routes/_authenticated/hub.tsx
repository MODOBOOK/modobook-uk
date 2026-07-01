import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getHubContext } from "@/lib/hub.functions";

export const Route = createFileRoute("/_authenticated/hub")({
  ssr: false,
  component: HubLayout,
});

// Prescriber-only routes get sent to their dedicated workspace
const PRESCRIBER_REDIRECTS: Record<string, string> = {
  "/hub/visits": "/prescriber/visits",
  "/hub/prescribing": "/prescriber",
  "/hub/referrals": "/prescriber",
  "/hub": "/prescriber",
};

function HubLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getHubContext);
  const ctxQ = useQuery({ queryKey: ["hub-context"], queryFn: () => fetchCtx() });
  const role = ctxQ.data?.role ?? null;
  const isPrescriber = role === "prescriber";

  // If a prescriber lands on a practitioner-only hub page, bounce them to
  // their own workspace so the UI matches their role.
  useEffect(() => {
    if (!isPrescriber) return;
    const target = PRESCRIBER_REDIRECTS[pathname];
    if (target) navigate({ to: target, replace: true });
  }, [isPrescriber, pathname, navigate]);

  const practitionerTabs = [
    { to: "/hub", label: "Overview", exact: true },
    { to: "/hub/prescribing", label: "Prescribing rules" },
    { to: "/hub/visits", label: "Clinic visits" },
    { to: "/hub/referrals", label: "Referrals" },
    { to: "/hub/connections", label: "Connections" },
    { to: "/hub/verification", label: "Verification" },
  ];

  const prescriberTabs = [
    { to: "/prescriber", label: "Overview", exact: true },
    { to: "/prescriber/visits", label: "Clinic visits" },
    { to: "/prescriber/connections", label: "Practitioners" },
    { to: "/hub/verification", label: "Verification" },
  ];

  const tabs = isPrescriber ? prescriberTabs : practitionerTabs;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="font-serif text-2xl">Prescriber Hub</h1>
            <p className="text-xs text-muted-foreground">Connect practitioners and prescribers, share clinical context.</p>
          </div>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Button>
          </Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-2">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`rounded-t-md border-b-2 px-4 py-2 text-sm transition ${
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
