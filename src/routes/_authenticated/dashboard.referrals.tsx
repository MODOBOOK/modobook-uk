import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSentReferrals } from "@/lib/prescriber.functions";
import { listWalkInsAwaitingClose, closeWalkInAsPractitioner } from "@/lib/prescriber-directions.functions";
import { getReferralAttachments } from "@/lib/prescriptions.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/referrals")({
  ssr: false,
  component: SentReferrals,
});

type Row = Awaited<ReturnType<typeof listSentReferrals>>[number];
type WalkIn = Awaited<ReturnType<typeof listWalkInsAwaitingClose>>[number];

function SentReferrals() {
  const fetchFn = useServerFn(listSentReferrals);
  const fetchWalk = useServerFn(listWalkInsAwaitingClose);
  const q = useQuery({ queryKey: ["sent-referrals"], queryFn: () => fetchFn() });
  const wq = useQuery({ queryKey: ["walk-ins"], queryFn: () => fetchWalk() });
  const rows = (q.data ?? []) as Row[];
  const walkIns = (wq.data ?? []) as WalkIn[];
  const awaiting = walkIns.filter((w) => w.awaiting_practitioner_close);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="font-serif text-2xl">Prescriber referrals</h1>
        <p className="text-sm text-muted-foreground">
          Referrals sent to prescribers, plus in-clinic walk-ins waiting for you to close.
        </p>
      </div>

      <Tabs defaultValue={awaiting.length ? "walk_ins" : "sent"}>
        <TabsList>
          <TabsTrigger value="sent">Sent referrals</TabsTrigger>
          <TabsTrigger value="walk_ins">
            Walk-ins {awaiting.length > 0 && <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">{awaiting.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="space-y-3 pt-3">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && rows.length === 0 && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No referrals yet.</CardContent></Card>
          )}
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.patient_name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">· {r.treatment_name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Prescriber: <span className="font-medium text-foreground">{r.prescriber_name}</span>
                    {r.prescriber_regulatory_body ? ` · ${r.prescriber_regulatory_body}` : ""}
                    {r.appointment ? ` · ${r.appointment.scheduled_date} at ${r.appointment.start_time.slice(0,5)}` : ""}
                    {r.routing === "in_person_consult" && <span className="ml-2">· In-person consult</span>}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Sent {new Date(r.created_at).toLocaleString()}
                    {r.accepted_at ? ` · Accepted ${new Date(r.accepted_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="walk_ins" className="space-y-3 pt-3">
          {wq.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!wq.isLoading && walkIns.length === 0 && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No walk-in consultations.</CardContent></Card>
          )}
          {walkIns.map((w) => <WalkInCard key={w.id} w={w} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WalkInCard({ w }: { w: WalkIn }) {
  const qc = useQueryClient();
  const close = useServerFn(closeWalkInAsPractitioner);
  const fetchAttachments = useServerFn(getReferralAttachments);
  const attachQ = useQuery({
    queryKey: ["referral-attachments", w.id],
    queryFn: () => fetchAttachments({ data: { referral_id: w.id } }),
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const awaiting = w.awaiting_practitioner_close;
  const prescriptions = (attachQ.data?.prescriptions ?? []) as Array<{
    id: string; drug_name: string; drug_strength?: string | null; dose: string;
    directions: string; quantity: string; status: string; signed_at?: string | null;
    prescriber_name?: string | null; pdf_url?: string | null;
  }>;
  const carePlan = attachQ.data?.care_plan as { assessment?: string | null; plan?: string | null; notes?: string | null; follow_up?: string | null } | null | undefined;

  return (
    <Card className={awaiting ? "border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{w.patient_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Walk-in with <span className="font-medium text-foreground">{w.prescriber_name}</span>
              {" · "}{new Date(w.created_at).toLocaleString()}
            </p>
            {w.walk_in_note && <p className="mt-2 whitespace-pre-wrap rounded border bg-background p-2 text-sm">{w.walk_in_note}</p>}
            {w.notes && <p className="mt-2 whitespace-pre-wrap rounded border bg-background p-2 text-sm text-muted-foreground">{w.notes}</p>}
          </div>
          <Badge variant={awaiting ? "secondary" : "outline"}>
            {awaiting ? "Awaiting close" : w.status === "completed" ? "Closed" : "In progress"}
          </Badge>
        </div>

        {prescriptions.length > 0 && (
          <div className="space-y-2 rounded border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prescriptions from prescriber ({prescriptions.length})
            </p>
            {prescriptions.map((p) => (
              <div key={p.id} className="rounded border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {p.drug_name}{p.drug_strength ? ` ${p.drug_strength}` : ""}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Qty {p.quantity}</span>
                  </p>
                  <Badge variant={p.status === "signed" ? "default" : "outline"} className="text-[10px]">
                    {p.status === "signed" ? "Signed" : p.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Dose: {p.dose}</p>
                <p className="text-xs text-muted-foreground">Directions: {p.directions}</p>
                {p.signed_at && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Signed by {p.prescriber_name} · {new Date(p.signed_at).toLocaleString()}
                  </p>
                )}
                {p.pdf_url && (
                  <a href={p.pdf_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <FileText className="h-3 w-3" /> View PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {carePlan && (carePlan.assessment || carePlan.plan || carePlan.notes || carePlan.follow_up) && (
          <div className="space-y-1 rounded border bg-background p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Care plan</p>
            {carePlan.assessment && <p><span className="text-xs text-muted-foreground">Assessment: </span>{carePlan.assessment}</p>}
            {carePlan.plan && <p><span className="text-xs text-muted-foreground">Plan: </span>{carePlan.plan}</p>}
            {carePlan.notes && <p className="whitespace-pre-wrap"><span className="text-xs text-muted-foreground">Notes: </span>{carePlan.notes}</p>}
            {carePlan.follow_up && <p><span className="text-xs text-muted-foreground">Follow-up: </span>{carePlan.follow_up}</p>}
          </div>
        )}

        {awaiting && (
          <div className="space-y-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional close note…" />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  try {
                    setBusy(true);
                    await close({ data: { id: w.id, note } });
                    toast.success("Walk-in closed");
                    qc.invalidateQueries({ queryKey: ["walk-ins"] });
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setBusy(false); }
                }}
              ><CheckCircle2 className="mr-1 h-4 w-4" />Close walk-in</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map: Record<Row["status"], { v: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { v: "secondary", label: "Awaiting prescriber" },
    accepted: { v: "default", label: "Accepted" },
    declined: { v: "destructive", label: "Declined" },
    completed: { v: "outline", label: "Completed" },
  };
  const m = map[status];
  return <Badge variant={m.v}>{m.label}</Badge>;
}
