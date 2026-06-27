import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Store,
  Scissors,
  FolderTree,
  CalendarDays,
  Users,
  CreditCard,
  LogOut,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await getMyProfile();
    if (!profile) {
      throw redirect({ to: "/onboarding" });
    }
    return { profile };
  },
  component: DashboardLayout,
});

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Clinic page", to: "/dashboard/clinic", icon: Store },
  { label: "Treatments", to: "/dashboard/treatments", icon: Scissors },
  { label: "Availability", to: "/dashboard/availability", icon: CalendarDays },
  { label: "Bookings", to: "/dashboard/bookings", icon: Users },
  { label: "Payments", to: "/dashboard/payments", icon: CreditCard },
];

function DashboardLayout() {
  const { profile } = Route.useRouteContext();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r bg-muted/30 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="truncate text-sm font-semibold">{profile.clinic_name || "My Clinic"}</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}
        </nav>
        <div className="border-t p-4">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex h-16 items-center gap-2 border-b px-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Store className="h-5 w-5" />
                  </div>
                  <span className="truncate text-sm font-semibold">{profile.clinic_name || "My Clinic"}</span>
                </div>
                <nav className="space-y-1 p-4">
                  {navItems.map((item) => (
                    <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={() => setOpen(false)} />
                  ))}
                </nav>
                <div className="border-t p-4">
                  <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-semibold lg:hidden">{profile.clinic_name || "My Clinic"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/book/${profile.slug}`} target="_blank" rel="noreferrer">
                Preview link
              </a>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        "[&.active]:bg-primary/10 [&.active]:text-primary",
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
