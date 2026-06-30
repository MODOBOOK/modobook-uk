import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listFormsForClient } from "@/lib/medical-forms.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, Send, Eye, Copy, Loader2, CheckCircle2, Clock, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { SendFormDialog } from "./SendFormDialog";
import { FormResponseDialog } from "./FormResponseDialog";

export function ClientFormsList({
  client,
  clinicName,
  refreshKey = 0,
  compact = false,
}: {
  client: { id: string; full_name: string; email?: string | null; phone?: string | null };
  clinicName?: string;
  refreshKey?: number;
  compact?: boolean;
}) {
  const list = useServerFn(listFormsForClient);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    list({ data: { client_id: client.id } })
      .then((r: any) => { if (alive) setRows(r ?? []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client.id, refreshKey, bump, list]);

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/f/${token}`);
    toast.success("Link copied");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />Medical forms
        </div>
        <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
          <Send className="mr-1.5 h-3.5 w-3.5" />Send form
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No forms sent yet. Click <span className="font-medium">Send form</span> to share one with the patient — once they complete it at home, it appears here automatically.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const done = r.status === "submitted";
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-sm">
                <span className={`grid h-7 w-7 place-items-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.template?.name ?? "Form"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {done && r.submitted_at
                      ? `Completed ${new Date(r.submitted_at).toLocaleDateString()}`
                      : `Sent ${new Date(r.created_at).toLocaleDateString()} · awaiting`}
                  </div>
                </div>
                {!compact && (
                  <Badge variant={done ? "default" : "secondary"} className="hidden text-[10px] sm:inline-flex">
                    {done ? <><Lock className="mr-1 h-2.5 w-2.5" />Completed · view only</> : "Pending"}
                  </Badge>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(r.id)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {!done && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy link" onClick={() => copyLink(r.token)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SendFormDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        client={client}
        clinicName={clinicName}
        onSent={() => setBump((x) => x + 1)}
      />
      <FormResponseDialog open={!!viewId} onOpenChange={(v) => !v && setViewId(null)} submissionId={viewId} />
    </div>
  );
}
