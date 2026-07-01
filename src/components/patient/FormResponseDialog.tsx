import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFormSubmission } from "@/lib/medical-forms.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type El = {
  id: string;
  type: string;
  label?: string;
  text?: string;
  level?: number;
};

function renderValue(v: any, elType?: string) {
  const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  const isCheckboxGroup = elType === "checkbox_group" || elType === "checkboxes";
  if (empty) {
    return (
      <span className={isCheckboxGroup ? "italic text-muted-foreground" : "text-muted-foreground"}>
        {isCheckboxGroup ? "None of the above" : "—"}
      </span>
    );
  }
  if (Array.isArray(v)) return <span>{v.join(", ")}</span>;
  if (typeof v === "object") {
    if ("dataUrl" in v) return <img src={v.dataUrl} alt="signature" className="max-h-24 rounded border bg-white" />;
    return <span className="font-mono text-xs">{JSON.stringify(v)}</span>;
  }
  if (typeof v === "boolean") return <span>{v ? "Yes" : "No"}</span>;
  if (typeof v === "string" && v.startsWith("data:image")) return <img src={v} alt="" className="max-h-24 rounded border bg-white" />;
  return <span className="whitespace-pre-wrap">{String(v)}</span>;
}


export function FormResponseDialog({
  open, onOpenChange, submissionId,
}: { open: boolean; onOpenChange: (o: boolean) => void; submissionId: string | null }) {
  const fetchOne = useServerFn(getFormSubmission);
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !submissionId) { setRow(null); return; }
    setLoading(true);
    fetchOne({ data: { id: submissionId } })
      .then((r: any) => setRow(r))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, submissionId, fetchOne]);

  const steps = (row?.template?.schema?.steps ?? []) as { id: string; title: string; elements: El[] }[];
  const response: Record<string, any> = row?.response ?? {};
  const link = row ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/${row.token}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {row?.template?.name ?? "Form"}
            {row && (
              <Badge variant={row.status === "submitted" ? "default" : "secondary"} className="text-[10px]">
                {row.status === "submitted" ? "Completed" : "Pending"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading || !row ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              <span>{row.client?.full_name ?? row.recipient_email ?? "—"}</span>
              <span>·</span>
              <span>
                {row.submitted_at
                  ? `Submitted ${new Date(row.submitted_at).toLocaleString()}`
                  : `Sent ${new Date(row.created_at).toLocaleString()}`}
              </span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Link copied"); }}>
                  <Copy className="mr-1 h-3 w-3" />Link
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                  <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Open</a>
                </Button>
              </div>
            </div>

            {row.status !== "submitted" ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                Awaiting patient response.
              </div>
            ) : steps.length === 0 ? (
              <pre className="overflow-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(response, null, 2)}</pre>
            ) : (
              steps.map((s) => (
                <div key={s.id} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-primary">{s.title}</div>
                  <div className="space-y-1.5 rounded-md border p-3">
                    {s.elements
                      .filter((el) => !["heading", "paragraph", "separator", "space", "info"].includes(el.type))
                      .map((el) => (
                        <div key={el.id} className="grid grid-cols-[160px_1fr] gap-3 border-b py-1.5 last:border-0">
                          <div className="text-xs text-muted-foreground">{el.label ?? el.text ?? el.id}</div>
                          <div className="text-sm">{renderValue(response[el.id], el.type)}</div>
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
