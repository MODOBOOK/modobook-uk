import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Inbox, Network, ShieldCheck, Stethoscope, Building2 } from "lucide-react";
import { getHubContext } from "@/lib/hub.functions";
import { getMyProfile } from "@/lib/profiles.functions";
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
  { to: "/prescriber", label: "Referrals", icon: Inbox, exact: true },
  { to: "/hub/connections", label: "Connections", icon: Network },
  { to: "/hub/verification", label: "Verification", icon: ShieldCheck },
  { to: "/hub", label: "Hub overview", icon: Stethoscope },
];

function PrescriberLayout() {
  const { hubCtx, hasClinic } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const name = hubCtx.prescriber?.full_name ?? hubCtx.displayName ?? "Prescriber";

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

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 backdrop-blur lg:hidden">
          {nav.map((tab) => {
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
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
