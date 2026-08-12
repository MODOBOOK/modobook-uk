import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listFormsForClient, getFormSubmission, updateFormSubmission, resendFormToClient, deleteFormSubmission } from "@/lib/medical-forms.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Send, Loader2, CheckCircle2, Clock, Lock,
  ChevronDown, Pencil, Eye, EyeOff, X, Save, RefreshCw, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SendFormDialog } from "./SendFormDialog";
import { ClientConsentsList } from "./ClientConsentsList";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SignaturePad } from "@/components/SignaturePad";

type El = {
  id: string;
  type: string;
  label?: string;
  text?: string;
  placeholder?: string;
  options?: string[];
  fieldType?: string;
  max?: number;
};

const NONE_LABEL = "None of the above";
const STRUCTURAL = ["heading", "paragraph", "separator", "space", "info"];

function isEmpty(v: any) {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function formatValue(v: any): string {
  if (isEmpty(v)) return NONE_LABEL;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    if ("dataUrl" in v) return "Signature captured";
    return JSON.stringify(v);
  }
  return String(v);
}

function renderValue(v: any, elType?: string) {
  const empty = isEmpty(v);
  const isCheckboxGroup = elType === "checkbox_group" || elType === "checkboxes";
  if (empty) {
    return (
      <span className={isCheckboxGroup ? "italic text-muted-foreground" : "text-muted-foreground"}>
        {isCheckboxGroup ? NONE_LABEL : "—"}
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

function EditField({ el, value, onChange }: { el: El; value: any; onChange: (v: any) => void }) {
  const t = el.type;
  if (t === "field" || t === "text" || t === "date" || t === "email" || t === "tel") {
    const type = el.fieldType ?? (t === "field" ? "text" : t);
    if (type === "textarea") {
      return <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={el.placeholder} />;
    }
    return <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={el.placeholder} />;
  }
  if (t === "textarea") return <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  if (t === "select") {
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          {(el.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (t === "radio" || t === "yesno") {
    const opts = t === "yesno" ? ["Yes", "No"] : el.options ?? [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <button
            type="button"
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-md border px-2.5 py-1 text-xs ${value === o ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
          >{o}</button>
        ))}
      </div>
    );
  }
  if (t === "checkbox_group" || t === "checkboxes") {
    const arr: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {(el.options ?? []).map((o) => {
          const checked = arr.includes(o);
          return (
            <label key={o} className="flex items-start gap-1.5 text-xs">
              <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(c) => onChange(c ? [...arr, o] : arr.filter((x) => x !== o))} />
              <span>{o}</span>
            </label>
          );
        })}
      </div>
    );
  }
  if (t === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
        <span>{el.label}</span>
      </label>
    );
  }
  if (t === "rating") {
    const max = el.max ?? 5;
    const v = Number(value) || 0;
    return (
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <button type="button" key={i} onClick={() => onChange(i + 1)} className="text-xl leading-none">
            <span className={i < v ? "text-amber-500" : "text-muted-foreground/40"}>★</span>
          </button>
        ))}
      </div>
    );
  }
  if (t === "signature") {
    return (
      <SignaturePad
        value={typeof value === "string" && value.startsWith("data:image") ? value : null}
        onChange={(v) => onChange(v ?? "")}
      />
    );
  }
  // fallback
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

