import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, MessageSquare, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { listForms, sendFormToClient } from "@/lib/medical-forms.functions";
import { logCommunication } from "@/lib/patient-hub.functions";

export function SendFormDialog({
  open,
  onOpenChange,
  client,
  clinicName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: { id: string; full_name: string; email?: string | null; phone?: string | null };
  clinicName?: string;
  onSent?: () => void;
}) {
  const fetchForms = useServerFn(listForms);
  const send = useServerFn(sendFormToClient);
  const logComm = useServerFn(logCommunication);

  const [forms, setForms] = useState<{ id: string; name: string }[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setLink("");
    setTemplateId("");
    setEmail(client.email ?? "");
    setPhone(client.phone ?? "");
    fetchForms().then((rows: any) => setForms(rows ?? [])).catch(() => setForms([]));
  }, [open, client.email, client.phone, fetchForms]);

  const selectedForm = useMemo(() => forms.find((f) => f.id === templateId), [forms, templateId]);

  async function create(options?: { thenEmail?: boolean; thenSms?: boolean; thenWa?: boolean }) {
    if (!templateId) { toast.error("Choose a form"); return; }
    setBusy(true);
    try {
      const res: any = await send({ data: { client_id: client.id, template_id: templateId, email: email || undefined, phone: phone || undefined } });
      if (!res?.token) throw new Error("No form token returned");
      const url = `${window.location.origin}/f/${res.token}`;
      setLink(url);
      toast.success("Form saved to patient's account");
      onSent?.();
      if (options?.thenEmail && email) await sendEmail(url);
      else if (options?.thenSms && phone) await sendSms(url);
      else if (options?.thenWa && phone) await sendWa(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : (e as any)?.message ?? "Failed to create form";
      toast.error(msg);
    } finally { setBusy(false); }
  }

  function makeMessage(url: string) {
    const who = clinicName || "your clinic";
    return `Hi ${client.full_name.split(" ")[0] || ""}, please complete this form from ${who}: ${url}`;
  }

  async function sendEmail(urlOverride?: string) {
    const url = urlOverride || link;
    if (!url || !email) return;
    const subject = encodeURIComponent(`${selectedForm?.name ?? "Form"} from ${clinicName || "your clinic"}`);
    const body = encodeURIComponent(`Hi ${client.full_name},\n\nPlease complete the following form before your appointment:\n\n${url}\n\nThank you,\n${clinicName ?? ""}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    await logComm({ data: { clientId: client.id, channel: "email", subject: decodeURIComponent(subject), body: url } });
    onSent?.();
  }
  async function sendSms(urlOverride?: string) {
    const url = urlOverride || link;
    if (!url || !phone) return;
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(makeMessage(url))}`;
    await logComm({ data: { clientId: client.id, channel: "sms", body: makeMessage(url) } });
    onSent?.();
  }
  async function sendWa(urlOverride?: string) {
    const url = urlOverride || link;
    if (!url || !phone) return;
    const wa = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(makeMessage(url))}`;
    window.open(wa, "_blank");
    await logComm({ data: { clientId: client.id, channel: "whatsapp", body: makeMessage(url) } });
    onSent?.();
  }
  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a form to {client.full_name}</DialogTitle>
        </DialogHeader>

        {!link ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Form template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder={forms.length ? "Choose a form" : "Loading…"} /></SelectTrigger>
                <SelectContent>
                  {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="patient@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44…" />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={() => create()} disabled={busy || !templateId}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save to account
              </Button>
              <Button onClick={() => create({ thenEmail: true })} disabled={busy || !templateId || !email}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}Save & email
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" />Link ready</div>
              <div className="mt-1 break-all font-mono text-[11px] text-emerald-900/80">{link}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => sendEmail()} disabled={!email}><Mail className="mr-1.5 h-4 w-4" />Email</Button>
              <Button variant="outline" onClick={() => sendSms()} disabled={!phone}><MessageSquare className="mr-1.5 h-4 w-4" />SMS</Button>
              <Button variant="outline" onClick={() => sendWa()} disabled={!phone}><MessageSquare className="mr-1.5 h-4 w-4" />WhatsApp</Button>
              <Button variant="outline" onClick={copyLink}><Copy className="mr-1.5 h-4 w-4" />Copy link</Button>
            </div>
            <Button variant="ghost" className="w-full" asChild>
              <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Open form</a>
            </Button>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
