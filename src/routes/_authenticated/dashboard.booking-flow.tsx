import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import {
  listMyConcernData,
  createConcernArea,
  updateConcernArea,
  deleteConcernArea,
  createConcern,
  updateConcern,
  deleteConcern,
  setConcernTreatments,
} from "@/lib/chooser.functions";
import { suggestConcernMatches, suggestConcernsFromTreatments, type SuggestedConcern } from "@/lib/ai-concerns.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { SaveReminder } from "@/components/SaveReminder";


export const Route = createFileRoute("/_authenticated/dashboard/booking-flow")({
  ssr: false,
  loader: async () => {
    const [profile, treatments, chooser] = await Promise.all([
      getMyProfile(),
      getMyTreatments(),
      listMyConcernData(),
    ]);
    if (!profile) throw new Error("No profile");
    return { profile, treatments, chooser };
  },
  component: BookingFlowPage,
});

type Area = { id: string; name: string; sort_order: number };
type Concern = { id: string; area_id: string; name: string; description: string | null };
type Link = { concern_id: string; treatment_id: string };

function BookingFlowPage() {
  const loaded = Route.useLoaderData();
  const treatments = loaded.treatments as { id: string; name: string; description: string | null; is_consultation?: boolean | null }[];

  const p = loaded.profile as Record<string, unknown>;
  const [enabled, setEnabled] = useState(Boolean(p.chooser_enabled));
  const [showKnow, setShowKnow] = useState(p.chooser_show_know !== false);
  const [showUnsure, setShowUnsure] = useState(p.chooser_show_unsure !== false);
  const [showConsult, setShowConsult] = useState(p.chooser_show_consultation !== false);
  const [consultIds, setConsultIds] = useState<string[]>(() => {
    const saved = Array.isArray(p.chooser_consultation_treatment_ids)
      ? (p.chooser_consultation_treatment_ids as string[]).filter(Boolean)
      : [];
    if (p.chooser_consultation_treatment_id) saved.unshift(p.chooser_consultation_treatment_id as string);
    const uniqueSaved = Array.from(new Set(saved));
    if (uniqueSaved.length > 0) return uniqueSaved;

    // Backfill older/live accounts where the public preview was finding
    // consultations by treatment flag/name, but the chooser array had never
    // been saved. This makes the dashboard and customer page use the same list.
    return treatments
      .filter((t) => t.is_consultation === true || /consult/i.test(t.name ?? ""))
      .map((t) => t.id);
  });
  const [intro, setIntro] = useState<string>((p.chooser_intro_text as string | null) ?? "");
  const [extraOn, setExtraOn] = useState(Boolean(p.chooser_extra_enabled));
  const [extraTitle, setExtraTitle] = useState<string>((p.chooser_extra_title as string | null) ?? "");
  const [extraBody, setExtraBody] = useState<string>((p.chooser_extra_body as string | null) ?? "");
  const [extraIds, setExtraIds] = useState<string[]>(
    Array.isArray(p.chooser_extra_treatment_ids) ? (p.chooser_extra_treatment_ids as string[]) : [],
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const [areas, setAreas] = useState<Area[]>(loaded.chooser.areas as Area[]);
  const [concerns, setConcerns] = useState<Concern[]>(loaded.chooser.concerns as Concern[]);
  const [links, setLinks] = useState<Link[]>(loaded.chooser.links as Link[]);
  const [newAreaName, setNewAreaName] = useState("");
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [expandedConcern, setExpandedConcern] = useState<string | null>(null);

  // AI suggestion review state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<Record<string, Set<string>>>({});
  const [aiOnlyEmpty, setAiOnlyEmpty] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);

  async function runAiSuggest() {
    if (treatments.length === 0) { toast.error("Add treatments first."); return; }
    const targets = aiOnlyEmpty
      ? concerns.filter((c) => !links.some((l) => l.concern_id === c.id))
      : concerns;
    if (targets.length === 0) { toast.info("Nothing to match — every concern already has treatments."); return; }
    setAiLoading(true);
    try {
      const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? null;
      const { matches } = await suggestConcernMatches({
        data: {
          treatments: treatments.map((t) => ({ id: t.id, name: t.name, description: t.description })),
          concerns: targets.map((c) => ({
            id: c.id, name: c.name, description: c.description, area: areaName(c.area_id),
          })),
        },
      });
      const draft: Record<string, Set<string>> = {};
      // Seed with existing links so user can compare/keep
      for (const c of targets) {
        draft[c.id] = new Set(
          links.filter((l) => l.concern_id === c.id).map((l) => l.treatment_id),
        );
      }
      for (const m of matches) {
        const set = draft[m.concern_id] ?? new Set<string>();
        for (const id of m.treatment_ids) set.add(id);
        draft[m.concern_id] = set;
      }
      setAiDraft(draft);
      setAiOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }

  function toggleDraft(concernId: string, treatmentId: string) {
    setAiDraft((prev) => {
      const next = { ...prev };
      const set = new Set(next[concernId] ?? []);
      if (set.has(treatmentId)) set.delete(treatmentId); else set.add(treatmentId);
      next[concernId] = set;
      return next;
    });
  }

  async function applyAiDraft() {
    setAiSaving(true);
    try {
      const entries = Object.entries(aiDraft);
      for (const [concernId, set] of entries) {
        const ids = Array.from(set);
        await setConcernTreatments({ data: { concern_id: concernId, treatment_ids: ids } });
      }
      // Rebuild local links
      setLinks((prev) => {
        const cleared = prev.filter((l) => !aiDraft[l.concern_id]);
        const added: Link[] = [];
        for (const [concernId, set] of entries) {
          for (const tid of set) added.push({ concern_id: concernId, treatment_id: tid });
        }
        return [...cleared, ...added];
      });
      toast.success("AI matches applied");
      setAiOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setAiSaving(false);
    }
  }

  // --- AI: suggest NEW concerns from treatments ---
  type Suggestion = SuggestedConcern & { _selected: boolean; _areaChoice: string };
  const [sugOpen, setSugOpen] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugSaving, setSugSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  async function runAiSuggestConcerns() {
    if (treatments.length === 0) { toast.error("Add treatments first."); return; }
    setSugLoading(true);
    try {
      const { concerns: out } = await suggestConcernsFromTreatments({
        data: {
          treatments: treatments.map((t) => ({ id: t.id, name: t.name, description: t.description })),
          areas: areas.map((a) => ({ id: a.id, name: a.name })),
          existingNames: concerns.map((c) => c.name),
        },
      });
      if (out.length === 0) { toast.info("AI didn't find any new concerns to suggest."); return; }
      setSuggestions(out.map((s) => ({
        ...s,
        _selected: true,
        _areaChoice: s.area_id ?? (areas[0]?.id ?? "__new__"),
      })));
      setSugOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setSugLoading(false);
    }
  }

  function updateSuggestion(idx: number, patch: Partial<Suggestion>) {
    setSuggestions((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function toggleSuggestionTreatment(idx: number, tid: string) {
    setSuggestions((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const set = new Set(s.treatment_ids);
      if (set.has(tid)) set.delete(tid); else set.add(tid);
      return { ...s, treatment_ids: Array.from(set) };
    }));
  }

  async function applySuggestedConcerns() {
    const picked = suggestions.filter((s) => s._selected && s.name.trim() && s.treatment_ids.length > 0);
    if (picked.length === 0) { toast.error("Nothing selected to add."); return; }
    setSugSaving(true);
    try {
      // Cache & resolve area names → ids, creating any new ones on the fly
      const areaByName = new Map(areas.map((a) => [a.name.trim().toLowerCase(), a]));
      let nextAreas = [...areas];
      const newConcerns: Concern[] = [];
      const newLinks: Link[] = [];

      for (const s of picked) {
        let areaId = s._areaChoice;
        if (areaId === "__new__") {
          const proposed = (s.area_name || "General").trim();
          const existing = areaByName.get(proposed.toLowerCase());
          if (existing) {
            areaId = existing.id;
          } else {
            const row = await createConcernArea({ data: { name: proposed, sort_order: nextAreas.length } }) as Area;
            nextAreas.push(row);
            areaByName.set(proposed.toLowerCase(), row);
            areaId = row.id;
          }
        }
        const created = await createConcern({
          data: { area_id: areaId, name: s.name.trim(), description: s.description || undefined },
        }) as Concern;
        newConcerns.push(created);
        await setConcernTreatments({ data: { concern_id: created.id, treatment_ids: s.treatment_ids } });
        for (const tid of s.treatment_ids) newLinks.push({ concern_id: created.id, treatment_id: tid });
      }

      setAreas(nextAreas);
      setConcerns((prev) => [...prev, ...newConcerns]);
      setLinks((prev) => [...prev, ...newLinks]);
      toast.success(`Added ${picked.length} concern${picked.length === 1 ? "" : "s"}`);
      setSugOpen(false);
      setSuggestions([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSugSaving(false);
    }
  }





  function toggleId(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await updateProfile({
        data: {
          id: loaded.profile.id as string,
          chooser_enabled: enabled,
          chooser_show_know: showKnow,
          chooser_show_unsure: showUnsure,
          chooser_show_consultation: showConsult,
          chooser_consultation_treatment_ids: consultIds,
          // Keep the legacy single-ID field only for a genuinely single
          // consultation setup. Multiple consultations are driven by the array.
          chooser_consultation_treatment_id: consultIds.length === 1 ? consultIds[0] : null,
          chooser_intro_text: intro || null,
          chooser_extra_enabled: extraOn,
          chooser_extra_title: extraTitle || null,
          chooser_extra_body: extraBody || null,
          chooser_extra_treatment_ids: extraIds,
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }


  async function addArea() {
    if (!newAreaName.trim()) return;
    const row = await createConcernArea({ data: { name: newAreaName.trim(), sort_order: areas.length } });
    setAreas((a) => [...a, row as Area]);
    setNewAreaName("");
  }

  async function renameArea(id: string, name: string) {
    setAreas((a) => a.map((x) => (x.id === id ? { ...x, name } : x)));
    await updateConcernArea({ data: { id, name } });
  }

  async function removeArea(id: string) {
    if (!confirm("Delete this area and all its concerns?")) return;
    await deleteConcernArea({ data: { id } });
    setAreas((a) => a.filter((x) => x.id !== id));
    setConcerns((c) => c.filter((x) => x.area_id !== id));
  }

  async function addConcern(areaId: string, name: string) {
    if (!name.trim()) return;
    const row = await createConcern({ data: { area_id: areaId, name: name.trim() } });
    setConcerns((c) => [...c, row as Concern]);
  }

  async function renameConcern(id: string, name: string) {
    setConcerns((c) => c.map((x) => (x.id === id ? { ...x, name } : x)));
    await updateConcern({ data: { id, name } });
  }

  async function removeConcern(id: string) {
    if (!confirm("Delete this concern?")) return;
    await deleteConcern({ data: { id } });
    setConcerns((c) => c.filter((x) => x.id !== id));
    setLinks((l) => l.filter((x) => x.concern_id !== id));
  }

  async function toggleLink(concernId: string, treatmentId: string) {
    const exists = links.some((l) => l.concern_id === concernId && l.treatment_id === treatmentId);
    const next = exists
      ? links.filter((l) => !(l.concern_id === concernId && l.treatment_id === treatmentId))
      : [...links, { concern_id: concernId, treatment_id: treatmentId }];
    setLinks(next);
    const ids = next.filter((l) => l.concern_id === concernId).map((l) => l.treatment_id);
    await setConcernTreatments({ data: { concern_id: concernId, treatment_ids: ids } });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Booking flow</h1>
        <p className="text-sm text-muted-foreground">
          Optionally ask patients what they're looking for before showing treatments.
        </p>
      </div>
      <SaveReminder message="Each card has its own Save button at the bottom — remember to tap it after editing." />

      <Card>
        <CardHeader><CardTitle>Picker settings</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <Row label="Enable picker" hint="Show the 3 options after a patient picks a location.">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </Row>
          <Row label='Show "I know what I want"'>
            <Switch checked={showKnow} onCheckedChange={setShowKnow} />
          </Row>
          <Row label={'Show "I\'m unsure what to book"'}>
            <Switch checked={showUnsure} onCheckedChange={setShowUnsure} />
          </Row>
          <Row label='Show "I need a consultation"'>
            <Switch checked={showConsult} onCheckedChange={setShowConsult} />
          </Row>

          {showConsult && (
            <div className="space-y-1.5">
              <Label>Consultation treatments</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border bg-background p-2 space-y-1">
                {treatments.length === 0 ? (
                  <p className="px-2 py-1 text-xs italic text-muted-foreground">Add treatments first.</p>
                ) : treatments.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={consultIds.includes(t.id)}
                      onCheckedChange={() => toggleId(consultIds, setConsultIds, t.id)}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                When patients tap "Book a consultation now" they'll be able to pick from these treatments.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Intro text (optional)</Label>
            <Textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="e.g. Help us point you in the right direction."
              rows={2}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <Row label="Add a highlight section" hint="Show an extra featured group below the picker.">
              <Switch checked={extraOn} onCheckedChange={setExtraOn} />
            </Row>
            {extraOn && (
              <>
                <div className="space-y-1.5">
                  <Label>Section title</Label>
                  <Input value={extraTitle} onChange={(e) => setExtraTitle(e.target.value)} placeholder="e.g. This month's featured" />
                </div>
                <div className="space-y-1.5">
                  <Label>Section description</Label>
                  <Textarea value={extraBody} onChange={(e) => setExtraBody(e.target.value)} rows={2} placeholder="Short blurb shown under the title." />
                </div>
                <div className="space-y-1.5">
                  <Label>Treatments to highlight</Label>
                  <div className="max-h-56 overflow-y-auto rounded-md border bg-background p-2 space-y-1">
                    {treatments.length === 0 ? (
                      <p className="px-2 py-1 text-xs italic text-muted-foreground">Add treatments first.</p>
                    ) : treatments.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                        <Checkbox
                          checked={extraIds.includes(t.id)}
                          onCheckedChange={() => toggleId(extraIds, setExtraIds, t.id)}
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>


          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Concerns &amp; matched treatments</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Group concerns by area (e.g. Face, Body). For each concern, tick the treatments you'd suggest — or let AI draft them for you to review.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0 sm:flex-row">
            <Button size="sm" variant="outline" onClick={runAiSuggestConcerns} disabled={sugLoading}>
              {sugLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Suggest concerns with AI
            </Button>
            <Button size="sm" variant="secondary" onClick={runAiSuggest} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Match treatments with AI
            </Button>
          </div>

        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={aiOnlyEmpty} onCheckedChange={(v) => setAiOnlyEmpty(!!v)} />
            Only suggest for concerns with no treatments yet
          </label>


          <div className="flex gap-2">
            <Input
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder="New area name (e.g. Face)"
              onKeyDown={(e) => { if (e.key === "Enter") addArea(); }}
            />
            <Button onClick={addArea}><Plus className="mr-1 h-4 w-4" /> Add area</Button>
          </div>

          <div className="space-y-3">
            {areas.length === 0 && (
              <p className="text-sm italic text-muted-foreground">No areas yet.</p>
            )}
            {areas.map((area) => {
              const areaConcerns = concerns.filter((c) => c.area_id === area.id);
              const open = expandedArea === area.id;
              return (
                <div key={area.id} className="rounded-xl border bg-card">
                  <div className="flex items-center gap-2 p-3">
                    <button
                      onClick={() => setExpandedArea(open ? null : area.id)}
                      className="text-muted-foreground"
                      aria-label={open ? "Collapse" : "Expand"}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Input
                      value={area.name}
                      onChange={(e) => renameArea(area.id, e.target.value)}
                      className="h-9 flex-1 font-semibold"
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeArea(area.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {open && (
                    <div className="space-y-2 border-t p-3">
                      <NewConcernRow onAdd={(n) => addConcern(area.id, n)} />
                      {areaConcerns.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground">No concerns yet.</p>
                      ) : (
                        areaConcerns.map((c) => {
                          const cOpen = expandedConcern === c.id;
                          const selected = new Set(
                            links.filter((l) => l.concern_id === c.id).map((l) => l.treatment_id),
                          );
                          return (
                            <div key={c.id} className="rounded-lg border bg-background">
                              <div className="flex items-center gap-2 p-2">
                                <button
                                  onClick={() => setExpandedConcern(cOpen ? null : c.id)}
                                  className="text-muted-foreground"
                                >
                                  {cOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                                <Input
                                  value={c.name}
                                  onChange={(e) => renameConcern(c.id, e.target.value)}
                                  className="h-8 flex-1"
                                />
                                <span className="text-xs text-muted-foreground">{selected.size}</span>
                                <Button size="icon" variant="ghost" onClick={() => removeConcern(c.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                              {cOpen && (
                                <div className="space-y-1 border-t p-2">
                                  {treatments.length === 0 ? (
                                    <p className="text-xs italic text-muted-foreground">Add treatments first.</p>
                                  ) : (
                                    treatments.map((t) => (
                                      <label key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                                        <Checkbox
                                          checked={selected.has(t.id)}
                                          onCheckedChange={() => toggleLink(c.id, t.id)}
                                        />
                                        <span>{t.name}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review AI suggestions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tick or untick to adjust. Nothing is saved until you tap <strong>Apply</strong>.
          </p>
          <div className="space-y-3 mt-2">
            {Object.entries(aiDraft).length === 0 && (
              <p className="text-sm italic text-muted-foreground">No suggestions.</p>
            )}
            {Object.entries(aiDraft).map(([concernId, set]) => {
              const concern = concerns.find((c) => c.id === concernId);
              if (!concern) return null;
              const area = areas.find((a) => a.id === concern.area_id);
              return (
                <div key={concernId} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <div className="font-medium">{concern.name}</div>
                    {area && <span className="text-xs text-muted-foreground">{area.name}</span>}
                  </div>
                  <div className="space-y-1">
                    {treatments.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                        <Checkbox
                          checked={set.has(t.id)}
                          onCheckedChange={() => toggleDraft(concernId, t.id)}
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={aiSaving}>Cancel</Button>
            <Button onClick={applyAiDraft} disabled={aiSaving}>
              {aiSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sugOpen} onOpenChange={setSugOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review AI-suggested concerns</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Untick anything you don't want, edit the name or area, then tap <strong>Add selected</strong>. Existing concerns are skipped automatically.
          </p>
          <div className="mt-3 space-y-3">
            {suggestions.length === 0 && (
              <p className="text-sm italic text-muted-foreground">No suggestions.</p>
            )}
            {suggestions.map((s, idx) => (
              <div key={idx} className={`rounded-lg border p-3 ${s._selected ? "bg-card" : "bg-muted/40 opacity-70"}`}>
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={s._selected}
                    onCheckedChange={(v) => updateSuggestion(idx, { _selected: !!v })}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={s.name}
                      onChange={(e) => updateSuggestion(idx, { name: e.target.value })}
                      className="h-9 font-medium"
                    />
                    {s.description && (
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Area</Label>
                      <Select
                        value={s._areaChoice}
                        onValueChange={(v) => updateSuggestion(idx, { _areaChoice: v })}
                      >
                        <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {areas.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                          <SelectItem value="__new__">
                            + Create "{s.area_name || "General"}"
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Matched treatments</div>
                      <div className="flex flex-wrap gap-1.5">
                        {treatments.map((t) => {
                          const on = s.treatment_ids.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleSuggestionTreatment(idx, t.id)}
                              className={`rounded-full border px-2.5 py-0.5 text-xs transition ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSugOpen(false)} disabled={sugSaving}>Cancel</Button>
            <Button onClick={applySuggestedConcerns} disabled={sugSaving}>
              {sugSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Add selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}


function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NewConcernRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="New concern (e.g. Fine lines)"
        className="h-9"
        onKeyDown={(e) => {
          if (e.key === "Enter") { onAdd(v); setV(""); }
        }}
      />
      <Button size="sm" onClick={() => { onAdd(v); setV(""); }}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
