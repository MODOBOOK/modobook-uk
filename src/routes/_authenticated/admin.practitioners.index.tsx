import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";
import { adminListPractitionersFull } from "@/lib/admin-console.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, ArrowRight, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/practitioners")({
  ssr: false,
  loader: async () => {
    const me = await amIAdmin();
    if (!me.admin) throw new Error("You do not have admin access.");
    return null;
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Admin only</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: Page,
});

function Page() {
  const fetchList = useServerFn(adminListPractitionersFull);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "practitioners"],
    queryFn: () => fetchList(),
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const rows = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((p) => {
      if (status === "active" && !p.active) return false;
      if (status === "inactive" && p.active) return false;
      if (!needle) return true;
      return [p.clinic_name, p.full_name, p.email, p.slug]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [data, q, status]);

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Practitioners</h1>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} total · edit branding, view their public page, suspend or reactivate. Patient data is never exposed here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, slug…"
              className="h-9 w-64 pl-7"
            />
          </div>
          <div className="flex overflow-hidden rounded-md border text-xs">
            {(["all", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={
                  "px-3 py-1.5 capitalize " +
                  (status === s ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No practitioners match.</p>
          ) : (
            <div className="divide-y">
              {rows.map((p) => (
                <div key={p.profile_id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">
                        {p.clinic_name || p.full_name || "—"}
                      </span>
                      {!p.active && <Badge variant="secondary">Suspended</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.email || "no email"} · {p.appointments_count} bookings ·{" "}
                      {p.treatments_count} treatments · joined{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {p.slug && (
                    <a
                      href={`/m/${p.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      /m/{p.slug} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <Link
                    to="/admin/practitioners/$id"
                    params={{ id: p.profile_id }}
                  >
                    <Button size="sm" variant="outline">
                      Manage <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
