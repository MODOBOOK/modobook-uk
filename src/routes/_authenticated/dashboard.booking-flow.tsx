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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
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
  const treatments = loaded.treatments as { id: string; name: string }[];

  const p = loaded.profile as Record<string, unknown>;
  const [enabled, setEnabled] = useState(Boolean(p.chooser_enabled));
  const [showKnow, setShowKnow] = useState(p.chooser_show_know !== false);
  const [showUnsure, setShowUnsure] = useState(p.chooser_show_unsure !== false);
  const [showConsult, setShowConsult] = useState(p.chooser_show_consultation !== false);
  const [consultIds, setConsultIds] = useState<string[]>(
    Array.isArray(p.chooser_consultation_treatment_ids)
      ? (p.chooser_consultation_treatment_ids as string[])
      : (p.chooser_consultation_treatment_id ? [p.chooser_consultation_treatment_id as string] : []),
  );
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
          chooser_consultation_treatment_id: consultIds[0] ?? null,
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

      <Card>
        <CardHeader><CardTitle>Picker settings</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <Row label="Enable picker" hint="Show the 3 options after a patient picks a location.">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </Row>
          <Row label='Show "I know what I want"'>
            <Switch checked={showKnow} onCheckedChange={setShowKnow} />
          </Row>
          <Row label='Show "I\u2019m unsure what to book"'>
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
        <CardHeader>
          <CardTitle>Concerns &amp; matched treatments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Group concerns by area (e.g. Face, Body). For each concern, tick the treatments you'd suggest.
          </p>

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
