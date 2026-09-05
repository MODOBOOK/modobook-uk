import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPretreatmentTemplates,
  savePretreatmentTemplate,
  deletePretreatmentTemplate,
  type PretreatmentTpl,
} from "@/lib/pretreatment-templates.functions";
import {
  PRETREATMENT_CATEGORIES,
  PRETREATMENT_PRESETS,
  categoryLabel,
  type PretreatmentCategory,
} from "@/lib/pretreatment-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/pre-treatment")({
  component: PreTreatmentPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

type Editing = {
  id?: string;
  name: string;
  summary: string;
  category: PretreatmentCategory;
  bullets: string[];
  body_html: string;
  use_paragraph: boolean;
  show_on_public: boolean;
  active: boolean;
};

function emptyEditing(category: PretreatmentCategory = "general"): Editing {
  return {
    name: PRETREATMENT_CATEGORIES.find((c) => c.value === category)?.label ?? "New section",
    summary: "",
    category,
    bullets: [...(PRETREATMENT_PRESETS[category] ?? [])],
    body_html: "",
    use_paragraph: false,
    show_on_public: true,
    active: true,
  };
}

function PreTreatmentPage() {
  const list = useServerFn(listPretreatmentTemplates);
  const save = useServerFn(savePretreatmentTemplate);
  const remove = useServerFn(deletePretreatmentTemplate);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pretreatment-templates"], queryFn: () => list() });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [open, setOpen] = useState(false);

  const items = (q.data as PretreatmentTpl[] | undefined) ?? [];

  const grouped = useMemo(() => {
    const m = new Map<string, PretreatmentTpl[]>();
    for (const it of items) {
      const k = it.category || "general";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return m;
  }, [items]);

  function openNew(category: PretreatmentCategory = "general") {
    setEditing(emptyEditing(category));
    setOpen(true);
  }

  function openEdit(t: PretreatmentTpl) {
    const cat = (t.category || "general") as PretreatmentCategory;
    setEditing({
      id: t.id,
      name: t.name,
      summary: t.summary ?? "",
      category: cat,
      bullets: Array.isArray(t.bullets) ? t.bullets : [],
      body_html: t.body_html ?? "",
      use_paragraph: !!t.body_html && (!t.bullets || t.bullets.length === 0),
      show_on_public: t.show_on_public,
      active: t.active,
    });
    setOpen(true);
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={() => openNew("general")}>
          <Plus className="mr-1 h-4 w-4" /> New section
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Pre-treatment information</h1>
        <p className="text-sm text-muted-foreground">
          Tick the rules you want patients to see before they book. Each treatment type has its own
          checklist — add your own bullets, or switch to a written paragraph if you prefer.
        </p>
      </header>

      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!q.isLoading && (
        <div className="space-y-4">
          {PRETREATMENT_CATEGORIES.map((cat) => {
            const list = grouped.get(cat.value) ?? [];
            return (
              <Card key={cat.value}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">{cat.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{cat.summary}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openNew(cat.value)}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No section yet. Click <span className="font-medium">Add</span> to start from a
                      ready-made checklist for {cat.label.toLowerCase()}.
                    </p>
                  ) : (
                    list.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="truncate font-medium">{t.name}</div>
                            {t.show_on_public ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                <Eye className="h-3 w-3" /> Visible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <EyeOff className="h-3 w-3" /> Hidden
                              </span>
                            )}
                          </div>
                          {t.summary && (
                            <div className="truncate text-xs text-muted-foreground">{t.summary}</div>
                          )}
                          {Array.isArray(t.bullets) && t.bullets.length > 0 ? (
                            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                              {t.bullets.slice(0, 3).map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                              {t.bullets.length > 3 && (
                                <li className="list-none italic">
                                  +{t.bullets.length - 3} more
                                </li>
                              )}
                            </ul>
                          ) : t.body_html ? (
                            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {t.body_html.replace(/<[^>]+>/g, " ").trim()}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (!confirm(`Delete "${t.name}"?`)) return;
                              await remove({ data: { id: t.id } });
                              await qc.invalidateQueries({ queryKey: ["pretreatment-templates"] });
                              toast.success("Deleted");
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit section" : "New pre-treatment section"}</DialogTitle>
            <DialogDescription>
              Pick a treatment type, then tick the rules patients should see. Untick anything that
              doesn't apply, and add your own at the bottom.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Treatment type</Label>
                  <Select
                    value={editing.category}
                    onValueChange={(v) => {
                      const newCat = v as PretreatmentCategory;
                      // If user hasn't customised bullets much, refresh presets
                      const presets = PRETREATMENT_PRESETS[newCat] ?? [];
                      const wasOldPresets = (PRETREATMENT_PRESETS[editing.category] ?? []).every((b) =>
                        editing.bullets.includes(b),
                      );
                      setEditing({
                        ...editing,
                        category: newCat,
                        name:
                          editing.name === categoryLabel(editing.category)
                            ? categoryLabel(newCat)
                            : editing.name,
                        bullets: wasOldPresets ? [...presets] : editing.bullets,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRETREATMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Short summary <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  value={editing.summary}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                  placeholder="e.g. Things to do and avoid 24h before"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Use a written paragraph instead</div>
                  <div className="text-xs text-muted-foreground">
                    Best for one-off notes. The checklist below is hidden when this is on.
                  </div>
                </div>
                <Switch
                  checked={editing.use_paragraph}
                  onCheckedChange={(v) => setEditing({ ...editing, use_paragraph: v })}
                />
              </div>

              {editing.use_paragraph ? (
                <div className="space-y-1.5">
                  <Label>Paragraph</Label>
                  <Textarea
                    rows={8}
                    value={editing.body_html}
                    onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                    placeholder="Write your pre-treatment notes here…"
                  />
                </div>
              ) : (
                <BulletEditor
                  category={editing.category}
                  bullets={editing.bullets}
                  onChange={(bullets) => setEditing({ ...editing, bullets })}
                />
              )}

              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={editing.show_on_public}
                  onChange={(e) => setEditing({ ...editing, show_on_public: e.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-semibold">Show on booking page</span>
                  <span className="block text-xs text-muted-foreground">
                    Patients can read this from the "Pre-treatment" button before they book.
                  </span>
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!editing?.name?.trim()}
              onClick={async () => {
                if (!editing) return;
                await save({
                  data: {
                    id: editing.id,
                    name: editing.name.trim(),
                    summary: editing.summary,
                    category: editing.category,
                    bullets: editing.use_paragraph ? [] : editing.bullets.filter((b) => b.trim()),
                    body_html: editing.use_paragraph ? editing.body_html : "",
                    show_on_public: editing.show_on_public,
                    active: editing.active,
                  },
                });
                await qc.invalidateQueries({ queryKey: ["pretreatment-templates"] });
                setOpen(false);
                toast.success("Saved");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulletEditor({
  category,
  bullets,
  onChange,
}: {
  category: PretreatmentCategory;
  bullets: string[];
  onChange: (next: string[]) => void;
}) {
  const presets = PRETREATMENT_PRESETS[category] ?? [];
  const [draft, setDraft] = useState("");
  const customBullets = bullets.filter((b) => !presets.includes(b));

  function toggle(preset: string) {
    if (bullets.includes(preset)) onChange(bullets.filter((b) => b !== preset));
    else onChange([...bullets, preset]);
  }

  function addCustom() {
    const t = draft.trim();
    if (!t) return;
    if (bullets.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...bullets, t]);
    setDraft("");
  }

  function removeCustom(text: string) {
    onChange(bullets.filter((b) => b !== text));
  }

  return (
    <div className="space-y-3">
      {presets.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Suggested rules — tick to include
          </Label>
          <div className="space-y-1.5 rounded-lg border p-3">
            {presets.map((p) => {
              const checked = bullets.includes(p);
              return (
                <label key={p} className="flex items-start gap-2 cursor-pointer py-1">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(p)}
                    className="mt-0.5"
                  />
                  <span className={`text-sm ${checked ? "" : "text-muted-foreground"}`}>{p}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Your own bullets
        </Label>
        {customBullets.length > 0 && (
          <ul className="space-y-1.5">
            {customBullets.map((b) => (
              <li
                key={b}
                className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <span>{b}</span>
                <button
                  type="button"
                  onClick={() => removeCustom(b)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a custom rule…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustom} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
