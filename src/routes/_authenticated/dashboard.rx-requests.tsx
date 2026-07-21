import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listMyRxRequests, type RxStatus } from "@/lib/rx-requests.functions";
import { Plus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/rx-requests")({
  head: () => ({ meta: [{ title: "Prescription requests | MODO" }] }),
  component: MyRxRequests,
});

function StatusBadge({ status }: { status: RxStatus }) {
  const map: Record<RxStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
    awaiting_info: { label: "Awaiting info", cls: "bg-blue-100 text-blue-800" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
    declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
    withdrawn: { label: "Withdrawn", cls: "bg-neutral-200 text-neutral-700" },
  };
  const m = map[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function MyRxRequests() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listMyRxRequests);
  const [tab, setTab] = useState<RxStatus | "all">("all");
  const q = useQuery({
    queryKey: ["rx-mine", tab],
    queryFn: () => fetchList({ data: { role: "practitioner", status: tab } }),
  });
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prescription requests</h1>
          <p className="text-muted-foreground text-sm">Request scripts from your linked prescribers — no WhatsApp.</p>
        </div>
        <Button onClick={() => navigate({ to: "/dashboard/rx-requests/new" })} className="self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-1" /> New request
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as RxStatus | "all")}>
            <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="awaiting_info">Awaiting info</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="declined">Declined</TabsTrigger>
              <TabsTrigger value="withdrawn">Withdrawn</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {q.isLoading ? (
                <div className="text-muted-foreground">Loading…</div>
              ) : (q.data ?? []).length === 0 ? (
                <div className="text-muted-foreground text-sm py-6 text-center">Nothing here yet.</div>
              ) : (
                <ul className="divide-y">
                  {(q.data ?? []).map((r) => {
                    const snap = (r.patient_snapshot ?? {}) as { full_name?: string };
                    return (
                      <li key={r.id}>
                        <Link
                          to="/prescriber/requests/$id"
                          params={{ id: r.id }}
                          className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40 rounded px-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.treatment_name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {snap.full_name ?? "Patient"} • to {r.partner_name} • {new Date(r.created_at).toLocaleString()}
                            </div>
                          </div>
                          <StatusBadge status={r.status as RxStatus} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
