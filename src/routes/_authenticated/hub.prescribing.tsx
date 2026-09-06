import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listMyConnectedPrescribers,
  listMyTreatmentsForPrescribing,
  saveTreatmentPrescriberSettings,
} from "@/lib/prescriber.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ChevronDown, Search, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hub/prescribing")({
  ssr: false,
  component: HubPrescribing,
});

type Treat = Awaited<ReturnType<typeof listMyTreatmentsForPrescribing>>[number];
type Prescriber = Awaited<ReturnType<typeof listMyConnectedPrescribers>>[number];

function HubPrescribing() {
  const fetchTreatments = useServerFn(listMyTreatmentsForPrescribing);
  const fetchPrescribers = useServerFn(listMyConnectedPrescribers);
  const save = useServerFn(saveTreatmentPrescriberSettings);

  const treatments = useQuery({ queryKey: ["hub-treatments"], queryFn: () => fetchTreatments() });
  const prescribers = useQuery({ queryKey: ["hub-prescribers"], queryFn: () => fetchPrescribers() });

  const list = (treatments.data ?? []) as Treat[];
  const presList = (prescribers.data ?? []) as Prescriber[];

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q));
  }, [list, query]);

  const enabledCount = list.filter((t) => t.requires_prescriber).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl">Prescribing rules</h2>
        <p className="text-sm text-muted-foreground">
          Tap a service to choose whether it needs a prescriber, who reviews it, and how the patient is seen.
        </p>
      </div>

      {presList.length === 0 && (
        <Card className="border-amber-300/60 bg-amber-50/40">
          <CardContent className="p-4 text-sm">
            You aren't connected to any approved prescribers yet.{" "}
            <Link to="/hub/connections" className="font-medium underline">
              Send a connection request
            </Link>{" "}
            using their MODO code, or ask them to sign up as a prescriber.
          </CardContent>
        </Card>
      )}

      {list.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services…"
              className="pl-9"
            />
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {enabledCount} need prescriber
          </span>
        </div>
      )}

      {treatments.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!treatments.isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {query ? `No services match “${query}”.` : "No services found."}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((t) => (
          <Row
            key={t.id}
            treatment={t}
            prescribers={presList}
            open={openId === t.id}
            onToggle={() => setOpenId(openId === t.id ? null : t.id)}
            onSave={async (payload) => {
              await save({ data: payload });
              toast.success("Saved");
              setOpenId(null);
              treatments.refetch();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  treatment,
  prescribers,
  open,
  onToggle,
  onSave,
}: {
  treatment: Treat;
  prescribers: Prescriber[];
  open: boolean;
  onToggle: () => void;
  onSave: (p: {
    treatment_id: string;
    requires_prescriber: boolean;
    prescriber_user_id: string | null;
    prescriber_routing: "same_address" | "clinic_visit";
    prescriber_note: string | null;
  }) => Promise<void>;
}) {
  const [req, setReq] = useState(Boolean(treatment.requires_prescriber));
  const [prescriberId, setPrescriberId] = useState<string | "">(treatment.prescriber_user_id ?? "");
  const initialRouting = (() => {
    const r = treatment.prescriber_routing as string | null;
    if (r === "in_person_consult" || r === "clinic_visit") return "clinic_visit" as const;
    return "same_address" as const;
  })();
  const [routing, setRouting] = useState<"same_address" | "clinic_visit">(initialRouting);

  const [note, setNote] = useState(treatment.prescriber_note ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    req !== Boolean(treatment.requires_prescriber) ||
    (prescriberId || null) !== (treatment.prescriber_user_id ?? null) ||
    routing !== initialRouting ||
    note !== (treatment.prescriber_note ?? "");

  const assignedName = prescribers.find((p) => p.user_id === treatment.prescriber_user_id)?.name;

  return (
    <Card className={cn("transition", open && "border-primary/40")}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              treatment.requires_prescriber ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{treatment.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {!treatment.active && "Inactive · "}
              {treatment.requires_prescriber
                ? `Prescriber required${assignedName ? ` · ${assignedName}` : ""}`
                : "No prescriber needed"}
            </span>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>

        {open && (
          <div className="space-y-4 border-t px-4 py-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/40 px-3 py-2.5">
              <Label className="text-sm font-medium">Needs a prescriber</Label>
              <Switch checked={req} onCheckedChange={setReq} />
            </div>

            {req && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                    Assigned prescriber
                  </Label>
                  <Select value={prescriberId} onValueChange={(v) => setPrescriberId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a prescriber" />
                    </SelectTrigger>
                    <SelectContent>
                      {prescribers.map((p) => {
                        const fees = [
                          p.fee_per_prescription_pence != null ? `£${(p.fee_per_prescription_pence / 100).toFixed(0)}/script` : null,
                          p.fee_per_consult_pence != null ? `£${(p.fee_per_consult_pence / 100).toFixed(0)}/consult` : null,
                        ].filter(Boolean).join(" · ");
                        return (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.name}
                            {p.regulatory_body ? ` · ${p.regulatory_body}` : ""}
                            {fees ? ` — ${fees}` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {prescriberId && (() => {
                    const sel = prescribers.find((p) => p.user_id === prescriberId);
                    if (!sel) return null;
                    const fees = [
                      sel.fee_per_prescription_pence != null ? `£${(sel.fee_per_prescription_pence / 100).toFixed(0)} per prescription` : null,
                      sel.fee_per_consult_pence != null ? `£${(sel.fee_per_consult_pence / 100).toFixed(0)} per consult` : null,
                    ].filter(Boolean);
                    if (!fees.length && !sel.fee_notes) return null;
                    return (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {fees.join(" · ")}
                        {sel.fee_notes ? `${fees.length ? " — " : ""}${sel.fee_notes}` : ""}
                      </p>
                    );
                  })()}
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                    Routing
                  </Label>
                  <RadioGroup
                    value={routing}
                    onValueChange={(v) => setRouting(v as "same_address" | "clinic_visit")}
                  >
                    <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <RadioGroupItem value="same_address" className="mt-0.5" />
                      <span>
                        <span className="font-medium">Same address</span> — no extra booking. Prescriber
                        is on-site and reviews the case before the appointment.
                      </span>
                    </label>
                    <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <RadioGroupItem value="clinic_visit" className="mt-0.5" />
                      <span>
                        <span className="font-medium">Clinic visit days</span> — patient picks a day the
                        prescriber will be visiting your clinic.{" "}
                        <Link to="/hub/visits" className="underline">Manage visit days</Link>.
                      </span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                    Note shown to patient at consent step (optional)
                  </Label>
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. The prescriber will review your medical history before approving this treatment."
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              {req && !prescriberId && (
                <p className="mr-auto text-xs text-destructive">Pick a prescriber to enable this.</p>
              )}
              <Button
                size="sm"
                disabled={!dirty || saving || (req && !prescriberId)}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave({
                      treatment_id: treatment.id,
                      requires_prescriber: req,
                      prescriber_user_id: req ? prescriberId || null : null,
                      prescriber_routing: routing,
                      prescriber_note: note.trim() || null,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
