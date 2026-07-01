import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Search, Ban, ExternalLink, Pill } from "lucide-react";
import { listMyPrescriptions, setPrescriptionStatus } from "@/lib/prescriber-library.functions";

export const Route = createFileRoute("/_authenticated/prescriber/library")({
  ssr: false,
  component: PrescriptionLibrary,
});

type Filter = "all" | "signed" | "draft" | "cancelled" | "expired";

function PrescriptionLibrary() {
  const fetchList = useServerFn(listMyPrescriptions);
  const setStatus = useServerFn(setPrescriptionStatus);
  const q = useQuery({ queryKey: ["prescriber-library"], queryFn: () => fetchList() });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const items = q.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((r) => {
      const expired = r.valid_until && r.valid_until < today;
      const effectiveStatus =
        filter === "expired" ? (expired ? "expired" : null) : r.status;
      if (filter !== "all" && effectiveStatus !== filter) return false;
      if (!s) return true;
      return (
        (r.drug_name ?? "").toLowerCase().includes(s) ||
        (r.patient_name ?? "").toLowerCase().includes(s) ||
        (r.practitioner_clinic_name ?? "").toLowerCase().includes(s)
      );
    });
  }, [items, search, filter, today]);

  const totals = useMemo(() => {
    const signed = items.filter((r) => r.status === "signed").length;
    const draft = items.filter((r) => r.status === "draft").length;
    const cancelled = items.filter((r) => r.status === "cancelled").length;
    return { signed, draft, cancelled, all: items.length };
  }, [items]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl">Prescription library</h2>
        <p className="text-sm text-muted-foreground">
          Every prescription you've drafted or signed, searchable and re-downloadable.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={totals.all} />
        <StatCard label="Signed" value={totals.signed} tone="emerald" />
        <StatCard label="Draft" value={totals.draft} tone="amber" />
        <StatCard label="Cancelled" value={totals.cancelled} tone="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search drug, patient, clinic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {q.isLoading && (
        <p className="text-sm text-muted-foreground">Loading prescriptions…</p>
      )}

      {!q.isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Pill className="mx-auto mb-3 h-8 w-8 opacity-60" />
            {items.length === 0
              ? "You haven't signed any prescriptions yet. Accepted referrals with an Rx will appear here."
              : "No prescriptions match those filters."}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((r) => {
          const expired = r.valid_until && r.valid_until < today;
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {r.drug_name ?? "—"}
                      {r.drug_strength ? ` · ${r.drug_strength}` : ""}
                      {r.drug_form ? ` (${r.drug_form})` : ""}
                    </p>
                    <StatusBadge status={r.status} expired={!!expired} />
                    {r.rx_type && (
                      <Badge variant="outline" className="text-[10px]">
                        {r.rx_type.toUpperCase()}
                      </Badge>
                    )}
                    {(r.repeats_allowed ?? 0) > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {r.repeats_allowed} repeats
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{r.patient_name ?? "Patient"}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · for {r.practitioner_clinic_name}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {r.dose && <span>Dose: {r.dose}</span>}
                    {r.quantity && <span>Qty: {r.quantity}</span>}
                    {r.signed_at && (
                      <span>Signed: {new Date(r.signed_at).toLocaleDateString()}</span>
                    )}
                    {r.valid_until && (
                      <span>Valid until: {new Date(r.valid_until).toLocaleDateString()}</span>
                    )}
                  </div>
                  {r.directions && (
                    <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
                      "{r.directions}"
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        PDF
                        <ExternalLink className="ml-1 h-3 w-3 opacity-60" />
                      </Button>
                    </a>
                  )}
                  {r.status === "signed" && !expired && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Cancel this prescription? This action is auditable."))
                          return;
                        try {
                          await setStatus({ data: { id: r.id, status: "cancelled" } });
                          toast.success("Prescription cancelled");
                          q.refetch();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "rose"
          ? "text-rose-700"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 font-serif text-2xl ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, expired }: { status: string | null; expired: boolean }) {
  if (expired) return <Badge className="bg-slate-500">Expired</Badge>;
  switch (status) {
    case "signed":
      return <Badge className="bg-emerald-600">Signed</Badge>;
    case "draft":
      return <Badge className="bg-amber-500">Draft</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status ?? "—"}</Badge>;
  }
}
