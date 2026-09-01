import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Users, LogOut } from "lucide-react";
import { getMyProfile } from "@/lib/profiles.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mobile")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await getMyProfile().catch(() => null);
    if (!profile) throw redirect({ to: "/dashboard" });
    return { profile };
  },
  component: MobileShell,
});

const tabs = [
  { to: "/mobile", label: "Today", icon: CalendarDays, exact: true },
  { to: "/mobile/clients", label: "Clients", icon: Users, exact: false },
];

function MobileShell() {
  const { profile } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/mobile/login";
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop admin tooling is intentionally absent here — this shell is the
          practitioner-only mobile surface. On larger screens we simply centre it. */}
      <div className="mx-auto min-h-screen max-w-md pb-28">
        <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/95 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">MODO</div>
            <div className="truncate font-serif text-2xl leading-tight">
              {(profile as { clinic_name?: string; full_name?: string })?.clinic_name ??
                (profile as { full_name?: string })?.full_name ??
                "Your clinic"}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="shrink-0 rounded-full border p-3 text-muted-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="px-5 py-6">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-2">
          {tabs.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-sm font-medium transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className="h-6 w-6" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
