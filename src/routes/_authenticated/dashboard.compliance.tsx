import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCompliance,
  seedComplianceDefaults,
  saveCheckTemplate,
  deleteCheckTemplate,
  recordCheck,
  saveAuditTemplate,
  deleteAuditTemplate,
  saveAudit,
  signOffAudit,
  deleteAudit,
  saveAction,
  deleteAction,
} from "@/lib/compliance.functions";
import {
  AUDIT_PRESETS,
  CHECK_KIND_LABELS,
  CHECK_PRESETS,
  FREQUENCIES,
  frequencyLabel,
  todayIso,
  type CheckField,
} from "@/lib/compliance-presets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  ClipboardCheck,
  Plus,
  ShieldCheck,
  Thermometer,
  Trash2,
  TriangleAlert,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/compliance")({
  ssr: false,
  component: Page,
});

type Any = Record<string, any>;

function dueTone(due: string | null, today: string) {
  if (!due) return { label: "No schedule", tone: "muted" as const };
  if (due < today) return { label: "Overdue", tone: "bad" as const };
  if (due === today) return { label: "Due today", tone: "warn" as const };
  return { label: `Due ${due}`, tone: "ok" as const };
}

function DueBadge({ due, today }: { due: string | null; today: string }) {
  const t = dueTone(due, today);
  return (
    <Badge
      variant="outline"
      className={
        t.tone === "bad"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : t.tone === "warn"
            ? "border-amber-400/50 bg-amber-50 text-amber-700"
            : t.tone === "ok"
              ? "border-emerald-400/40 bg-emerald-50 text-emerald-700"
              : ""
      }
    >
      {t.label}
    </Badge>
  );
}

