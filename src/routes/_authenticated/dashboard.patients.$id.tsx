import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClient } from "@/lib/clients.functions";
import {
  ArrowLeft, Activity, Camera, Pill, FileText, AlertTriangle, Loader2, Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$id")({
  ssr: false,
  component: PatientRecordShell,
});

const TABS: Array<{ to: any; label: string; icon: any; exact?: boolean; matchIndex?: boolean }> = [
  { to: "/dashboard/patients/$id/details", label: "Full record", icon: FileText, matchIndex: true },
  { to: "/dashboard/patients/$id/timeline", label: "Timeline", icon: Activity },
  { to: "/dashboard/patients/$id/photos", label: "Before / After", icon: Camera },
  { to: "/dashboard/patients/$id/medications", label: "Medications", icon: Pill },
  { to: "/dashboard/patients/$id/invoices", label: "Invoices", icon: Receipt },
];

function initials(name: string) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("") || "?";
}

function PatientRecordShell() {
  const { id } = Route.useParams();
  const path = useRouterState({ select: s => s.location.pathname });
  const get = useServerFn(getClient);
  const [client, setClient] = useState<any>(null);

  useEffect(() => { get({ data: { id } }).then(setClient).catch(() => {}); }, [id]);

  if (!client) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-16">
      <div>
        <Link to="/dashboard/patients" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />All patients
        </Link>
      </div>

      {/* Sticky patient header */}
      <div className="sticky top-0 z-20 -mx-2 rounded-none border-b bg-card/95 px-2 shadow-sm backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-0">
        <div className="flex items-center gap-3 p-2 sm:p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold sm:h-11 sm:w-11 sm:text-sm">
            {client.avatar_url ? <img src={client.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(client.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="truncate text-sm font-semibold sm:text-lg">{client.full_name}</h1>
              {client.has_allergies && (
                <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />Allergy</Badge>
              )}
              {client.safeguarding_flag && (
                <Badge variant="destructive" className="gap-1 text-[10px]">Safeguarding</Badge>
              )}
              {client.archived && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
              {[client.email, client.phone].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        {/* Mobile tab strip lives inside the sticky header so it stays put */}
        <nav className="border-t lg:hidden">
          <div className="flex gap-1 overflow-x-auto px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map(t => {
              const target = t.to.replace("$id", id);
              const active = path === target || (t.matchIndex && path === `/dashboard/patients/${id}`);
              const Icon = t.icon;
              const LinkAny = Link as any;
              return (
                <LinkAny
                  key={t.to}
                  to={t.to}
                  params={{ id }}
                  className={
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition " +
                    (active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </LinkAny>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Left rail (desktop only) */}
        <nav className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <div className="flex flex-col gap-1">
            {TABS.map(t => {
              const target = t.to.replace("$id", id);
              const active = path === target || (t.matchIndex && path === `/dashboard/patients/${id}`);
              const Icon = t.icon;
              const LinkAny = Link as any;
              return (
                <LinkAny
                  key={t.to}
                  to={t.to}
                  params={{ id }}
                  className={
                    "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition " +
                    (active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </LinkAny>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
