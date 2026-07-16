import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getConsentForClient, listConsentsForClient, sendConsentToClient, listMyConsentTemplates } from "@/lib/treatment-consents.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsentSectionsView, type ConsentSection } from "@/components/ConsentSections";
import { ShieldCheck, Send, Loader2, CheckCircle2, Clock, Eye, Copy, PenLine, Mail } from "lucide-react";
import { toast } from "sonner";

export function ClientConsentsList({
  client,
  refreshKey = 0,
  openSendKey = 0,
  onSent,
}: {
  client: { id: string; full_name: string; email?: string | null; phone?: string | null };
  refreshKey?: number;
  openSendKey?: number;
  onSent?: () => void;
}) {
  const list = useServerFn(listConsentsForClient);
  const listTemplates = useServerFn(listMyConsentTemplates);
  const send = useServerFn(sendConsentToClient);
  const getConsent = useServerFn(getConsentForClient);

  const [rows, setRows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState<any>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    list({ data: { client_id: client.id } })
      .then((r) => { if (alive) setRows(r ?? []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client.id, refreshKey, bump, list]);

  useEffect(() => {
    if (openSendKey > 0) void openSend();
    // openSend intentionally omitted so this only reacts to the external trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSendKey]);

  async function openSend() {
    setSendOpen(true);
    if (templates.length === 0) {
      try {
        const r = await listTemplates();
        setTemplates(r ?? []);
      } catch {
        toast.error("Failed to load consent templates");
      }
    }
  }

  async function doSend() {
    if (!templateId) { toast.error("Choose a consent form"); return; }
    setSending(true);
    try {
      await send({
        data: {
          client_id: client.id,
          template_id: templateId,
          email: client.email ?? undefined,
          sendEmail: !!client.email,
        },
      });
      toast.success(client.email ? "Consent form sent" : "Consent form created");
      setSendOpen(false);
      setTemplateId("");
      setBump((x) => x + 1);
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function openConsent(token: string) {
    setViewOpen(true);
    setSelectedConsent(null);
    setViewLoading(true);
    try {
      const row = await getConsent({ data: { client_id: client.id, token } });
      setSelectedConsent(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open consent form");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />Consent forms
          {rows.length > 0 && <Badge variant="secondary" className="text-[10px]">{rows.length}</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={openSend}>
          <Send className="mr-1.5 h-3.5 w-3.5" />Send consent
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No consent forms yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const signed = r.status === "signed";
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${r.token}`;
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-sm">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${signed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {signed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.template_name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {signed && r.signed_at
                      ? `Signed ${new Date(r.signed_at).toLocaleDateString()}${r.signature_name ? ` · ${r.signature_name}` : ""}`
                      : `Sent ${new Date(r.created_at).toLocaleDateString()} · awaiting`}
                  </div>
                </div>
                {!signed && (
                  <Button
                    size="sm" variant="ghost" className="h-7 px-2"
                    onClick={() => { navigator.clipboard?.writeText(url); toast.success("Link copied"); }}
                    title="Copy link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openConsent(r.token)} title="View consent form">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a consent form</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Consent template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select a consent form…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.is_system ? " (system)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {client.email
                ? <>Will email <span className="font-medium">{client.email}</span> with a signing link.</>
                : <>No email on file — a signing link will be created that you can copy and share.</>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={doSend} disabled={sending || !templateId}>
              {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedConsent?.template_name ?? "Consent form"}</DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : selectedConsent ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={selectedConsent.status === "signed" ? "default" : "secondary"}>
                  {selectedConsent.status === "signed" ? "Signed" : "Pending"}
                </Badge>
                {selectedConsent.signed_at && <span>Signed {new Date(selectedConsent.signed_at).toLocaleString()}</span>}
                {selectedConsent.signature_name && <span>by {selectedConsent.signature_name}</span>}
              </div>
              <ConsentSectionsView
                sections={(selectedConsent.template_sections as ConsentSection[] | null) ?? null}
                summary={selectedConsent.template_summary as string | null | undefined}
                fallbackBody={selectedConsent.template_body}
              />
              {selectedConsent.signature_data && (
                <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signature</div>
                  {String(selectedConsent.signature_data).startsWith("data:image") ? (
                    <img src={selectedConsent.signature_data} alt="Patient signature" className="max-h-32 rounded border bg-white" />
                  ) : (
                    <div className="text-sm">{selectedConsent.signature_name || selectedConsent.signature_data}</div>
                  )}
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
