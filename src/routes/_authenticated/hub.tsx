import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hub")({
  ssr: false,
  component: HubLayout,
});

function HubLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/hub", label: "Overview", exact: true },
    { to: "/hub/prescribing", label: "Prescribing rules" },
    { to: "/hub/visits", label: "Clinic visits" },
    { to: "/hub/referrals", label: "Referrals" },
    { to: "/hub/connections", label: "Connections" },
    { to: "/hub/verification", label: "Verification" },
  ];

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
