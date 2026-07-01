import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listFormsForClient, getFormSubmission } from "@/lib/medical-forms.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, Send, Copy, Loader2, CheckCircle2, Clock, Lock,
  ChevronDown, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { SendFormDialog } from "./SendFormDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type El = { id: string; type: string; label?: string; text?: string };

function renderValue(v: any) {
  if (v === undefined || v === null || v === "") return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(v)) return <span>{v.join(", ")}</span>;
  if (typeof v === "object") {
    if ("dataUrl" in v) return <img src={v.dataUrl} alt="signature" className="max-h-24 rounded border bg-white" />;
    return <span className="font-mono text-xs">{JSON.stringify(v)}</span>;
  }
  if (typeof v === "boolean") return <span>{v ? "Yes" : "No"}</span>;
  if (typeof v === "string" && v.startsWith("data:image")) return <img src={v} alt="" className="max-h-24 rounded border bg-white" />;
  return <span className="whitespace-pre-wrap">{String(v)}</span>;
}

function InlineFormPanel({ submissionId }: { submissionId: string }) {
  const fetchOne = useServerFn(getFormSubmission);
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchOne({ data: { id: submissionId } })
      .then((r: any) => { if (alive) setRow(r); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [submissionId, fetchOne]);

  if (loading || !row) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  const steps = (row?.template?.schema?.steps ?? []) as { id: string; title: string; elements: El[] }[];
  const response: Record<string, any> = row?.response ?? {};
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${row.token}`;

  return (
    <div className="space-y-3 border-t bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{row.client?.full_name ?? row.recipient_email ?? "—"}</span>
        <span>·</span>
        <span>{row.submitted_at ? `Submitted ${new Date(row.submitted_at).toLocaleString()}` : `Sent ${new Date(row.created_at).toLocaleString()}`}</span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Link copied"); }}>
            <Copy className="mr-1 h-3 w-3" />Link
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2" asChild>
            <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Open</a>
          </Button>
        </div>
      </div>

      {row.status !== "submitted" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <span>Awaiting patient response — you can complete this form here on their behalf.</span>
          </div>
          <div className="overflow-hidden rounded-md border bg-background">
            <iframe
              src={`${link}?embed=1`}
              title="Fill form"
              className="h-[70vh] w-full"
              onLoad={() => {
                // refresh parent list when submitted (child posts message)
              }}
            />
          </div>
        </div>
      ) : steps.length === 0 ? (
        <pre className="overflow-auto rounded-md bg-background p-2 text-xs">{JSON.stringify(response, null, 2)}</pre>
      ) : (
        steps.map((s) => (
          <div key={s.id} className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">{s.title}</div>
            <div className="space-y-1 rounded-md border bg-background p-2.5">
              {s.elements
                .filter((el) => !["heading", "paragraph", "separator", "space", "info"].includes(el.type))
                .map((el) => (
                  <div key={el.id} className="grid grid-cols-[130px_1fr] gap-2 border-b py-1 last:border-0">
                    <div className="text-[11px] text-muted-foreground">{el.label ?? el.text ?? el.id}</div>
                    <div className="text-xs">{renderValue(response[el.id])}</div>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />Medical forms
          {rows.length > 0 && <Badge variant="secondary" className="text-[10px]">{rows.length}</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
          <Send className="mr-1.5 h-3.5 w-3.5" />Add form
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No forms yet. Click <span className="font-medium">Add form</span> to attach another medical form — they'll appear here and can be expanded to view.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const done = r.status === "submitted";
            const isOpen = expanded.has(r.id);
            return (
              <Collapsible key={r.id} open={isOpen} onOpenChange={() => toggle(r.id)}>
                <div className="overflow-hidden rounded-md border bg-card">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-muted/40">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
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
                          {done ? <><Lock className="mr-1 h-2.5 w-2.5" />Completed</> : "Pending"}
                        </Badge>
                      )}
                      {!done && (
                        <span
                          role="button"
                          tabIndex={0}
                          title="Copy link"
                          onClick={(e) => { e.stopPropagation(); copyLink(r.token); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); copyLink(r.token); } }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {isOpen && <InlineFormPanel submissionId={r.id} />}
                  </CollapsibleContent>
                </div>
              </Collapsible>
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
    </div>
  );
}
