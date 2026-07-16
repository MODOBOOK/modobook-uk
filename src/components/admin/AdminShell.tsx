import { Link, useRouterState } from "@tanstack/react-router";
import { Shield, Users, ScrollText, Mail, BadgeCheck, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/practitioners", label: "Practitioners", icon: Users },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
  { to: "/admin/emails", label: "Emails", icon: Mail },
  { to: "/admin-prescribers", label: "Prescribers", icon: BadgeCheck },
];

export function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="border-b bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <div className="mr-3 flex items-center gap-2 font-semibold">
          <Shield className="h-4 w-4 text-amber-400" />
          <span>Modo Admin</span>
        </div>
        <nav className="flex flex-wrap gap-1">
          {items.map((it) => {
            const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-amber-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-100",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
