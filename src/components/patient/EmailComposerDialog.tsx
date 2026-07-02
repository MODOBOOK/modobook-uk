import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listEmailTemplates, upsertEmailTemplate, deleteEmailTemplate, logCommunication } from "@/lib/patient-hub.functions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Send, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
  full_name: string;
  email?: string | null;
  first_name?: string | null;
};

type Template = { id: string; name: string; subject: string; body_html: string };

const MERGE_TAGS = [
  { tag: "{{first_name}}", label: "First name" },
  { tag: "{{full_name}}", label: "Full name" },
  { tag: "{{clinic_name}}", label: "Clinic name" },
];

function applyMerges(text: string, client: Client, clinicName: string) {
  const first = (client.first_name || client.full_name.split(/\s+/)[0] || "").trim();
  return text
    .replaceAll("{{first_name}}", first)
    .replaceAll("{{full_name}}", client.full_name)
    .replaceAll("{{clinic_name}}", clinicName);
}

export function EmailComposerDialog({
  open, onOpenChange, client, clinicName, onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client;
  clinicName: string;
  onSent?: () => void;
}) {
  const listTpl = useServerFn(listEmailTemplates);
  const saveTpl = useServerFn(upsertEmailTemplate);
  const delTpl = useServerFn(deleteEmailTemplate);
  const log = useServerFn(logCommunication);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTpl, setSelectedTpl] = useState<string>("");
  

  useEffect(() => {
    if (!open) return;
    listTpl().then((r: any) => setTemplates(r ?? []));
  }, [open, listTpl]);

  const renderedSubject = useMemo(() => applyMerges(subject, client, clinicName), [subject, client, clinicName]);
  const renderedBody = useMemo(() => applyMerges(body, client, clinicName), [body, client, clinicName]);

  function insertTag(tag: string) {
    setBody(b => b + (b.endsWith(" ") || !b ? "" : " ") + tag);
  }

  function loadTemplate(id: string) {
    setSelectedTpl(id);
    const t = templates.find(x => x.id === id);
    if (t) { setSubject(t.subject); setBody(t.body_html); }
  }

  async function saveAsTemplate() {
    const name = prompt("Template name?", subject || "Untitled");
    if (!name) return;
    const saved: any = await saveTpl({ data: { name, subject, body_html: body } });
    setTemplates(t => [...t.filter(x => x.id !== saved.id), saved]);
    toast.success("Template saved");
  }
  async function updateExisting() {
    if (!selectedTpl) return;
    const t = templates.find(x => x.id === selectedTpl);
    if (!t) return;
    await saveTpl({ data: { id: t.id, name: t.name, subject, body_html: body } });
    toast.success("Template updated");
  }
  async function removeTemplate() {
    if (!selectedTpl) return;
    if (!confirm("Delete this template?")) return;
    await delTpl({ data: { id: selectedTpl } });
    setTemplates(t => t.filter(x => x.id !== selectedTpl));
    setSelectedTpl("");
  }

  async function send() {
    if (!client.email) { toast.error("Patient has no email address"); return; }
    if (!subject.trim() || !body.trim()) { toast.error("Subject and message required"); return; }
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      if (!token) { toast.error("You need to be signed in"); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, slug, clinic_name, full_name, brand_color")
        .eq("user_id", sessionRes.session!.user.id)
        .maybeSingle();
      const { data: theme } = prof
        ? await supabase
            .from("clinic_theme")
            .select("logo_url, accent_color, primary_color, button_color, button_text_color, text_color")
            .eq("profile_id", prof.id)
            .maybeSingle()
        : { data: null as any };
      const brand = {
        clinicName: (prof as any)?.clinic_name || (prof as any)?.full_name || clinicName || "Your practitioner",
        logoUrl: (theme as any)?.logo_url ?? null,
        accentColor: (theme as any)?.accent_color || (theme as any)?.primary_color || (prof as any)?.brand_color || null,
        buttonColor: (theme as any)?.button_color ?? null,
        buttonTextColor: (theme as any)?.button_text_color ?? null,
        textColor: (theme as any)?.text_color ?? null,
        practitionerEmail: (prof as any)?.email ?? null,
      };
      const replyTo = (prof as any)?.email || undefined;
      const fromName = `${brand.clinicName} via MODO`;
      const res = await fetch("/lovable/email/transactional/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          templateName: "practitioner-message",
          recipientEmail: client.email,
          replyTo,
          fromName,
          templateData: {
            brand,
            subject: renderedSubject,
            bodyText: renderedBody,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        toast.error(json.error || json.reason || "Failed to send");
        return;
      }
      await log({ data: {
        clientId: client.id, channel: "email",
        subject: renderedSubject, body: renderedBody,
      } });
      toast.success("Email sent from MODO — replies go to your inbox");
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email {client.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">Template</Label>
            <Select value={selectedTpl} onValueChange={loadTemplate}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Start from blank" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                {templates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No templates yet</div>}
              </SelectContent>
            </Select>
            {selectedTpl ? (
              <>
                <Button size="sm" variant="outline" onClick={updateExisting}><Save className="mr-1 h-3.5 w-3.5" />Update</Button>
                <Button size="sm" variant="ghost" onClick={removeTemplate}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={saveAsTemplate} disabled={!subject && !body}>
                <Plus className="mr-1 h-3.5 w-3.5" />Save as template
              </Button>
            )}
          </div>

          <div>
            <Label className="text-xs">To</Label>
            <Input value={client.email ?? ""} readOnly className="bg-muted/40" />
          </div>

          <div>
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your appointment with {{clinic_name}}" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs">Message</Label>
              <div className="flex gap-1">
                {MERGE_TAGS.map(t => (
                  <button key={t.tag} type="button" onClick={() => insertTag(t.tag)}
                    className="rounded-full border bg-card px-2 py-0.5 text-[10px] hover:bg-muted">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
              placeholder={"Hi {{first_name}},\n\n…\n\nKind regards,\n{{clinic_name}}"} />
          </div>

          {(subject || body) && (
            <details className="rounded-md border bg-muted/30 p-3 text-xs">
              <summary className="cursor-pointer font-medium">Preview with merge tags filled in</summary>
              <div className="mt-2 space-y-1">
                <div><strong>Subject:</strong> {renderedSubject}</div>
                <pre className="whitespace-pre-wrap font-sans">{renderedBody}</pre>
              </div>
            </details>
          )}

          <p className="text-[11px] text-muted-foreground">
            Sent from MODO on your behalf with your clinic branding. Replies come back to your inbox.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send}><Send className="mr-1.5 h-4 w-4" />Send email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
