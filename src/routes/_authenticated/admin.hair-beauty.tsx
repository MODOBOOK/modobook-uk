import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";
import { adminListHairBeautyWaitlist } from "@/lib/hair-beauty-waitlist.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Download, Scissors } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hair-beauty")({
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

const TYPE_LABEL: Record<string, string> = {
  hair: "Hair",
  beauty: "Beauty",
  multi: "Multi-service",
};

function Page() {
  const list = useServerFn(adminListHairBeautyWaitlist);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "hair-beauty-waitlist"],
    queryFn: () => list({}),
  });

  function exportCsv() {
    const rows = data ?? [];
    const head = ["Joined", "Full name", "Salon", "Type", "Email", "Phone", "Instagram", "Ideas"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      head.join(","),
      ...rows.map((r) =>
        [
          new Date(r.created_at).toISOString(),
          r.full_name,
          r.clinic_name,
          TYPE_LABEL[r.clinic_type] ?? r.clinic_type,
          r.email,
          r.phone,
          r.instagram,
          r.ideas,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hair-beauty-waitlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Hair & beauty waitlist</h1>
          <p className="text-sm text-muted-foreground">
            Signups from the private link at <code>/hair-beauty-waitlist</code>.
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
              <Scissors className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No signups yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Joined</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Salon</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Ideas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap p-3 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="p-3 font-medium">{r.full_name}</td>
                      <td className="p-3">{r.clinic_name ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant="secondary">{TYPE_LABEL[r.clinic_type] ?? r.clinic_type}</Badge>
                      </td>
                      <td className="p-3">{r.email}</td>
                      <td className="p-3">{r.phone ?? "—"}</td>
                      <td className="max-w-[28rem] p-3 whitespace-pre-wrap text-muted-foreground">
                        {r.ideas ?? "—"}
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
