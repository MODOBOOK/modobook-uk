import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getConsentForClient, listConsentsForClient, sendConsentToClient, listMyConsentTemplates, resendConsentToClient, deleteConsentForClient } from "@/lib/treatment-consents.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsentSectionsView, type ConsentSection } from "@/components/ConsentSections";
import { ShieldCheck, Send, Loader2, CheckCircle2, Clock, Eye, Copy, PenLine, Mail, Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getMyProfile } from "@/lib/profiles.functions";

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
  const fetchProfile = useServerFn(getMyProfile);
  const resend = useServerFn(resendConsentToClient);
  const removeConsent = useServerFn(deleteConsentForClient);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function downloadConsent(row: { token: string; template_name: string }) {
    setDownloading(row.token);
    try {
      const [{ generateConsentPdf }, full, profile] = await Promise.all([
        import("@/lib/consent-pdf"),
        getConsent({ data: { client_id: client.id, token: row.token } }) as Promise<any>,
        fetchProfile() as Promise<any>,
      ]);
      const doc = await generateConsentPdf({
        clinic: profile ? {
          clinic_name: profile.clinic_name, full_name: profile.full_name,
          logo_url: profile.logo_url ?? profile.hero_url ?? null,
          brand_color: profile.brand_color, address: profile.address,
          email: profile.email, phone: profile.phone,
        } : null,
        patient: { full_name: client.full_name, email: client.email, phone: client.phone },
        consent: full,
      });
      const safe = String(client.full_name || "patient").replace(/[^a-z0-9-_ ]/gi, "").trim() || "patient";
      const tname = String(row.template_name || "consent").replace(/[^a-z0-9-_ ]/gi, "").trim();
      doc.save(`Consent - ${safe} - ${tname}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally { setDownloading(null); }
  }

  async function downloadAllConsents() {
    setDownloading("__all__");
    try {
      const [{ generateConsentPdf }, profile, fullList] = await Promise.all([
        import("@/lib/consent-pdf"),
        fetchProfile() as Promise<any>,
        Promise.all(rows.map((r) => getConsent({ data: { client_id: client.id, token: r.token } }).catch(() => null))),
      ]);
      const clinic = profile ? {
        clinic_name: profile.clinic_name, full_name: profile.full_name,
        logo_url: profile.logo_url ?? profile.hero_url ?? null,
        brand_color: profile.brand_color, address: profile.address,
        email: profile.email, phone: profile.phone,
      } : null;
      const inputs = (fullList as any[])
        .filter(Boolean)
        .map((full) => ({ clinic, patient: { full_name: client.full_name, email: client.email, phone: client.phone }, consent: full }));
      if (inputs.length === 0) { toast.error("No consents to download"); return; }
      const doc = await generateConsentPdf(inputs);
      const safe = String(client.full_name || "patient").replace(/[^a-z0-9-_ ]/gi, "").trim() || "patient";
      doc.save(`All consents - ${safe}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally { setDownloading(null); }
  }

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

  async function doSend(mode: "in_person" | "email") {
    if (!templateId) { toast.error("Choose a consent form"); return; }
    if (mode === "email" && !client.email) { toast.error("No email on file for this patient"); return; }
    setSending(true);
    try {
      const res = await send({
        data: {
          client_id: client.id,
          template_id: templateId,
          email: client.email ?? undefined,
          sendEmail: mode === "email",
        },
      });
      setSendOpen(false);
      setTemplateId("");
      setBump((x) => x + 1);
      onSent?.();
      if (mode === "in_person" && res?.token) {
        // Hand the device to the patient — open the signing screen.
        window.location.href = `/c/${res.token}`;
        return;
      }
      toast.success(mode === "email" ? "Consent form emailed" : "Consent form created");
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

  async function doResend(id: string) {
    if (!client.email) { toast.error("No email on file for this patient"); return; }
    setBusyId(id);
    try {
      await resend({ data: { id, client_id: client.id, email: client.email } });
      toast.success(`Consent form re-sent to ${client.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resend");
    } finally { setBusyId(null); }
  }

  async function doDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" from this patient's profile? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await removeConsent({ data: { id } });
      toast.success("Consent form deleted");
      setBump((x) => x + 1);
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />Consent forms
          {rows.length > 0 && <Badge variant="secondary" className="text-[10px]">{rows.length}</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          {rows.length > 0 && (
            <Button size="sm" variant="ghost" onClick={downloadAllConsents} disabled={downloading !== null} title="Download all consents as PDF">
              {downloading === "__all__" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
              PDF all
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openSend}>
            <Send className="mr-1.5 h-3.5 w-3.5" />Send consent
          </Button>
        </div>
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
                  <>
                    <Button
                      size="sm" variant="default" className="h-7 gap-1 px-2"
                      onClick={() => { window.location.href = `/c/${r.token}`; }}
                      title="Hand the device to the patient to sign now"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Sign in person</span>
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 px-2"
                      onClick={() => { navigator.clipboard?.writeText(url); toast.success("Link copied"); }}
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openConsent(r.token)} title="View consent form">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => downloadConsent({ token: r.token, template_name: r.template_name })}
                  disabled={downloading !== null}
                  title="Download consent as PDF"
                >
                  {downloading === r.token ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => doResend(r.id)}
                  disabled={busyId !== null || !client.email}
                  title={client.email ? "Email this consent form again" : "No email on file"}
                >
                  {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => doDelete(r.id, r.template_name)}
                  disabled={busyId !== null}
                  title="Delete consent form"
                >
                  <Trash2 className="h-3.5 w-3.5" />
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
              Hand the device to the patient to sign now, or email them a signing link{client.email ? <> to <span className="font-medium">{client.email}</span></> : <> (no email on file — use in person)</>}.
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setSendOpen(false)} disabled={sending}>Cancel</Button>
            <Button
              variant="outline"
              onClick={() => doSend("email")}
              disabled={sending || !templateId || !client.email}
              title={!client.email ? "No email on file" : "Email a signing link to the patient"}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Email instead
            </Button>
            <Button onClick={() => doSend("in_person")} disabled={sending || !templateId}>
              {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PenLine className="mr-1.5 h-3.5 w-3.5" />}
              Sign in person now
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
