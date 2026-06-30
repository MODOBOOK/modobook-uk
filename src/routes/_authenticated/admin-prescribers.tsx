import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListPrescriberSubmissions,
  adminDecidePrescriber,
  getIdDocumentUrl,
  REGULATORY_BODIES,
} from "@/lib/hub.functions";
import { amIAdmin } from "@/lib/admin.functions";
import { Shield, ExternalLink, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-prescribers")({
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
  component: AdminPrescribers,
});

function bodyLabel(v: string) {
  return REGULATORY_BODIES.find((r) => r.value === v)?.label ?? v;
}

function AdminPrescribers() {
  const list = useServerFn(adminListPrescriberSubmissions);
  const decide = useServerFn(adminDecidePrescriber);
  const getUrl = useServerFn(getIdDocumentUrl);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListPrescriberSubmissions>>>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setRows(await list());
  }
  useEffect(() => {
    refresh().catch((e) => toast.error(e.message));
  }, []);

  async function viewDoc(path: string) {
    try {
      const { url } = await getUrl({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function act(id: string, decision: "approved" | "rejected" | "more_info") {
    setBusy(id);
    try {
      await decide({ data: { id, decision, note: notes[id] || undefined } });
      toast.success("Updated");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const reviewed = rows.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="font-serif text-2xl">Prescriber verifications</h1>
        <p className="text-sm text-muted-foreground">Review identity and registration documents.</p>
      </div>

      <SectionList title={`Pending (${pending.length})`} rows={pending} viewDoc={viewDoc}>
        {(r) => (
          <div className="space-y-3">
            <Textarea
              placeholder="Admin note (optional, shown to the prescriber)"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, "approved")}>
                {busy === r.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "more_info")}>
                Request info
              </Button>
              <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => act(r.id, "rejected")}>
                Reject
              </Button>
            </div>
          </div>
        )}
      </SectionList>

      <SectionList title={`Reviewed (${reviewed.length})`} rows={reviewed} viewDoc={viewDoc}>
        {(r) => (
          <div className="text-sm text-muted-foreground">
            Status: <Badge variant="secondary">{r.status}</Badge>
            {r.admin_note && <p className="mt-1">Note: {r.admin_note}</p>}
          </div>
        )}
      </SectionList>
    </div>
  );
}

type Row = Awaited<ReturnType<typeof adminListPrescriberSubmissions>>[number];

function SectionList({
  title,
  rows,
  children,
  viewDoc,
}: {
  title: string;
  rows: Row[];
  children: (r: Row) => React.ReactNode;
  viewDoc: (path: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-4">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {bodyLabel(r.regulatory_body)}
                      {r.regulatory_body_other ? ` • ${r.regulatory_body_other}` : ""} •
                      PIN <span className="font-mono">{r.registration_number}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Submitted {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  {r.id_document_path && (
                    <Button size="sm" variant="outline" onClick={() => viewDoc(r.id_document_path!)}>
                      <ExternalLink className="mr-1 h-3 w-3" /> View ID
                    </Button>
                  )}
                </div>
                <div className="mt-3">{children(r)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