function Page() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(getCompliance);
  const { data, isLoading } = useQuery({ queryKey: ["compliance"], queryFn: () => fetchAll() });

  const seed = useServerFn(seedComplianceDefaults);
  const doCheck = useServerFn(recordCheck);
  const saveCheck = useServerFn(saveCheckTemplate);
  const delCheck = useServerFn(deleteCheckTemplate);
  const saveAuditTpl = useServerFn(saveAuditTemplate);
  const delAuditTpl = useServerFn(deleteAuditTemplate);
  const putAudit = useServerFn(saveAudit);
  const signOff = useServerFn(signOffAudit);
  const removeAudit = useServerFn(deleteAudit);
  const putAction = useServerFn(saveAction);
  const removeAction = useServerFn(deleteAction);

  const [checkOpen, setCheckOpen] = useState<Any | null>(null);
  const [checkValues, setCheckValues] = useState<Record<string, any>>({});
  const [checkNotes, setCheckNotes] = useState("");
  const [checkIssue, setCheckIssue] = useState(false);
  const [checkAction, setCheckAction] = useState("");
  const [checkActionDue, setCheckActionDue] = useState("");

  const [auditOpen, setAuditOpen] = useState<Any | null>(null);
  const [answers, setAnswers] = useState<Record<string, { result?: string; comment?: string }>>({});
  const [auditSummary, setAuditSummary] = useState("");

  const [editCheck, setEditCheck] = useState<Any | null>(null);
  const [editAudit, setEditAudit] = useState<Any | null>(null);
  const [newAction, setNewAction] = useState({ description: "", owner_name: "", due_on: "" });
  const [busy, setBusy] = useState(false);

  const today = data?.today ?? todayIso();
  const refresh = () => qc.invalidateQueries({ queryKey: ["compliance"] });

  const due = useMemo(() => {
    const checks = (data?.checkTemplates ?? []).filter((t: Any) => t.active && t.next_due_on);
    const audits = (data?.auditTemplates ?? []).filter((t: Any) => t.active && t.next_due_on);
    return [
      ...checks.map((t: Any) => ({ ...t, _type: "check" as const })),
      ...audits.map((t: Any) => ({ ...t, _type: "audit" as const })),
    ].sort((a, b) => String(a.next_due_on).localeCompare(String(b.next_due_on)));
  }, [data]);

  const overdueCount = due.filter((d: Any) => d.next_due_on < today).length;
  const todayCount = due.filter((d: Any) => d.next_due_on === today).length;
  const openActions = (data?.actions ?? []).filter((a: Any) => a.status !== "done");

  async function run<T>(fn: () => Promise<T>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      refresh();
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openCheck(tpl: Any) {
    setCheckValues({});
    setCheckNotes("");
    setCheckIssue(false);
    setCheckAction("");
    setCheckActionDue("");
    setCheckOpen(tpl);
  }

  function openAudit(tpl: Any, existing?: Any) {
    setAnswers(existing?.answers ?? {});
    setAuditSummary(existing?.summary ?? "");
    setAuditOpen({ ...tpl, _existing: existing ?? null });
  }

  const auditScore = (a: Any) =>
    a.score_percent == null ? "—" : `${a.score_percent}%`;

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading checks and audits…</div>;
  }

  const isOwner = data?.isOwner || data?.role === "admin";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Checks &amp; audits</h1>
          <p className="text-sm text-muted-foreground">
            Run your regular clinic checks, score your audits and keep a dated record of everything.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await seed({ data: {} });
              if (!r.checks && !r.audits) toast.message("All ready-made templates are already added.");
            }, "Ready-made checks and audits added")
          }
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add ready-made templates
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={TriangleAlert} label="Overdue" value={overdueCount} tone={overdueCount ? "bad" : "ok"} />
        <StatCard icon={ClipboardCheck} label="Due today" value={todayCount} tone={todayCount ? "warn" : "ok"} />
        <StatCard icon={ShieldCheck} label="Open actions" value={openActions.length} tone={openActions.length ? "warn" : "ok"} />
      </div>

      <Tabs defaultValue="due">
        <TabsList>
          <TabsTrigger value="due">Due</TabsTrigger>
          <TabsTrigger value="checks">Checks</TabsTrigger>
          <TabsTrigger value="audits">Audits</TabsTrigger>
          <TabsTrigger value="actions">Action plan</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ---- Due ---- */}
        <TabsContent value="due" className="mt-4 space-y-3">
          {!due.length ? (
            <Empty text="Nothing scheduled yet. Add the ready-made templates to get started." />
          ) : (
            due.map((t: Any) => (
              <Card key={`${t._type}-${t.id}`}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <DueBadge due={t.next_due_on} today={today} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t._type === "check" ? CHECK_KIND_LABELS[t.kind] ?? "Check" : t.category || "Audit"} ·{" "}
                      {frequencyLabel(t.frequency)}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => (t._type === "check" ? openCheck(t) : openAudit(t))}>
                    {t._type === "check" ? "Complete check" : "Start audit"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ---- Checks ---- */}
        <TabsContent value="checks" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEditCheck({
                  name: "",
                  kind: "custom",
                  description: "",
                  frequency: "weekly",
                  fields: [{ key: "f1", label: "", type: "yesno" }],
                  next_due_on: today,
                  remind_email: true,
                  remind_in_app: true,
                  active: true,
                })
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> New check
            </Button>
          </div>
          {!(data?.checkTemplates ?? []).length ? (
            <Empty text="No checks yet." />
          ) : (
            (data?.checkTemplates ?? []).map((t: Any) => (
              <Card key={t.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{t.name}</span>
                      {!t.active && <Badge variant="secondary">Paused</Badge>}
                      <DueBadge due={t.next_due_on} today={today} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {CHECK_KIND_LABELS[t.kind] ?? "Check"} · {frequencyLabel(t.frequency)} ·{" "}
                      {(t.fields ?? []).length} question{(t.fields ?? []).length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openCheck(t)}>Complete</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditCheck(t)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${t.name}"? Past records are kept.`))
                          run(() => delCheck({ data: { id: t.id } }), "Check deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          <PresetHint
            title="Ready-made checks"
            items={CHECK_PRESETS.map((p) => p.name)}
          />
        </TabsContent>

        {/* ---- Audits ---- */}
        <TabsContent value="audits" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEditAudit({
                  name: "",
                  description: "",
                  category: "",
                  frequency: "quarterly",
                  questions: [{ id: "q1", section: "General", text: "" }],
                  remind_email: true,
                  remind_in_app: true,
                  active: true,
                })
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> New audit
            </Button>
          </div>
          {(data?.auditTemplates ?? []).map((t: Any) => (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <DueBadge due={t.next_due_on} today={today} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.category || "Audit"} · {frequencyLabel(t.frequency)} · {(t.questions ?? []).length} questions
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openAudit(t)}>Start</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditAudit(t)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${t.name}"? Completed audits are kept.`))
                        run(() => delAuditTpl({ data: { id: t.id } }), "Audit template deleted");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Completed audits</h2>
          {!(data?.audits ?? []).length ? (
            <Empty text="No audits run yet." />
          ) : (
            (data?.audits ?? []).map((a: Any) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <Badge variant="outline">{auditScore(a)}</Badge>
                      {a.status === "signed_off" ? (
                        <Badge className="bg-emerald-600">Signed off</Badge>
                      ) : a.status === "completed" ? (
                        <Badge variant="secondary">Awaiting sign-off</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.conducted_on} · {a.conducted_by_name}
                      {a.signed_off_by_name ? ` · signed off by ${a.signed_off_by_name}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openAudit(
                          { id: a.template_id, name: a.name, questions: a.questions, category: null },
                          a,
                        )
                      }
                    >
                      Open
                    </Button>
                    {isOwner && a.status !== "signed_off" && (
                      <Button size="sm" disabled={busy} onClick={() => run(() => signOff({ data: { id: a.id } }), "Audit signed off")}>
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Sign off
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Delete this audit record?"))
                          run(() => removeAudit({ data: { id: a.id } }), "Audit deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          <PresetHint title="Ready-made audits" items={AUDIT_PRESETS.map((p) => p.name)} />
        </TabsContent>

        {/* ---- Actions ---- */}
        <TabsContent value="actions" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add an action</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Input
                placeholder="What needs doing?"
                value={newAction.description}
                onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
              />
              <Input
                placeholder="Who owns it"
                value={newAction.owner_name}
                onChange={(e) => setNewAction({ ...newAction, owner_name: e.target.value })}
              />
              <Input
                type="date"
                value={newAction.due_on}
                onChange={(e) => setNewAction({ ...newAction, due_on: e.target.value })}
              />
              <Button
                disabled={busy || !newAction.description.trim()}
                onClick={async () => {
                  const ok = await run(
                    () => putAction({ data: { ...newAction, due_on: newAction.due_on || null } }),
                    "Action added",
                  );
                  if (ok) setNewAction({ description: "", owner_name: "", due_on: "" });
                }}
              >
                Add
              </Button>
            </CardContent>
          </Card>

          {!(data?.actions ?? []).length ? (
            <Empty text="No actions yet." />
          ) : (
            (data?.actions ?? []).map((a: Any) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className={a.status === "done" ? "line-through text-muted-foreground" : "font-medium"}>
                      {a.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.owner_name || "Unassigned"}
                      {a.due_on ? ` · due ${a.due_on}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={a.status === "done" ? "outline" : "default"}
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            putAction({
                              data: {
                                id: a.id,
                                description: a.description,
                                owner_name: a.owner_name,
                                due_on: a.due_on,
                                status: a.status === "done" ? "open" : "done",
                              },
                            }),
                          a.status === "done" ? "Reopened" : "Marked done",
                        )
                      }
                    >
                      {a.status === "done" ? "Reopen" : "Done"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => removeAction({ data: { id: a.id } }), "Action deleted")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ---- History ---- */}
        <TabsContent value="history" className="mt-4 space-y-3">
          {!(data?.records ?? []).length ? (
            <Empty text="No completed checks yet." />
          ) : (
            (data?.records ?? []).map((r: Any) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.template_name}</span>
                    <Badge variant="outline">{r.performed_on}</Badge>
                    {r.issue_flagged && (
                      <Badge className="bg-destructive text-destructive-foreground">Issue flagged</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed by {r.performed_by_name}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {Object.entries(r.values ?? {}).map(([k, v]) => (
                      <span key={k}>
                        {k}: <span className="text-foreground">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                  {r.notes && <p className="mt-2 text-sm">{r.notes}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Complete check dialog ---- */}
      <Dialog open={!!checkOpen} onOpenChange={(o) => !o && setCheckOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{checkOpen?.name}</DialogTitle>
            <DialogDescription>{checkOpen?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {((checkOpen?.fields ?? []) as CheckField[]).map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                {f.type === "yesno" ? (
                  <Select
                    value={checkValues[f.key] ?? ""}
                    onValueChange={(v) => setCheckValues({ ...checkValues, [f.key]: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="N/A">Not applicable</SelectItem>
                    </SelectContent>
                  </Select>
                ) : f.type === "number" ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={checkValues[f.key] ?? ""}
                    onChange={(e) => setCheckValues({ ...checkValues, [f.key]: e.target.value })}
                  />
                ) : (
                  <Textarea
                    rows={2}
                    value={checkValues[f.key] ?? ""}
                    onChange={(e) => setCheckValues({ ...checkValues, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Flag an issue</p>
                <p className="text-xs text-muted-foreground">Something wasn't right during this check</p>
              </div>
              <Switch checked={checkIssue} onCheckedChange={setCheckIssue} />
            </div>
            {checkIssue && (
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <Input
                  placeholder="Action to fix it"
                  value={checkAction}
                  onChange={(e) => setCheckAction(e.target.value)}
                />
                <Input type="date" value={checkActionDue} onChange={(e) => setCheckActionDue(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={checkNotes} onChange={(e) => setCheckNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                const ok = await run(
                  () =>
                    doCheck({
                      data: {
                        template_id: checkOpen!.id,
                        values: checkValues,
                        issue_flagged: checkIssue,
                        notes: checkNotes,
                        action: checkIssue && checkAction.trim()
                          ? { description: checkAction, due_on: checkActionDue || null }
                          : null,
                      },
                    }),
                  "Check recorded",
                );
                if (ok) setCheckOpen(null);
              }}
            >
              Save check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Run audit dialog ---- */}
      <Dialog open={!!auditOpen} onOpenChange={(o) => !o && setAuditOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{auditOpen?.name}</DialogTitle>
            <DialogDescription>
              Mark each standard as met, not met or not applicable. Your score is worked out from the
              standards that apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(auditOpen?.questions ?? []).map((q: Any, i: number, arr: Any[]) => (
              <div key={q.id} className="space-y-2">
                {(i === 0 || arr[i - 1].section !== q.section) && (
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {q.section}
                  </p>
                )}
                <div className="rounded-md border p-3">
                  <p className="text-sm">{q.text}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { v: "yes", l: "Met" },
                      { v: "no", l: "Not met" },
                      { v: "na", l: "N/A" },
                    ].map((o) => (
                      <Button
                        key={o.v}
                        size="sm"
                        variant={answers[q.id]?.result === o.v ? "default" : "outline"}
                        onClick={() =>
                          setAnswers({ ...answers, [q.id]: { ...answers[q.id], result: o.v } })
                        }
                      >
                        {o.l}
                      </Button>
                    ))}
                  </div>
                  {answers[q.id]?.result === "no" && (
                    <Input
                      className="mt-2"
                      placeholder="What was found / what will you do?"
                      value={answers[q.id]?.comment ?? ""}
                      onChange={(e) =>
                        setAnswers({ ...answers, [q.id]: { ...answers[q.id], comment: e.target.value } })
                      }
                    />
                  )}
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Summary</Label>
              <Textarea rows={3} value={auditSummary} onChange={(e) => setAuditSummary(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                const ok = await run(
                  () =>
                    putAudit({
                      data: {
                        id: auditOpen?._existing?.id,
                        template_id: auditOpen?.id ?? null,
                        name: auditOpen!.name,
                        questions: auditOpen!.questions ?? [],
                        answers,
                        summary: auditSummary,
                        complete: false,
                      },
                    }),
                  "Draft saved",
                );
                if (ok) setAuditOpen(null);
              }}
            >
              Save draft
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const actions = (auditOpen?.questions ?? [])
                  .filter((q: Any) => answers[q.id]?.result === "no")
                  .map((q: Any) => ({
                    description: `${q.text}${answers[q.id]?.comment ? ` — ${answers[q.id]?.comment}` : ""}`,
                  }));
                const ok = await run(
                  () =>
                    putAudit({
                      data: {
                        id: auditOpen?._existing?.id,
                        template_id: auditOpen?.id ?? null,
                        name: auditOpen!.name,
                        questions: auditOpen!.questions ?? [],
                        answers,
                        summary: auditSummary,
                        complete: true,
                        actions,
                      },
                    }),
                  "Audit completed",
                );
                if (ok) setAuditOpen(null);
              }}
            >
              Complete audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edit check template ---- */}
      <Dialog open={!!editCheck} onOpenChange={(o) => !o && setEditCheck(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCheck?.id ? "Edit check" : "New check"}</DialogTitle>
          </DialogHeader>
          {editCheck && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={editCheck.name} onChange={(e) => setEditCheck({ ...editCheck, name: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={editCheck.kind} onValueChange={(v) => setEditCheck({ ...editCheck, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHECK_KIND_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>How often</Label>
                  <Select value={editCheck.frequency} onValueChange={(v) => setEditCheck({ ...editCheck, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={editCheck.description ?? ""}
                  onChange={(e) => setEditCheck({ ...editCheck, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Next due</Label>
                <Input
                  type="date"
                  value={editCheck.next_due_on ?? today}
                  onChange={(e) => setEditCheck({ ...editCheck, next_due_on: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Questions</Label>
                {(editCheck.fields ?? []).map((f: CheckField, i: number) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                    <Input
                      placeholder="Question"
                      value={f.label}
                      onChange={(e) => {
                        const fields = [...editCheck.fields];
                        fields[i] = { ...f, label: e.target.value, key: f.key || `f${i + 1}` };
                        setEditCheck({ ...editCheck, fields });
                      }}
                    />
                    <Select
                      value={f.type}
                      onValueChange={(v) => {
                        const fields = [...editCheck.fields];
                        fields[i] = { ...f, type: v } as CheckField;
                        setEditCheck({ ...editCheck, fields });
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yesno">Yes / No</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditCheck({
                          ...editCheck,
                          fields: editCheck.fields.filter((_: unknown, j: number) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditCheck({
                      ...editCheck,
                      fields: [
                        ...(editCheck.fields ?? []),
                        { key: `f${(editCheck.fields ?? []).length + 1}`, label: "", type: "yesno" },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add question
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Email me when it's due</span>
                <Switch
                  checked={editCheck.remind_email !== false}
                  onCheckedChange={(v) => setEditCheck({ ...editCheck, remind_email: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Show in my notifications</span>
                <Switch
                  checked={editCheck.remind_in_app !== false}
                  onCheckedChange={(v) => setEditCheck({ ...editCheck, remind_in_app: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Active</span>
                <Switch
                  checked={editCheck.active !== false}
                  onCheckedChange={(v) => setEditCheck({ ...editCheck, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                const tpl = editCheck as Any;
                const fields = (tpl.fields ?? []).filter((f: CheckField) => f.label.trim());
                const ok = await run(
                  () => saveCheck({ data: { ...tpl, fields } as any }),
                  "Check saved",
                );
                if (ok) setEditCheck(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edit audit template ---- */}
      <Dialog open={!!editAudit} onOpenChange={(o) => !o && setEditAudit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editAudit?.id ? "Edit audit" : "New audit"}</DialogTitle>
          </DialogHeader>
          {editAudit && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={editAudit.name} onChange={(e) => setEditAudit({ ...editAudit, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input
                    placeholder="e.g. Safe care"
                    value={editAudit.category ?? ""}
                    onChange={(e) => setEditAudit({ ...editAudit, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>How often</Label>
                <Select value={editAudit.frequency} onValueChange={(v) => setEditAudit({ ...editAudit, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Standards</Label>
                {(editAudit.questions ?? []).map((q: Any, i: number) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <Input
                      placeholder="Section"
                      value={q.section}
                      onChange={(e) => {
                        const questions = [...editAudit.questions];
                        questions[i] = { ...q, section: e.target.value };
                        setEditAudit({ ...editAudit, questions });
                      }}
                    />
                    <Input
                      placeholder="Standard"
                      value={q.text}
                      onChange={(e) => {
                        const questions = [...editAudit.questions];
                        questions[i] = { ...q, text: e.target.value, id: q.id || `q${i + 1}` };
                        setEditAudit({ ...editAudit, questions });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditAudit({
                          ...editAudit,
                          questions: editAudit.questions.filter((_: unknown, j: number) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditAudit({
                      ...editAudit,
                      questions: [
                        ...(editAudit.questions ?? []),
                        {
                          id: `q${(editAudit.questions ?? []).length + 1}-${Date.now()}`,
                          section: editAudit.questions?.at(-1)?.section || "General",
                          text: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add standard
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                const tpl = editAudit as Any;
                const questions = (tpl.questions ?? []).filter((q: Any) => q.text.trim());
                const ok = await run(
                  () => saveAuditTpl({ data: { ...tpl, questions } as any }),
                  "Audit saved",
                );
                if (ok) setEditAudit(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={
            "rounded-md p-2 " +
            (tone === "bad"
              ? "bg-destructive/10 text-destructive"
              : tone === "warn"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700")
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function PresetHint({ title, items }: { title: string; items: string[] }) {
  return (
    <p className="pt-2 text-xs text-muted-foreground">
      <span className="font-medium">{title}:</span> {items.join(" · ")}
    </p>
  );
}
