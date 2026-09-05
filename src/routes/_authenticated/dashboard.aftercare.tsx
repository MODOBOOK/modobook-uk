import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAftercareTemplates,
  saveAftercareTemplate,
  deleteAftercareTemplate,
  listMyTreatmentsBasic,
  getAftercareTemplateTreatmentIds,
  setAftercareTemplateTreatmentIds,
  cloneSystemAftercareTemplate,
} from "@/lib/aftercare-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Copy, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AiGenerateAftercareDialog } from "@/components/aftercare/AiGenerateAftercareDialog";

export const Route = createFileRoute("/_authenticated/dashboard/aftercare")({
  component: AftercarePage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

type Tpl = { id: string; name: string; body_html: string; delay_hours: number; is_system?: boolean; category?: string | null; summary?: string | null; show_on_public?: boolean };

function decodeEntities(s: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith("#x")) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith("#")) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[key] ?? match;
  });
}

function plainAftercareText(value: string) {
  return decodeEntities(value)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AftercarePage() {
  const list = useServerFn(listAftercareTemplates);
  const save = useServerFn(saveAftercareTemplate);
  const remove = useServerFn(deleteAftercareTemplate);
  const listTreatments = useServerFn(listMyTreatmentsBasic);
  const getTplTreatments = useServerFn(getAftercareTemplateTreatmentIds);
  const setTplTreatments = useServerFn(setAftercareTemplateTreatmentIds);
  const cloneSys = useServerFn(cloneSystemAftercareTemplate);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["aftercare-templates"], queryFn: () => list() });
  const tQ = useQuery({ queryKey: ["my-treatments-basic"], queryFn: () => listTreatments() });
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [treatmentIds, setTreatmentIds] = useState<string[]>([]);

  const openEditor = async (tpl: Tpl) => {
    setEditing({ ...tpl, body_html: plainAftercareText(tpl.body_html ?? "") });
    setOpen(true);
    if (tpl.id) {
      const ids = await getTplTreatments({ data: { template_id: tpl.id } });
      setTreatmentIds(ids as string[]);
    } else {
      setTreatmentIds([]);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
      <header className="space-y-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3 sm:space-y-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Aftercare templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Write once, attach to any treatment in <span className="font-medium">Services</span>. Sent automatically after the appointment ends — defaults to 2 hours after.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Wand2 className="mr-1 h-4 w-4" /> <span className="sm:hidden">AI draft</span><span className="hidden sm:inline">Generate with AI</span>
          </Button>
          <Button
            onClick={() => openEditor({ id: "", name: "", body_html: "", delay_hours: 2 })}
          >
            <Plus className="mr-1 h-4 w-4" /> <span className="sm:hidden">New</span><span className="hidden sm:inline">New template</span>
          </Button>
        </div>
      </header>

      {(() => {
        const all = (q.data as Tpl[] | undefined) ?? [];
        const mine = all.filter((t) => !t.is_system);
        const sys = all.filter((t) => t.is_system);
        const grouped = sys.reduce<Record<string, Tpl[]>>((acc, t) => {
          const k = t.category || "General";
          (acc[k] ||= []).push(t);
          return acc;
        }, {});
        return (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">My templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                {!q.isLoading && mine.length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No personal templates yet. Use one from the library below, or click <span className="font-medium">New template</span>.
                  </div>
                )}
                {mine.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">Sends {t.delay_hours}h after appointment</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEditor(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Delete "${t.name}"?`)) return;
                          await remove({ data: { id: t.id } });
                          await qc.invalidateQueries({ queryKey: ["aftercare-templates"] });
                          toast.success("Deleted");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" /> Aftercare library
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Ready-made aftercare written by clinicians. Use as-is, or duplicate to edit your own version.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat} className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</div>
                    {items.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.name}</div>
                          {t.summary && <div className="truncate text-xs text-muted-foreground">{t.summary}</div>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => openEditor(t)}>
                            Attach
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await cloneSys({ data: { id: t.id } });
                              await qc.invalidateQueries({ queryKey: ["aftercare-templates"] });
                              toast.success("Added to your templates");
                            }}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" /> Copy & edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        );
      })()}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editing?.is_system
                ? "Attach to treatments"
                : editing?.id
                  ? "Edit template"
                  : "New aftercare template"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {editing.is_system && (
                <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                  This is a system template — you can attach it to your treatments but the content is read-only. Use <span className="font-medium">Copy &amp; edit</span> in the library to make your own version.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Lip filler aftercare"
                  disabled={!!editing.is_system}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  rows={10}
                  value={editing.body_html}
                  onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                  placeholder="Write the aftercare instructions sent to the patient."
                  disabled={!!editing.is_system}
                />
              </div>
              <div className="space-y-1.5 max-w-[200px]">
                <Label>Send after (hours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.delay_hours}
                  onChange={(e) =>
                    setEditing({ ...editing, delay_hours: Math.max(0, Number(e.target.value) || 0) })
                  }
                  disabled={!!editing.is_system}
                />
              </div>

              {!editing.is_system && (
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={!!editing.show_on_public}
                    onChange={(e) => setEditing({ ...editing, show_on_public: e.target.checked })}
                  />
                  <span className="text-sm">
                    <span className="font-semibold">Show on booking page (Pre + Post Care)</span>
                    <span className="block text-xs text-muted-foreground">Patients can read this from the "Care Guide" button on your booking page before they book.</span>
                  </span>
                </label>
              )}

              <div className="space-y-1.5 rounded-lg border p-3">
                <Label className="text-sm font-semibold">Auto-attach to treatments</Label>
                <p className="text-xs text-muted-foreground">
                  Selected treatments will automatically send this aftercare after each appointment.
                </p>
                {(tQ.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No treatments yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(tQ.data as { id: string; name: string }[]).map((tr) => {
                      const checked = treatmentIds.includes(tr.id);
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() =>
                            setTreatmentIds((prev) =>
                              prev.includes(tr.id) ? prev.filter((x) => x !== tr.id) : [...prev, tr.id],
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${checked ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"}`}
                        >
                          {tr.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!editing?.name.trim()}
              onClick={async () => {
                if (!editing) return;
                let tplId: string | undefined = editing.id || undefined;
                if (!editing.is_system) {
                  const saved = await save({
                    data: {
                      id: editing.id || undefined,
                      name: editing.name.trim(),
                      body_html: editing.body_html,
                      delay_hours: editing.delay_hours,
                      show_on_public: !!editing.show_on_public,
                    },
                  });
                  tplId = (saved as any)?.id ?? editing.id;
                }
                if (tplId) {
                  await setTplTreatments({ data: { template_id: tplId, treatment_ids: treatmentIds } });
                }
                await qc.invalidateQueries({ queryKey: ["aftercare-templates"] });
                await qc.invalidateQueries({ queryKey: ["my-aftercare-templates"] });
                setOpen(false);
                toast.success("Saved");
              }}
            >
              {editing?.is_system ? "Save attachments" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AiGenerateAftercareDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        onGenerated={(out) => {
          setEditing({
            id: "",
            name: out.name,
            body_html: out.body_html,
            delay_hours: out.delay_hours,
          });
          setTreatmentIds([]);
          setOpen(true);
        }}
      />
    </div>
  );
}
