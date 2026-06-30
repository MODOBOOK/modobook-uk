import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSentReferrals } from "@/lib/prescriber.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/referrals")({
  ssr: false,
  component: SentReferrals,
});

type Row = Awaited<ReturnType<typeof listSentReferrals>>[number];

function SentReferrals() {
  const fetchFn = useServerFn(listSentReferrals);
  const q = useQuery({ queryKey: ["sent-referrals"], queryFn: () => fetchFn() });
  const rows = (q.data ?? []) as Row[];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="font-serif text-2xl">Prescriber referrals</h1>
        <p className="text-sm text-muted-foreground">
          Referrals sent to prescribers for treatments that need sign-off. The prescriber sees the full record once they accept.
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && rows.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No referrals yet.</CardContent></Card>
      )}

      <div className="space-y-3">
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
      </div>
    </div>
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
