import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, CheckCircle2, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { listHealthFindings, runHealthChecksNow, type HealthFinding } from "@/lib/health-checks.functions";

export const Route = createFileRoute("/_authenticated/admin/health")({
  ssr: false,
  loader: () => listHealthFindings(),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Admin only</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "System health checks | Modo Admin" },
      { name: "description", content: "Daily automated checks across bookings, payments and emails." },
      { property: "og:title", content: "System health checks | Modo Admin" },
      { property: "og:description", content: "Daily automated checks across bookings, payments and emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

const TONE: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red-100 text-red-800 border-red-200" },
  warning: { label: "Warning", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  info: { label: "Info", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function HealthPage() {
  const router = useRouter();
  const findings = Route.useLoaderData() as HealthFinding[];
  const [busy, setBusy] = useState(false);

  const open = findings.filter((f) => f.status === "open");
  const resolved = findings.filter((f) => f.status !== "open");
  const criticals = open.filter((f) => f.severity === "critical").length;

  async function runNow() {
    setBusy(true);
    try {
      await runHealthChecksNow();
      toast.success("Checks finished");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Activity className="h-5 w-5 text-amber-500" />
            System health
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs automatically every morning at 6am. Checks bookings, payments and emails across all accounts.
          </p>
        </div>
        <Button onClick={runNow} disabled={busy} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          Run checks now
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open issues</p>
            <p className="text-2xl font-semibold">{open.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Needs attention now</p>
            <p className="text-2xl font-semibold text-red-600">{criticals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cleared</p>
            <p className="text-2xl font-semibold text-emerald-600">{resolved.length}</p>
          </CardContent>
        </Card>
      </div>

      {open.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-medium">Everything looks healthy</p>
              <p className="text-sm text-muted-foreground">No issues found in the last run.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {open.map((f) => {
            const tone = TONE[f.severity] ?? TONE["info"]!;
            return (
              <Card key={f.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <TriangleAlert className="h-4 w-4 text-amber-500" />
                    {f.title}
                    <Badge variant="outline" className={tone.cls}>
                      {tone.label}
                    </Badge>
                    <span className="ml-auto text-sm font-normal text-muted-foreground">
                      {f.affected_count} affected
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    First seen {when(f.first_seen_at)} · last checked {when(f.last_seen_at)}
                  </p>
                  {Array.isArray(f.sample) && f.sample.length > 0 && (
                    <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-xs text-slate-700">
                      {JSON.stringify(f.sample.slice(0, 5), null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Cleared</h2>
          <div className="space-y-2">
            {resolved.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{f.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  cleared {f.resolved_at ? when(f.resolved_at) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
