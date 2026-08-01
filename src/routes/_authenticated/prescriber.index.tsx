import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import {
  listMyReferrals,
  updateReferralStatus,
  getReferralFull,
  getMyPrescriberDefaults,
} from "@/lib/prescriber.functions";
import {
  savePrescription,
  signPrescription,
  listPrescriptionsForReferral,
  saveCarePlan,
  sendCarePlan,
  getCarePlanForReferral,
} from "@/lib/prescriptions.functions";
import { addWalkInConsentForms, addWalkInMedicalForms, listLinkedPractitionerConsentForms, listLinkedPractitionerMedicalForms, listMySnippets, listMyRxTemplates, saveWalkInMedicalFormResponse, sendWalkInToPractitioner } from "@/lib/prescriber-directions.functions";
import { AESTHETICS_MEDICATIONS } from "@/lib/aesthetics-medications";
import { WalkInDialog } from "@/components/prescriber/WalkInDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, FileText, User, Pill, ClipboardList, PenLine, Send, Plus, Loader2 } from "lucide-react";


export const Route = createFileRoute("/_authenticated/prescriber/")({
  ssr: false,
  component: PrescriberHome,
});

type Ref = Awaited<ReturnType<typeof listMyReferrals>>[number];

function PrescriberHome() {
  const fetchRefs = useServerFn(listMyReferrals);
  const decide = useServerFn(updateReferralStatus);
  const refs = useQuery({ queryKey: ["my-referrals"], queryFn: () => fetchRefs() });
  const list = (refs.data ?? []) as Ref[];
  const pending = useMemo(() => list.filter((r) => r.status === "pending"), [list]);
  const active = useMemo(() => list.filter((r) => r.status === "accepted"), [list]);
  const history = useMemo(() => list.filter((r) => r.status === "completed" || r.status === "declined"), [list]);

  async function act(id: string, action: "accept" | "decline" | "complete") {
    try {
      await decide({ data: { id, action } });
      toast.success(action === "accept" ? "Case accepted" : action === "decline" ? "Declined" : "Marked complete");
      refs.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-2xl">Referrals</h2>
          <p className="text-sm text-muted-foreground">
            Patients booked by connected practitioners appear here for your sign-off.
          </p>
        </div>
        <WalkInDialog trigger={<Button size="sm" variant="outline">+ New walk-in</Button>} onCreated={() => refs.refetch()} />
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="pending" className="flex-1">
            Pending {pending.length > 0 && <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? <Empty>No pending referrals.</Empty> : pending.map((r) => <RefCard key={r.id} r={r} onAct={act} />)}
        </TabsContent>
        <TabsContent value="active" className="space-y-3">
          {active.length === 0 ? <Empty>No active cases.</Empty> : active.map((r) => <RefCard key={r.id} r={r} onAct={act} />)}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? <Empty>No history yet.</Empty> : history.map((r) => <RefCard key={r.id} r={r} onAct={act} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{children}</CardContent></Card>;
}

function RefCard({ r, onAct }: { r: Ref; onAct: (id: string, action: "accept" | "decline" | "complete") => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = r.status === "accepted" || r.status === "completed";
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {r.patient_display}
              <span className="ml-2 text-xs font-normal text-muted-foreground">· {r.treatment_name}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Referred by{" "}
              <span className="font-medium text-foreground">
                {r.practitioner_name ? `${r.practitioner_name} · ` : ""}{r.clinic_name}
              </span>
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {r.location_name ? <span>· {r.location_name}</span> : null}
              {r.appointment ? <span>· {r.appointment.scheduled_date} at {r.appointment.start_time.slice(0,5)}</span> : null}
              {r.routing === "in_person_consult" && <span>· In-person consult</span>}
              {r.routing === "clinic_visit" && <span>· Clinic visit</span>}
              {r.is_walk_in && <span>· Walk-in</span>}
            </p>
            {r.is_walk_in && r.walk_in_note && (
              <p className="mt-2 rounded border bg-muted/40 p-2 text-xs whitespace-pre-wrap">{r.walk_in_note}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={r.status} />
            {r.is_walk_in && r.awaiting_practitioner_close && <Badge variant="outline" className="text-[10px]">With practitioner</Badge>}
          </div>
        </div>
        {r.status === "accepted" && r.is_walk_in && !r.awaiting_practitioner_close && (
          <SendWalkInButton id={r.id} />
        )}
        {r.status === "pending" && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onAct(r.id, "decline")}>
              <XCircle className="mr-1 h-4 w-4" /> Decline
            </Button>
            <Button size="sm" onClick={() => onAct(r.id, "accept")}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Accept case
            </Button>
          </div>
        )}
        {canExpand && (
          <>
            <Button variant="ghost" size="sm" className="h-auto w-full justify-between py-2" onClick={() => setExpanded((x) => !x)}>
              <span className="inline-flex items-center gap-2"><User className="h-4 w-4 shrink-0" /> Full record &amp; medical forms</span>
              {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </Button>
            {expanded && <FullRecord id={r.id} onComplete={() => onAct(r.id, "complete")} status={r.status} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Ref["status"] }) {
  const map: Record<Ref["status"], { v: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { v: "secondary", label: "Pending" },
    accepted: { v: "default", label: "Accepted" },
    declined: { v: "destructive", label: "Declined" },
    completed: { v: "outline", label: "Completed" },
  };
  const m = map[status];
  return <Badge variant={m.v}>{m.label}</Badge>;
}

function FullRecord({ id, onComplete, status }: { id: string; onComplete: () => void; status: Ref["status"] }) {
  const fetchFull = useServerFn(getReferralFull);
  const q = useQuery({ queryKey: ["referral-full", id], queryFn: () => fetchFull({ data: { id } }) });
  const [note, setNote] = useState("");
  if (q.isLoading) return <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="px-2 py-3 text-sm text-destructive">{(q.error as Error).message}</p>;
  const parsed = q.data ? JSON.parse((q.data as { json: string }).json) ?? {} : {};
  const ref = parsed.referral ?? {};
  const client = parsed.client ?? null;
  const appt = parsed.appointment ?? null;
  const forms: MedicalFormRecord[] = parsed.medical_forms ?? [];
  const consents: { id: string; template_name: string; status: string; signed_at: string | null; signature_name: string | null }[] = parsed.consents ?? [];
  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-3 text-sm">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</p>
        <p className="mt-1 font-medium">{ref.patient_name ?? client?.full_name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {ref.patient_email ?? client?.email ?? "—"}
          {ref.patient_phone ? ` · ${ref.patient_phone}` : client?.phone ? ` · ${client.phone}` : ""}
        </p>
      </section>
      {appt && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appointment</p>
          <p className="mt-1">{appt.scheduled_date} at {String(appt.start_time).slice(0, 5)} · {appt.status}</p>
        </section>
      )}
      {status === "accepted" ? (
        <Tabs defaultValue="records" className="pt-1">
          <TabsList className="h-auto w-full flex-wrap">
            <TabsTrigger value="records" className="flex-1 gap-1 px-2 text-xs sm:px-3 sm:text-sm">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Medical &amp; consent</span>
              <span className="sm:hidden">Records</span>
            </TabsTrigger>
            <TabsTrigger value="prescribe" className="flex-1 gap-1 px-2 text-xs sm:px-3 sm:text-sm">
              <Pill className="h-3.5 w-3.5 shrink-0" />
              <span>Rx</span>
            </TabsTrigger>
            <TabsTrigger value="careplan" className="flex-1 gap-1 px-2 text-xs sm:px-3 sm:text-sm">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              <span>Care</span>
            </TabsTrigger>
            <TabsTrigger value="complete" className="flex-1 px-2 text-xs sm:px-3 sm:text-sm">Complete</TabsTrigger>
          </TabsList>
          <TabsContent value="records" className="space-y-4 pt-3">
            <RecordsSection forms={forms} consents={consents} referralId={id} practitionerProfileId={ref.practitioner_profile_id ?? null} onChanged={() => q.refetch()} />
          </TabsContent>
          <TabsContent value="prescribe" className="pt-3">
            <PrescriptionEditor referralId={id} patient={ref} client={client} />
          </TabsContent>
          <TabsContent value="careplan" className="pt-3">
            <CarePlanEditor referralId={id} />
          </TabsContent>
          <TabsContent value="complete" className="space-y-2 pt-3">
            <p className="text-xs text-muted-foreground">
              Once prescription is signed and care plan sent, mark the referral complete.
              Both documents are returned to the practitioner automatically.
            </p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional final note for practitioner…" />
            <div className="flex justify-end">
              <Button size="sm" onClick={onComplete}><CheckCircle2 className="mr-1 h-4 w-4" /> Mark complete</Button>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <RecordsSection forms={forms} consents={consents} referralId={id} practitionerProfileId={ref.practitioner_profile_id ?? null} onChanged={() => q.refetch()} />
      )}
    </div>
  );
}

type MedicalFormRecord = {
  id: string;
  template_id?: string | null;
  template_name: string;
  description?: string | null;
  response: unknown;
  submitted_at: string | null;
  status: string;
  schema?: unknown;
  token?: string | null;
};

function RecordsSection({
  forms,
  consents,
  referralId,
  practitionerProfileId,
  onChanged,
}: {
  forms: MedicalFormRecord[];
  consents: {
    id: string;
    template_id?: string | null;
    template_name: string;
    status: string;
    signed_at: string | null;
    signature_name: string | null;
    signature_data?: string | null;
    signed_url?: string | null;
    body_markdown?: string | null;
    summary?: string | null;
    treatment_type?: string | null;
    token?: string | null;
  }[];
  referralId: string;
  practitionerProfileId: string | null;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Medical forms ({forms.length})
          </p>
          {practitionerProfileId ? (
            <AttachMedicalFormsButton
              referralId={referralId}
              practitionerProfileId={practitionerProfileId}
              attachedIds={forms.map((f) => f.template_id).filter(Boolean) as string[]}
              onChanged={onChanged}
            />
          ) : null}
        </div>
        {forms.length === 0 ? (
          <p className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Use Select forms to choose the medical forms for this walk-in. They will load here in full once selected.</p>
        ) : (
          <Accordion type="multiple" className="rounded border bg-background">
            {forms.map((f) => (
              <AccordionItem key={f.id} value={f.id} className="border-b last:border-b-0">
                <AccordionTrigger className="px-3 py-2 text-left hover:no-underline">
                  <span className="flex min-w-0 flex-1 items-center gap-2 pr-2 text-sm font-medium">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{f.template_name}</span>
                  </span>
                  <span className="ml-2 shrink-0 text-xs font-normal text-muted-foreground">
                    {f.status}
                    {f.submitted_at ? ` · ${new Date(f.submitted_at).toLocaleDateString()}` : ""}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <MedicalFormFullView form={f} referralId={referralId} onChanged={onChanged} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Consent forms ({consents.length})
          </p>
          {practitionerProfileId ? (
            <AttachConsentFormsButton
              referralId={referralId}
              practitionerProfileId={practitionerProfileId}
              attachedIds={consents.map((c) => c.template_id).filter(Boolean) as string[]}
              onChanged={onChanged}
            />
          ) : null}
        </div>
        {consents.length === 0 ? (
          <p className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Use Select consents to choose consent forms for this walk-in. They will load here once selected.</p>
        ) : (
          <Accordion type="multiple" className="rounded border bg-background">
            {consents.map((c) => (
              <AccordionItem key={c.id} value={c.id} className="border-b last:border-b-0">
                <AccordionTrigger className="px-3 py-2 text-left hover:no-underline">
                  <span className="flex min-w-0 flex-1 items-center gap-2 pr-2 text-sm font-medium">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{c.template_name}</span>
                  </span>
                  <span className="ml-2 shrink-0 text-xs font-normal text-muted-foreground">
                    {c.status}
                    {c.signed_at ? ` · ${new Date(c.signed_at).toLocaleDateString()}` : ""}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 px-3 pb-3">
                  {c.summary ? (
                    <p className="text-xs italic text-muted-foreground">{c.summary}</p>
                  ) : null}
                  {c.body_markdown ? (
                    <div className="whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs leading-relaxed">
                      {c.body_markdown}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No consent body on file.</p>
                  )}
                  <div className="grid grid-cols-1 gap-2 border-t pt-2 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Signed by: </span>
                      <span className="font-medium">{c.signature_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="font-medium">
                        {c.signed_at ? new Date(c.signed_at).toLocaleString() : "—"}
                      </span>
                    </div>
                    {c.signed_url ? (
                      <a
                        href={c.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Download PDF
                      </a>
                    ) : null}
                    {c.token ? (
                      <a
                        href={`/c/${c.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Open signing link
                      </a>
                    ) : null}
                  </div>
                  {c.signature_data ? (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Signature</p>
                      <img
                        src={c.signature_data}
                        alt="Signature"
                        className="max-h-20 rounded border bg-white p-1"
                      />
                    </div>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>
    </div>
  );
}

function AttachConsentFormsButton({
  referralId,
  practitionerProfileId,
  attachedIds,
  onChanged,
}: {
  referralId: string;
  practitionerProfileId: string;
  attachedIds: string[];
  onChanged: () => void;
}) {
  const fetchConsents = useServerFn(listLinkedPractitionerConsentForms);
  const attachConsents = useServerFn(addWalkInConsentForms);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const consentsQ = useQuery({
    queryKey: ["linked-practitioner-consent-forms", practitionerProfileId],
    queryFn: () => fetchConsents({ data: { practitioner_profile_id: practitionerProfileId } }),
    enabled: open,
  });
  const attached = new Set(attachedIds);
  const consents = ((consentsQ.data ?? []) as { id: string; name: string; summary?: string | null; treatment_type?: string | null }[]).filter((f) => !attached.has(f.id));
  const filtered = consents.filter((f) => `${f.name} ${f.summary ?? ""} ${f.treatment_type ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) return toast.error("Select at least one consent form");
    try {
      const res = await attachConsents({ data: { referral_id: referralId, template_ids: Array.from(selected) } });
      toast.success(res.added > 0 ? "Consent forms loaded" : "Those consents were already loaded");
      setOpen(false);
      setSelected(new Set());
      setQuery("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]">
          <Plus className="h-3.5 w-3.5" /> Select consents
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search consent forms…" />
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {consentsQ.isLoading ? (
            <p className="py-3 text-xs text-muted-foreground">Loading consents…</p>
          ) : filtered.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">No more consent forms available.</p>
          ) : filtered.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-accent/40">
              <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.name}</span>
                {f.summary || f.treatment_type ? <span className="block truncate text-xs text-muted-foreground">{f.summary ?? f.treatment_type}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <Button type="button" size="sm" className="w-full" onClick={save} disabled={selected.size === 0}>Load selected consents</Button>
      </PopoverContent>
    </Popover>
  );
}

function AttachMedicalFormsButton({
  referralId,
  practitionerProfileId,
  attachedIds,
  onChanged,
}: {
  referralId: string;
  practitionerProfileId: string;
  attachedIds: string[];
  onChanged: () => void;
}) {
  const fetchForms = useServerFn(listLinkedPractitionerMedicalForms);
  const attachForms = useServerFn(addWalkInMedicalForms);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const formsQ = useQuery({
    queryKey: ["linked-practitioner-medical-forms", practitionerProfileId],
    queryFn: () => fetchForms({ data: { practitioner_profile_id: practitionerProfileId } }),
    enabled: open,
  });
  const attached = new Set(attachedIds);
  const forms = ((formsQ.data ?? []) as { id: string; name: string; description?: string | null }[]).filter((f) => !attached.has(f.id));
  const filtered = forms.filter((f) => `${f.name} ${f.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) return toast.error("Select at least one medical form");
    try {
      const res = await attachForms({ data: { referral_id: referralId, template_ids: Array.from(selected) } });
      toast.success(res.added > 0 ? "Medical forms loaded" : "Those forms were already loaded");
      setOpen(false);
      setSelected(new Set());
      setQuery("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]">
          <Plus className="h-3.5 w-3.5" /> Select forms
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medical forms…" />
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {formsQ.isLoading ? (
            <p className="py-3 text-xs text-muted-foreground">Loading forms…</p>
          ) : filtered.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">No more forms available.</p>
          ) : filtered.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-accent/40">
              <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.name}</span>
                {f.description ? <span className="block truncate text-xs text-muted-foreground">{f.description}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <Button type="button" size="sm" className="w-full" onClick={save} disabled={selected.size === 0}>Load selected forms</Button>
      </PopoverContent>
    </Popover>
  );
}

type PrescriberFormElement = {
  id?: string;
  type?: string;
  label?: string;
  text?: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
  placeholder?: string;
  fieldType?: string;
  level?: 1 | 2 | 3;
  max?: number;
};
type PrescriberFormStep = { id?: string; title?: string; elements?: PrescriberFormElement[] };

function normalizeMedicalSchema(schema: unknown): PrescriberFormStep[] {
  if (schema && typeof schema === "object" && !Array.isArray(schema) && Array.isArray((schema as { steps?: unknown }).steps)) {
    return ((schema as { steps: PrescriberFormStep[] }).steps ?? []).map((s, i) => ({ ...s, id: s.id ?? `step-${i}` }));
  }
  if (Array.isArray(schema)) {
    return schema.map((group: any, i) => ({
      id: String(group.id ?? group.group ?? `group-${i}`),
      title: String(group.title ?? group.group ?? `Section ${i + 1}`),
      elements: Array.isArray(group.elements)
        ? group.elements
        : (Array.isArray(group.questions) ? group.questions.map((q: any) => ({ ...q, type: q.type ?? "field" })) : []),
    }));
  }
  return [];
}

function MedicalFormFullView({ form, referralId, onChanged }: { form: MedicalFormRecord; referralId: string; onChanged: () => void }) {
  const saveResponse = useServerFn(saveWalkInMedicalFormResponse);
  const steps = normalizeMedicalSchema(form.schema);
  const response = form.response && typeof form.response === "object" && !Array.isArray(form.response)
    ? (form.response as Record<string, unknown>)
    : null;
  const [answers, setAnswers] = useState<Record<string, unknown>>(response ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setAnswers(response ?? {}); }, [form.id, form.response]);

  if (!steps.length) {
    return form.response ? <FormResponseView response={form.response} /> : <p className="text-xs text-muted-foreground">No response recorded.</p>;
  }

  async function save() {
    try {
      setSaving(true);
      await saveResponse({ data: { referral_id: referralId, form_id: form.id, response: answers } });
      toast.success("Medical form saved to the patient record");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 text-xs">
      {form.description ? <p className="text-muted-foreground">{form.description}</p> : null}
      {steps.map((step, stepIndex) => (
        <div key={step.id ?? stepIndex} className="space-y-2 rounded-md border bg-muted/20 p-3">
          {step.title ? <p className="font-semibold text-foreground">{step.title}</p> : null}
          {(step.elements ?? []).map((el, i) => (
            <FormSchemaElement
              key={String(el.id ?? i)}
              element={el}
              answers={answers}
              onChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
            />
          ))}
        </div>
      ))}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Save medical form
        </Button>
      </div>
    </div>
  );
}

function FormSchemaElement({ element, answers, onChange }: { element: PrescriberFormElement; answers: Record<string, unknown>; onChange: (id: string, value: unknown) => void }) {
  const type = String(element.type ?? "field");
  const id = typeof element.id === "string" ? element.id : String(element.label ?? element.text ?? "").toLowerCase().replace(/\W+/g, "_");
  const label = String(element.label ?? element.text ?? "");
  const value = answers[id] ?? answers[label];
  const reqMark = element.required ? <span className="text-destructive"> *</span> : null;
  if (type === "heading") return <p className="text-sm font-semibold text-foreground">{String(element.text ?? label)}</p>;
  if (type === "paragraph" || type === "info") return <p className="whitespace-pre-wrap text-muted-foreground">{String(element.text ?? label)}</p>;
  if (type === "separator") return <div className="my-2 border-t" />;
  if (type === "space") return <div className="h-2" />;
  if (type === "yesno" || type === "radio") {
    const options = type === "yesno" ? ["Yes", "No"] : (element.options ?? []);
    return (
      <div className="rounded bg-background p-2">
        <Label className="text-xs font-medium">{label || "Question"}{reqMark}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o} type="button" onClick={() => onChange(id, o)} className={`rounded-md border px-3 py-1.5 text-xs ${value === o ? "border-primary bg-primary/10 text-primary" : "bg-muted/20"}`}>{o}</button>
          ))}
        </div>
        {element.helpText ? <p className="mt-1 text-muted-foreground">{element.helpText}</p> : null}
      </div>
    );
  }
  if (type === "select") {
    return (
      <div className="rounded bg-background p-2">
        <Label className="text-xs font-medium">{label || "Question"}{reqMark}</Label>
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(id, v)}>
          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{(element.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }
  if (type === "checkbox" || type === "checkbox_group") {
    const options = element.options ?? [];
    if (options.length) {
      const arr = Array.isArray(value) ? value as string[] : [];
      return (
        <div className="rounded bg-background p-2">
          <Label className="text-xs font-medium">{label || "Question"}{reqMark}</Label>
          <div className="mt-2 space-y-1">
            {options.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded border p-2">
                <Checkbox checked={arr.includes(o)} onCheckedChange={(c) => onChange(id, c ? [...arr, o] : arr.filter((x) => x !== o))} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    return (
      <label className="flex cursor-pointer items-start gap-2 rounded bg-background p-2">
        <Checkbox checked={!!value} onCheckedChange={(c) => onChange(id, !!c)} className="mt-0.5" />
        <span>{label || "Question"}{reqMark}</span>
      </label>
    );
  }
  if (type === "rating") {
    const max = Number(element.max ?? 5);
    const n = Number(value) || 0;
    return (
      <div className="rounded bg-background p-2">
        <Label className="text-xs font-medium">{label || "Question"}{reqMark}</Label>
        <div className="mt-1 flex gap-1">{Array.from({ length: max }).map((_, i) => <button key={i} type="button" onClick={() => onChange(id, i + 1)} className={i < n ? "text-amber-500" : "text-muted-foreground/40"}>★</button>)}</div>
      </div>
    );
  }
  const fieldType = element.fieldType === "textarea" || type === "textarea" ? "textarea" : (element.fieldType ?? (type === "date" ? "date" : "text"));
  return (
    <div className="rounded bg-background p-2">
      <div className="flex items-start justify-between gap-3">
        <Label className="font-medium text-foreground">{label || "Question"}{reqMark}</Label>
        {element.required ? <Badge variant="outline" className="shrink-0 text-[10px]">Required</Badge> : null}
      </div>
      {element.helpText ? <p className="mt-1 text-muted-foreground">{String(element.helpText)}</p> : null}
      {fieldType === "textarea" ? (
        <Textarea rows={2} className="mt-2 text-xs" value={String(value ?? "")} placeholder={element.placeholder} onChange={(e) => onChange(id, e.target.value)} />
      ) : (
        <Input type={fieldType} className="mt-2 h-8 text-xs" value={String(value ?? "")} placeholder={element.placeholder} onChange={(e) => onChange(id, e.target.value)} />
      )}
    </div>
  );
}

function FormResponseView({ response }: { response: unknown }) {
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const entries = Object.entries(response as Record<string, unknown>);
    if (entries.length === 0) {
      return <p className="text-xs text-muted-foreground">Empty response.</p>;
    }
    return (
      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded bg-muted/40 p-2">
            <dt className="font-medium capitalize text-foreground">{k.replace(/_/g, " ")}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
              {v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-xs text-muted-foreground">
      {JSON.stringify(response, null, 2)}
    </pre>
  );
}

/* ---------------------- Prescription editor ---------------------- */
type RxRow = {
  id: string;
  drug_name: string;
  drug_form: string | null;
  drug_strength: string | null;
  dose: string;
  quantity: string;
  directions: string;
  repeats_allowed: number;
  valid_until: string | null;
  notes: string | null;
  status: string;
  signed_at: string | null;
  signature_name: string | null;
  patient_name: string;
  patient_dob: string | null;
  patient_address: string | null;
  prescriber_name: string;
  prescriber_reg_body: string | null;
  prescriber_reg_number: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
};

function PrescriptionEditor({ referralId, patient, client }: { referralId: string; patient: Record<string, unknown>; client: Record<string, unknown> | null }) {
  const list = useServerFn(listPrescriptionsForReferral);
  const save = useServerFn(savePrescription);
  const sign = useServerFn(signPrescription);
  const fetchDefaults = useServerFn(getMyPrescriberDefaults);
  const q = useQuery({ queryKey: ["rx", referralId], queryFn: () => list({ data: { referral_id: referralId } }) });
  const defaults = useQuery({ queryKey: ["my-prescriber-defaults"], queryFn: () => fetchDefaults(), staleTime: 5 * 60 * 1000 });
  const rows = (q.data ?? []) as RxRow[];
  const latest = rows[0];

  const [form, setForm] = useState({
    id: undefined as string | undefined,
    patient_name: "",
    patient_dob: "",
    patient_address: "",
    prescriber_name: "",
    prescriber_reg_body: "",
    prescriber_reg_number: "",
    clinic_name: "",
    clinic_address: "",
    drug_name: "",
    drug_form: "",
    drug_strength: "",
    dose: "",
    quantity: "",
    directions: "",
    repeats_allowed: 0,
    valid_until: "",
    notes: "",
  });
  const [sigName, setSigName] = useState("");

  useEffect(() => {
    if (latest) {
      setForm({
        id: latest.id,
        patient_name: latest.patient_name,
        patient_dob: latest.patient_dob ?? "",
        patient_address: latest.patient_address ?? "",
        prescriber_name: latest.prescriber_name,
        prescriber_reg_body: latest.prescriber_reg_body ?? "",
        prescriber_reg_number: latest.prescriber_reg_number ?? "",
        clinic_name: latest.clinic_name ?? "",
        clinic_address: latest.clinic_address ?? "",
        drug_name: latest.drug_name,
        drug_form: latest.drug_form ?? "",
        drug_strength: latest.drug_strength ?? "",
        dose: latest.dose,
        quantity: latest.quantity,
        directions: latest.directions,
        repeats_allowed: latest.repeats_allowed,
        valid_until: latest.valid_until ?? "",
        notes: latest.notes ?? "",
      });
      setSigName((s) => s || latest.signature_name || latest.prescriber_name || "");
    } else {
      const d = (defaults.data ?? {}) as {
        prescriber_name?: string;
        prescriber_reg_body?: string;
        prescriber_reg_number?: string;
        clinic_name?: string;
        clinic_address?: string;
      };
      const prescriberName = d.prescriber_name || "";
      setForm((f) => ({
        ...f,
        patient_name: (patient.patient_name as string) || (client?.full_name as string) || "",
        patient_dob: (patient.patient_dob as string) || (client?.date_of_birth as string) || "",
        patient_address: (patient.patient_address as string) || (client?.address as string) || "",
        prescriber_name: f.prescriber_name || prescriberName,
        prescriber_reg_body: f.prescriber_reg_body || d.prescriber_reg_body || "",
        prescriber_reg_number: f.prescriber_reg_number || d.prescriber_reg_number || "",
        clinic_name: f.clinic_name || d.clinic_name || "",
        clinic_address: f.clinic_address || d.clinic_address || "",
      }));
      setSigName((s) => s || prescriberName);

    }
  }, [latest, patient, client, defaults.data]);

  const signed = latest?.status === "signed";

  async function onSave() {
    try {
      const payload = {
        ...form,
        referral_id: referralId,
        patient_dob: form.patient_dob || null,
        valid_until: form.valid_until || null,
      };

      const res = await save({ data: payload });
      setForm((f) => ({ ...f, id: res.id }));
      toast.success("Prescription saved");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function onSign() {
    const name = (sigName || form.prescriber_name).trim();
    if (!name) { toast.error("Type your full name to sign"); return; }
    // A UK private Rx PDF must carry the patient's full details. Block signing
    // if any of the legally-required identifiers are missing so the prescriber
    // completes them here rather than a blank field ending up on the PDF.
    const missing: string[] = [];
    if (!form.patient_name.trim()) missing.push("full name");
    if (!form.patient_dob) missing.push("date of birth");
    if (!form.patient_address.trim()) missing.push("address");
    if (missing.length) {
      toast.error(`Patient ${missing.join(", ")} required before signing`);
      return;
    }
    let id = form.id;
    if (!id) {
      try {
        const payload = { ...form, referral_id: referralId, patient_dob: form.patient_dob || null, valid_until: form.valid_until || null };
        const res = await save({ data: payload });
        id = res.id;
        setForm((f) => ({ ...f, id: res.id }));
      } catch (e) { toast.error((e as Error).message); return; }
    }
    if (!id) { toast.error("Save the prescription first"); return; }
    try {
      await sign({ data: { id, signature_name: name, signature_data: `${name} · ${new Date().toISOString()}` } });
      toast.success("Prescription signed & sent to practitioner");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }


  return (
    <div className="space-y-3 text-xs">
      {!signed && (
        <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/40 p-2">
          <TemplatePicker onPick={(t) => setForm((f) => ({
            ...f,
            drug_name: t.drug_name ?? f.drug_name,
            drug_form: t.drug_form ?? f.drug_form,
            drug_strength: t.drug_strength ?? f.drug_strength,
            dose: t.dose ?? f.dose,
            quantity: t.quantity ?? f.quantity,
            directions: t.directions ?? f.directions,
            repeats_allowed: t.repeats_allowed ?? f.repeats_allowed,
            valid_until: t.validity_days ? new Date(Date.now() + t.validity_days * 86400000).toISOString().slice(0, 10) : f.valid_until,
            notes: t.notes ?? f.notes,
          }))} />
          <SnippetPicker onPick={(text) => setForm((f) => ({ ...f, directions: f.directions ? `${f.directions}\n${text}` : text }))} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Patient name" v={form.patient_name} on={(v) => setForm({ ...form, patient_name: v })} disabled={signed} />
        <Field label="Date of birth" type="date" v={form.patient_dob} on={(v) => setForm({ ...form, patient_dob: v })} disabled={signed} />
        <Field label="Patient address" v={form.patient_address} on={(v) => setForm({ ...form, patient_address: v })} disabled={signed} className="sm:col-span-2" />
        <Field label="Prescriber full name" v={form.prescriber_name} on={(v) => setForm({ ...form, prescriber_name: v })} disabled={signed} />
        <Field label="Regulatory body (e.g. GMC, NMC, GPhC)" v={form.prescriber_reg_body} on={(v) => setForm({ ...form, prescriber_reg_body: v })} disabled={signed} />
        <Field label="Registration number" v={form.prescriber_reg_number} on={(v) => setForm({ ...form, prescriber_reg_number: v })} disabled={signed} />
        <Field label="Clinic / letterhead" v={form.clinic_name} on={(v) => setForm({ ...form, clinic_name: v })} disabled={signed} />
        <Field label="Clinic address" v={form.clinic_address} on={(v) => setForm({ ...form, clinic_address: v })} disabled={signed} className="sm:col-span-2" />
      </div>
      <div className="rounded border bg-background p-2">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">POM — Prescription (UK guidelines)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Drug name" v={form.drug_name} on={(v) => setForm({ ...form, drug_name: v })} disabled={signed} />
          <Field label="Form (e.g. solution)" v={form.drug_form} on={(v) => setForm({ ...form, drug_form: v })} disabled={signed} />
          <Field label="Strength" v={form.drug_strength} on={(v) => setForm({ ...form, drug_strength: v })} disabled={signed} />
          <Field label="Dose" v={form.dose} on={(v) => setForm({ ...form, dose: v })} disabled={signed} />
          <Field label="Quantity" v={form.quantity} on={(v) => setForm({ ...form, quantity: v })} disabled={signed} />
          <Field label="Repeats allowed" type="number" v={String(form.repeats_allowed)} on={(v) => setForm({ ...form, repeats_allowed: Math.max(0, Number(v) || 0) })} disabled={signed} />
          <Field label="Valid until" type="date" v={form.valid_until} on={(v) => setForm({ ...form, valid_until: v })} disabled={signed} />
        </div>
        <div className="mt-2">
          <Label className="text-[11px]">Directions for use</Label>
          <Textarea rows={2} value={form.directions} onChange={(e) => setForm({ ...form, directions: e.target.value })} disabled={signed} />
        </div>
        <div className="mt-2">
          <Label className="text-[11px]">Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={signed} />
        </div>
      </div>

      {signed ? (
        <div className="space-y-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-emerald-900">
          <p>
            ✓ Signed by <strong>{latest?.signature_name}</strong> on{" "}
            {new Date(latest!.signed_at!).toLocaleString()}. Sent to practitioner & filed to patient record.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { downloadPrescriptionPdf } = await import("@/lib/prescription-pdf");
              downloadPrescriptionPdf(
                { ...form, signature_name: latest?.signature_name, signed_at: latest?.signed_at },
                `Rx-${form.patient_name.replace(/\s+/g, "_")}.pdf`,
              );
            }}
          >
            Download PDF
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-[11px]">Type your full name to sign</Label>
              <Input value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder="Dr Jane Smith" />
            </div>
            <Button size="sm" variant="outline" onClick={onSave}>Save draft</Button>
            <Button size="sm" onClick={onSign}><PenLine className="mr-1 h-4 w-4" /> Sign & send</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------- Care plan editor ---------------------- */
function CarePlanEditor({ referralId }: { referralId: string }) {
  const get = useServerFn(getCarePlanForReferral);
  const save = useServerFn(saveCarePlan);
  const send = useServerFn(sendCarePlan);
  const q = useQuery({ queryKey: ["careplan", referralId], queryFn: () => get({ data: { referral_id: referralId } }) });
  const row = q.data as { id: string; assessment: string | null; notes: string | null; plan: string | null; follow_up: string | null; status: string; sent_at: string | null } | null;
  const [form, setForm] = useState({ id: undefined as string | undefined, assessment: "", notes: "", plan: "", follow_up: "" });
  useEffect(() => {
    if (row) setForm({ id: row.id, assessment: row.assessment ?? "", notes: row.notes ?? "", plan: row.plan ?? "", follow_up: row.follow_up ?? "" });
  }, [row]);

  async function onSave() {
    try {
      const res = await save({ data: { ...form, referral_id: referralId } });
      setForm((f) => ({ ...f, id: res.id }));
      toast.success("Care plan saved");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function onSend() {
    if (!form.id) { await onSave(); }
    const id = form.id;
    if (!id) return;
    try {
      await send({ data: { id } });
      toast.success("Care plan sent to practitioner");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  const sent = row?.status === "sent";

  return (
    <div className="space-y-2 text-xs">
      <div>
        <Label className="text-[11px]">Assessment</Label>
        <Textarea rows={3} value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} placeholder="Clinical assessment…" />
      </div>
      <div>
        <Label className="text-[11px]">Plan</Label>
        <Textarea rows={3} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="Treatment plan, products, doses…" />
      </div>
      <div>
        <Label className="text-[11px]">Notes for practitioner</Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything the practitioner should know before treating…" />
      </div>
      <div>
        <Label className="text-[11px]">Follow-up</Label>
        <Textarea rows={2} value={form.follow_up} onChange={(e) => setForm({ ...form, follow_up: e.target.value })} placeholder="Review timing, monitoring…" />
      </div>
      {sent ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-emerald-900">
          ✓ Sent to practitioner on {new Date(row!.sent_at!).toLocaleString()}.
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onSave}>Save</Button>
          <Button size="sm" onClick={onSend}><Send className="mr-1 h-4 w-4" /> Send to practitioner</Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, v, on, type = "text", disabled, className }: { label: string; v: string; on: (v: string) => void; type?: string; disabled?: boolean; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-[11px]">{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} disabled={disabled} />
    </div>
  );
}


type RxTemplate = Awaited<ReturnType<typeof listMyRxTemplates>>[number];
type Snippet = Awaited<ReturnType<typeof listMySnippets>>[number];

function SendWalkInButton({ id }: { id: string }) {
  const send = useServerFn(sendWalkInToPractitioner);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="flex justify-end">
      <Button
        size="sm"
        variant="outline"
        disabled={busy || sent}
        className="h-auto w-full justify-center py-2 sm:w-auto"
        onClick={async () => {
          try {
            setBusy(true);
            await send({ data: { id } });
            toast.success("Sent to practitioner to close");
            setSent(true);
          } catch (e) { toast.error((e as Error).message); }
          finally { setBusy(false); }
        }}
      >
        <Send className="mr-1 h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{sent ? "Sent to practitioner" : "Send to practitioner to close"}</span>
        <span className="sm:hidden">{sent ? "Sent" : "Send to practitioner"}</span>
      </Button>
    </div>
  );
}

function TemplatePicker({ onPick }: { onPick: (t: Partial<RxTemplate>) => void }) {
  const fetchFn = useServerFn(listMyRxTemplates);
  const q = useQuery({ queryKey: ["rx-templates"], queryFn: () => fetchFn() });
  const mine = (q.data ?? []) as RxTemplate[];
  const categories = Array.from(new Set(AESTHETICS_MEDICATIONS.map((m) => m.category)));

  function handlePick(value: string) {
    if (value.startsWith("mine:")) {
      const t = mine.find((x) => x.id === value.slice(5));
      if (t) onPick(t);
      return;
    }
    if (value.startsWith("preset:")) {
      const p = AESTHETICS_MEDICATIONS.find((x) => x.id === value.slice(7));
      if (p) onPick(p);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Label className="text-[11px] text-muted-foreground">Load medication</Label>
      <Select onValueChange={handlePick}>
        <SelectTrigger className="h-8 w-64 text-xs"><SelectValue placeholder="Choose a preset or template…" /></SelectTrigger>
        <SelectContent className="max-h-80">
          {mine.length > 0 && (
            <>
              <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">My templates</div>
              {mine.map((t) => <SelectItem key={t.id} value={`mine:${t.id}`}>{t.label}</SelectItem>)}
              <div className="my-1 border-t" />
            </>
          )}
          {categories.map((cat) => (
            <div key={cat}>
              <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</div>
              {AESTHETICS_MEDICATIONS.filter((m) => m.category === cat).map((m) => (
                <SelectItem key={m.id} value={`preset:${m.id}`}>{m.label}</SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SnippetPicker({ onPick }: { onPick: (text: string) => void }) {
  const fetchFn = useServerFn(listMySnippets);
  const q = useQuery({ queryKey: ["rx-snippets"], queryFn: () => fetchFn() });
  const list = (q.data ?? []) as Snippet[];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 text-xs"><ClipboardList className="mr-1 h-3 w-3" /> Insert direction</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {list.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">No snippets. Create some in Directions library.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full rounded p-2 text-left text-xs hover:bg-muted"
                onClick={() => onPick(s.body)}
              >
                <p className="font-medium">{s.label}</p>
                <p className="line-clamp-2 text-muted-foreground">{s.body}</p>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
