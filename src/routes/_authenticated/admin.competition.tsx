import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";
import { adminListCompetitionEntries } from "@/lib/competition.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Download, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/competition")({
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
  const list = useServerFn(adminListCompetitionEntries);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "competition-entries"],
    queryFn: () => list({}),
  });

  function exportCsv() {
    const rows = data ?? [];
    const head = ["Entered", "Full name", "Clinic", "Instagram", "Email", "Phone", "Marketing", "Notes"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      head.join(","),
      ...rows.map((r) =>
        [
          new Date(r.created_at).toISOString(),
          r.full_name,
          r.clinic_name,
          r.instagram,
          r.email,
          r.phone,
          r.marketing_opt_in ? "yes" : "no",
          r.notes,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tla-competition-entries.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">TLAs competition entries</h1>
          <p className="text-sm text-muted-foreground">
            Entries from the hidden form at <code>/tla-competition</code> — 1 × 6 months free, 2 × 3 months free.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : !data?.length ? (
            <div className="p-8 text-center">
              <Trophy className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Entered</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Clinic</th>
                    <th className="p-3">Instagram</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Marketing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="whitespace-nowrap p-3 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="p-3 font-medium">{r.full_name}</td>
                      <td className="p-3">{r.clinic_name}</td>
                      <td className="p-3">{r.instagram ?? "—"}</td>
                      <td className="p-3">{r.email}</td>
                      <td className="p-3">{r.phone ?? "—"}</td>
                      <td className="p-3">
                        {r.marketing_opt_in ? <Badge variant="secondary">Opted in</Badge> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