function InlineFormPanel({ submissionId, onSaved }: { submissionId: string; onSaved?: () => void }) {
  const fetchOne = useServerFn(getFormSubmission);
  const updateOne = useServerFn(updateFormSubmission);
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchOne({ data: { id: submissionId } })
      .then((r: any) => { if (alive) { setRow(r); setDraft(r?.response ?? {}); } })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [submissionId, fetchOne]);

  const steps = (row?.template?.schema?.steps ?? []) as { id: string; title: string; elements: El[] }[];
  const response: Record<string, any> = row?.response ?? {};

  const summaryItems = useMemo(() => {
    const items: { id: string; label: string; value: any; type: string }[] = [];
    for (const s of steps) {
      for (const el of s.elements) {
        if (STRUCTURAL.includes(el.type)) continue;
        items.push({
          id: el.id,
          label: el.label ?? el.text ?? el.id,
          value: response[el.id],
          type: el.type,
        });
      }
    }
    return items;
  }, [steps, response]);

  if (loading || !row) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${row.token}`;
  const submitted = row.status === "submitted";

  async function save() {
    setSaving(true);
    try {
      await updateOne({ data: { id: submissionId, response: draft } });
      toast.success("Answers updated");
      // reload
      const r: any = await fetchOne({ data: { id: submissionId } });
      setRow(r);
      setDraft(r?.response ?? {});
      setEditing(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 border-t bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{row.client?.full_name ?? row.recipient_email ?? "—"}</span>
        <span>·</span>
        <span>{row.submitted_at ? `Submitted ${new Date(row.submitted_at).toLocaleString()}` : `Sent ${new Date(row.created_at).toLocaleString()}`}</span>
      </div>

      {!submitted ? (
        <div className="space-y-2">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            Awaiting patient response — you can complete this form here on their behalf.
          </div>
          <div className="overflow-hidden rounded-md border bg-background">
            <iframe src={`${link}?embed=1`} title="Fill form" className="h-[70vh] w-full" />
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          {!editing && (
            <div className="space-y-2 rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Summary</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setExpanded((x) => !x)}>
                    {expanded ? <><EyeOff className="mr-1 h-3 w-3" />Hide full form</> : <><Eye className="mr-1 h-3 w-3" />View full form</>}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setEditing(true); setExpanded(true); }}>
                    <Pencil className="mr-1 h-3 w-3" />Edit answers
                  </Button>
                </div>
              </div>
              {summaryItems.length === 0 ? (
                <div className="text-[11px] text-muted-foreground">No questions in this form.</div>
              ) : (
                <div className="grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-[minmax(0,180px)_1fr] sm:gap-x-3">
                  {summaryItems.map((it) => (
                    <div key={it.id} className="contents">
                      <div className="truncate text-[11px] text-muted-foreground">{it.label}</div>
                      <div className="border-b pb-1 sm:border-0 sm:pb-0">{renderValue(it.value, it.type)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Full / Edit view */}
          {(expanded || editing) && (
            <div className="space-y-3">
              {editing && (
                <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px]">
                  <span className="font-medium text-primary">Editing answers</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditing(false); setDraft(response); }} disabled={saving}>
                      <X className="mr-1 h-3 w-3" />Cancel
                    </Button>
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={saving}>
                      {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {steps.length === 0 ? (
                <pre className="overflow-auto rounded-md bg-background p-2 text-xs">{JSON.stringify(response, null, 2)}</pre>
              ) : (
                steps.map((s) => (
                  <div key={s.id} className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">{s.title}</div>
                    <div className="space-y-2 rounded-md border bg-background p-2.5">
                      {s.elements
                        .filter((el) => !STRUCTURAL.includes(el.type))
                        .map((el) => (
                          <div key={el.id} className="grid grid-cols-1 gap-1 border-b py-1.5 last:border-0 sm:grid-cols-[140px_1fr] sm:gap-2">
                            <div className="text-[11px] text-muted-foreground">
                              <Label className="text-[11px] font-normal text-muted-foreground">{el.label ?? el.text ?? el.id}</Label>
                            </div>
                            <div className="text-xs">
                              {editing ? (
                                <EditField el={el} value={draft[el.id]} onChange={(v) => setDraft((d) => ({ ...d, [el.id]: v }))} />
                              ) : (
                                renderValue(response[el.id], el.type)
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}

              {editing && (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(response); }} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                    Save answers
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ClientFormsList({
  client,
  clinicName,
  refreshKey = 0,
  compact = false,
  includeConsents = false,
  openConsentSendKey = 0,
}: {
  client: { id: string; full_name: string; email?: string | null; phone?: string | null };
  clinicName?: string;
  refreshKey?: number;
  compact?: boolean;
  includeConsents?: boolean;
  openConsentSendKey?: number;
}) {
  const list = useServerFn(listFormsForClient);
  const resend = useServerFn(resendFormToClient);
  const removeForm = useServerFn(deleteFormSubmission);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bump, setBump] = useState(0);
  const [consentSendKey, setConsentSendKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    list({ data: { client_id: client.id } })
      .then((r: any) => { if (alive) setRows(r ?? []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client.id, refreshKey, bump, list]);


  async function doResend(id: string) {
    if (!client.email) { toast.error("No email on file for this patient"); return; }
    setBusyId(id);
    try {
      await resend({ data: { id, email: client.email } });
      toast.success(`Form re-sent to ${client.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resend");
    } finally { setBusyId(null); }
  }

  async function doDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" from this patient's profile? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await removeForm({ data: { id } });
      toast.success("Form deleted");
      setBump((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally { setBusyId(null); }
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
            <Send className="mr-1.5 h-3.5 w-3.5" />Add medical form
          </Button>
          {includeConsents && (
            <Button size="sm" variant="outline" onClick={() => setConsentSendKey((x) => x + 1)}>
              <Send className="mr-1.5 h-3.5 w-3.5" />Add consent form
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No forms yet. Click <span className="font-medium">Add form</span> to attach a medical form.
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
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center justify-end gap-1 border-t bg-muted/20 px-2 py-1">
                    <Button
                      size="sm" variant="ghost" className="h-7 px-2 text-xs"
                      onClick={() => doResend(r.id)}
                      disabled={busyId !== null || !client.email}
                      title={client.email ? "Email this form again" : "No email on file"}
                    >
                      {busyId === r.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                      Resend
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => doDelete(r.id, r.template?.name ?? "Form")}
                      disabled={busyId !== null}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />Delete
                    </Button>
                  </div>
                  <CollapsibleContent>
                    {isOpen && <InlineFormPanel submissionId={r.id} onSaved={() => setBump((x) => x + 1)} />}
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

      {includeConsents && (
        <div className="border-t pt-3">
          <ClientConsentsList
            client={{ id: client.id, full_name: client.full_name, email: client.email, phone: client.phone }}
            refreshKey={refreshKey}
            openSendKey={openConsentSendKey + consentSendKey}
            onSent={() => setBump((x) => x + 1)}
          />
        </div>
      )}
    </div>
  );
}
