import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableMultiPicker } from "@/components/ui/searchable-multi-picker";
import { toast } from "sonner";
import { Loader2, FileText, FileSignature, HeartPulse, Sparkles, Search } from "lucide-react";
import { listFormAllocation } from "@/lib/form-allocation.functions";
import { setTreatmentFormIds } from "@/lib/medical-forms.functions";
import { setTreatmentConsents } from "@/lib/treatment-consents.functions";
import { setTreatmentAftercareIds } from "@/lib/aftercare-templates.functions";
import { suggestFormMatches, commitFormMatches } from "@/lib/ai-forms.functions";

export const Route = createFileRoute("/_authenticated/dashboard/form-allocation")({
  head: () => ({ meta: [{ title: "Attach forms — MODO" }] }),
  component: FormAllocationPage,
});

type Links = { medical: string[]; consent: string[]; aftercare: string[] };

function FormAllocationPage() {
  const load = useServerFn(listFormAllocation);
  const setMed = useServerFn(setTreatmentFormIds);
  const setCons = useServerFn(setTreatmentConsents);
  const setAft = useServerFn(setTreatmentAftercareIds);
  const suggest = useServerFn(suggestFormMatches);

  const query = useQuery({ queryKey: ["form-allocation"], queryFn: () => load() });
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [local, setLocal] = useState<Record<string, Links>>({});

  const data = query.data;
  const rows = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    return data.treatments.filter((t) => !s || t.name.toLowerCase().includes(s));
  }, [data, search]);

  function currentLinks(tid: string): Links {
    return local[tid] ?? data?.links[tid] ?? { medical: [], consent: [], aftercare: [] };
  }

  function toggle(tid: string, kind: keyof Links, id: string) {
    setLocal((prev) => {
      const cur = prev[tid] ?? currentLinks(tid);
      const has = cur[kind].includes(id);
      const next = has ? cur[kind].filter((x) => x !== id) : [...cur[kind], id];
      return { ...prev, [tid]: { ...cur, [kind]: next } };
    });
  }

  async function saveRow(tid: string) {
    const cur = currentLinks(tid);
    setSavingRow(tid);
    try {
      await Promise.all([
        setMed({ data: { treatment_id: tid, template_ids: cur.medical } }),
        setCons({ data: { treatmentId: tid, consentTemplateIds: cur.consent } }),
        setAft({ data: { treatment_id: tid, template_ids: cur.aftercare } }),
      ]);
      toast.success("Saved");
      await query.refetch();
      setLocal((prev) => {
        const { [tid]: _drop, ...rest } = prev;
        return rest;
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingRow(null);
    }
  }

  async function runAi(mode: "merge" | "replace") {
    if (!data) return;
    setAiBusy(true);
    try {
      const r = await suggest({ data: {} });
      const staged: Record<string, Links> = {};
      for (const t of data.treatments) {
        const existing = data.links[t.id] ?? { medical: [], consent: [], aftercare: [] };
        const m = r.matches.find((x) => x.treatment_id === t.id);
        const suggMed = m?.medical_form_ids ?? [];
        const suggCon = m?.consent_ids ?? [];
        const suggAft = m?.aftercare_ids ?? [];
        const next: Links =
          mode === "replace"
            ? { medical: suggMed, consent: suggCon, aftercare: suggAft }
            : {
                medical: Array.from(new Set([...existing.medical, ...suggMed])),
                consent: Array.from(new Set([...existing.consent, ...suggCon])),
                aftercare: Array.from(new Set([...existing.aftercare, ...suggAft])),
              };
        // Only stage if actually different from what's saved
        const same =
          next.medical.length === existing.medical.length &&
          next.medical.every((x) => existing.medical.includes(x)) &&
          next.consent.length === existing.consent.length &&
          next.consent.every((x) => existing.consent.includes(x)) &&
          next.aftercare.length === existing.aftercare.length &&
          next.aftercare.every((x) => existing.aftercare.includes(x));
        if (!same) staged[t.id] = next;
      }
      setLocal((prev) => ({ ...prev, ...staged }));
      const count = Object.keys(staged).length;
      if (count === 0) {
        toast.info("AI had nothing new to suggest.");
      } else {
        toast.success(`AI staged changes for ${count} treatment${count === 1 ? "" : "s"}. Review, then Save all.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  async function saveAll() {
    const entries = Object.entries(local);
    if (entries.length === 0) return;
    setSavingAll(true);
    try {
      for (const [tid, cur] of entries) {
        await Promise.all([
          setMed({ data: { treatment_id: tid, template_ids: cur.medical } }),
          setCons({ data: { treatmentId: tid, consentTemplateIds: cur.consent } }),
          setAft({ data: { treatment_id: tid, template_ids: cur.aftercare } }),
        ]);
      }
      toast.success(`Saved ${entries.length} treatment${entries.length === 1 ? "" : "s"}`);
      await query.refetch();
      setLocal({});
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingAll(false);
    }
  }

  if (query.isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Attach forms to treatments</h1>
        <p className="text-sm text-muted-foreground">
          Everything you tick here is automatically sent to the patient on booking — medical intake, consent, and aftercare.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" /> Auto-match with AI
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Let AI suggest the right forms for every treatment in one go.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => runAi("merge")} disabled={aiBusy}>
              {aiBusy ? <Loader2 className="size-4 animate-spin" /> : "Add missing"}
            </Button>
            <Button variant="secondary" onClick={() => runAi("replace")} disabled={aiBusy}>
              Replace all
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search treatments…"
          className="pl-9"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No treatments yet. Add treatments first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const cur = currentLinks(t.id);
            const dirty = !!local[t.id];
            return (
              <Card key={t.id} className={dirty ? "border-primary/60" : ""}>
                <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <Badge variant="secondary" className="gap-1">
                        <FileText className="size-3" /> {cur.medical.length} medical
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <FileSignature className="size-3" /> {cur.consent.length} consent
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <HeartPulse className="size-3" /> {cur.aftercare.length} aftercare
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveRow(t.id)}
                    disabled={!dirty || savingRow === t.id}
                  >
                    {savingRow === t.id ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FileText className="size-3.5" /> Medical intake
                    </div>
                    <SearchableMultiPicker
                      label=""
                      hideLabel
                      emptyMessage="No medical forms yet."
                      placeholder="Attach medical form…"
                      items={data.medicalForms.map((m) => ({ id: m.id, name: m.name, hint: m.is_system ? "System" : undefined }))}
                      selected={cur.medical}
                      onToggle={(id) => toggle(t.id, "medical", id)}
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FileSignature className="size-3.5" /> Consent
                    </div>
                    <SearchableMultiPicker
                      label=""
                      hideLabel
                      emptyMessage="No consent forms yet."
                      placeholder="Attach consent…"
                      items={data.consents.map((c) => ({ id: c.id, name: c.name, hint: c.is_system ? "System" : undefined }))}
                      selected={cur.consent}
                      onToggle={(id) => toggle(t.id, "consent", id)}
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <HeartPulse className="size-3.5" /> Aftercare
                    </div>
                    <SearchableMultiPicker
                      label=""
                      hideLabel
                      emptyMessage="No aftercare templates yet."
                      placeholder="Attach aftercare…"
                      items={data.aftercares.map((a) => ({ id: a.id, name: a.name, hint: `${a.delay_hours}h after` }))}
                      selected={cur.aftercare}
                      onToggle={(id) => toggle(t.id, "aftercare", id)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
