import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { amIAdmin } from "@/lib/admin.functions";
import { adminListAudit } from "@/lib/admin-console.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuditRow } from "@/routes/_authenticated/admin.practitioners.$id";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
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
  const listAudit = useServerFn(adminListAudit);
  const [action, setAction] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-all", action],
    queryFn: () =>
      listAudit({ data: { action: action.trim() || null, limit: 300 } }),
  });

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Every admin action across the platform, newest first.
          </p>
        </div>
        <Input
          placeholder="Filter by action (e.g. profile_edit)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-9 w-64"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : !data?.length ? (
            <p className="p-4 text-sm text-muted-foreground">No entries.</p>
          ) : (
            <div className="divide-y">
              {data.map((r: any) => (
                <AuditRow key={r.id} row={r} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
