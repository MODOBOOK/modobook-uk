import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyStaffMemberships } from "@/lib/staff.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/invites")({
  ssr: false,
  component: InvitedClinicsPage,
  head: () => ({ meta: [{ title: "Invited clinics · MODO" }] }),
});

type Membership = Awaited<ReturnType<typeof listMyStaffMemberships>>[number];

function InvitedClinicsPage() {
  const listFn = useServerFn(listMyStaffMemberships);
  const [rows, setRows] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFn()
      .then(setRows)
      .catch((e) => setError(e?.message ?? "Failed to load"));
  }, []);

  const active = (rows ?? []).filter((r) => r.status === "active");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Clinics you've been added to</h1>
        <p className="text-sm text-muted-foreground mt-1">
          These are clinics that have invited your account as a team member. Full cross-clinic
          viewing is coming soon — for now this page confirms your invites were accepted.
        </p>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {rows !== null && active.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-60" />
            You haven't accepted any staff invites yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {active.map((m) => (
          <Card key={m.id}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              {m.logoUrl ? (
                <img src={m.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="text-base">{m.clinicName}</CardTitle>
                <CardDescription>
                  Accepted {m.acceptedAt ? new Date(m.acceptedAt).toLocaleDateString() : ""}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="capitalize">
                {m.role === "viewer" ? (
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> View only</span>
                ) : m.role}
              </Badge>
            </CardHeader>
          </Card>
        ))}
      </div>

      {active.length > 0 && (
        <p className="text-xs text-muted-foreground rounded-lg border bg-muted/40 p-3">
          Heads up — you're currently viewing your own dashboard. Switching into another clinic's
          view is a follow-up feature; when it's ready you'll be able to pick a clinic from a
          workspace menu at the top of the dashboard.
        </p>
      )}
    </div>
  );
}
