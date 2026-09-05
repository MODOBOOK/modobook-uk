import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  extractClinicData,
  commitClinicImport,
  generateDescription,
  resetClinicServices,
  type ExtractedDraft,
  type ExtractedCategory,
  type ExtractedTreatment,
  type ExtractedAddon,
  type ExtractedPackage,
  type ExtractedClinic,
} from "@/lib/ai-import.functions";

import { extractReviews, commitReviews, type ExtractedReview } from "@/lib/ai-reviews.functions";
import { suggestFormMatches, commitFormMatches } from "@/lib/ai-forms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, FileText, Image as ImageIcon, Loader2, Wand2, CheckCircle2, Star, MessageSquareQuote, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/ai-import")({
  component: AiImportPage,
});

type IdName = { id: string; name: string };

type SourceKind = "pdf" | "image";

type Draftable<T> = T & { _include: boolean };
type EditableDraft = {
  clinic: ExtractedClinic & { _include: boolean };
  categories: Draftable<ExtractedCategory>[];
  treatments: Draftable<ExtractedTreatment>[];
  addons: Draftable<ExtractedAddon>[];
  packages: Draftable<ExtractedPackage>[];
};

function toEditable(d: ExtractedDraft): EditableDraft {
  return {
    clinic: { ...d.clinic, _include: true },
    categories: d.categories.map((c) => ({ ...c, _include: true })),
    treatments: d.treatments.map((c) => ({ ...c, _include: true })),
    addons: d.addons.map((c) => ({ ...c, _include: true })),
    packages: d.packages.map((c) => ({ ...c, _include: true })),
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


function AiImportPage() {
  const extract = useServerFn(extractClinicData);
  const commit = useServerFn(commitClinicImport);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [draft, setDraft] = useState<EditableDraft | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof commit>> | null>(null);

  // upload state
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<SourceKind>("pdf");

  async function handleExtract() {
    setBusy(true);
    try {
      let result: ExtractedDraft;
      // pdf or image — supports multiple files
      const all = files.length ? files : file ? [file] : [];
      if (!all.length) throw new Error("Choose at least one file");
      const payload = await Promise.all(
        all.map(async (f) => ({ data_url: await fileToDataUrl(f), name: f.name })),
      );
      result = await extract({ data: { files: payload } });
      const total =
        (result.categories?.length ?? 0) +
        (result.treatments?.length ?? 0) +
        (result.addons?.length ?? 0);
      if (!total) {
        toast.error("AI didn't find any services in that source. Try a clearer file.");
      } else {
        toast.success(`Found ${result.treatments.length} treatments, ${result.categories.length} categories`);
      }
      setDraft(toEditable(result));
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!draft) return;
    setBusy(true);
    try {
      const r = await commit({ data: draft });
      setSummary(r);
      setStep("done");
      try { localStorage.setItem("modo:ai-import-done", "1"); } catch {}
      toast.success("Import complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="size-5 text-primary" /> Import with AI
        </h1>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Set up your clinic in seconds</CardTitle>
            <p className="text-sm text-muted-foreground">
              Send us your existing price list — PDF or photo / screenshot — and AI will
              pull out your <b>categories, subcategories, treatments, prices and add-ons</b>. You
              review everything on the next screen before anything saves.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SourceTile
                icon={<FileText className="size-5" />}
                label="PDF"
                desc="A price-list PDF you already give clients"
                active={kind === "pdf"}
                onClick={() => setKind("pdf")}
              />
              <SourceTile
                icon={<ImageIcon className="size-5" />}
                label="Photo / screenshot"
                desc="A picture of a printed menu or your Instagram price post"
                active={kind === "image"}
                onClick={() => setKind("image")}
              />
            </div>

            <div className="space-y-2">
              <Label>{kind === "pdf" ? "PDF file(s)" : "Image(s) / screenshot(s)"}</Label>
              <Input
                type="file"
                multiple
                accept={kind === "pdf" ? "application/pdf" : "image/*"}
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  setFiles(list);
                  setFile(list[0] ?? null);
                }}
              />
              {files.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {files.map((f, i) => (
                    <li key={i}>{f.name} · {(f.size / 1024).toFixed(0)} KB</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                You can select multiple {kind === "pdf" ? "PDFs" : "photos"} at once (e.g. several pages of one
                price list) — AI will merge them into a single set of treatments. Clearer source = better result.
              </p>
            </div>


            <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Nothing is saved to your account until you press <b>Import</b> on the next screen.
              </p>
              <Button onClick={handleExtract} disabled={busy} size="lg">
                {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Reading…</> : <><Wand2 className="mr-2 size-4" /> Extract with AI</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "upload" && <ReviewsImportCard />}
      {step === "upload" && <FormMatcherCard />}
      {step === "upload" && <ResetImportCard />}



      {step === "review" && draft && (
        <ReviewStep
          draft={draft}
          setDraft={setDraft}
          onBack={() => setStep("upload")}
          onImport={handleImport}
          busy={busy}
        />
      )}

      {step === "done" && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /> All imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-1">
              {summary.clinic && <li>Clinic info updated</li>}
              <li>{summary.categories} categories</li>
              <li>{summary.treatments} treatments</li>
              <li>{summary.addons} add-ons</li>
              <li className="text-xs text-muted-foreground">Packages aren't auto-imported — add them in Services › Packages.</li>
              {summary.skipped > 0 && <li className="text-muted-foreground">{summary.skipped} skipped as duplicates</li>}
            </ul>
            {summary.errors && summary.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <p className="mb-1 font-medium text-destructive">Some items couldn't be saved:</p>
                <ul className="list-disc space-y-0.5 pl-4 text-destructive/90">
                  {summary.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild><Link to="/dashboard/services">Open Services</Link></Button>
              <Button variant="outline" asChild><Link to="/dashboard">Back to dashboard</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SourceTile({ icon, label, desc, active, onClick }: { icon: React.ReactNode; label: string; desc?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col items-start gap-2 rounded-lg border p-4 text-left text-sm transition ${
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {desc && <span className="text-xs leading-snug text-muted-foreground">{desc}</span>}
    </button>
  );
}


function ReviewStep({
  draft,
  setDraft,
  onBack,
  onImport,
  busy,
}: {
  draft: EditableDraft;
  setDraft: (d: EditableDraft) => void;
  onBack: () => void;
  onImport: () => void;
  busy: boolean;
}) {
  const includedCats = draft.categories.filter((c) => c._include).length;
  const includedTr = draft.treatments.filter((c) => c._include).length;
  const includedAd = draft.addons.filter((c) => c._include).length;
  

  function setRow(key: "categories" | "treatments" | "addons" | "packages", idx: number, patch: Record<string, unknown>) {
    const arr = [...(draft[key] as Array<Record<string, unknown>>)];
    arr[idx] = { ...arr[idx], ...patch };
    setDraft({ ...draft, [key]: arr } as EditableDraft);
  }

  function toggleAll<K extends "categories" | "treatments" | "addons" | "packages">(key: K, value: boolean) {
    setDraft({ ...draft, [key]: draft[key].map((r) => ({ ...r, _include: value })) });
  }

  function addRow(key: "categories" | "treatments" | "addons" | "packages") {
    const blank: Record<string, unknown> = { _include: true, name: "" };
    setDraft({ ...draft, [key]: [...(draft[key] as Array<Record<string, unknown>>), blank] } as EditableDraft);
  }

  function removeRow(key: "categories" | "treatments" | "addons" | "packages", idx: number) {
    const arr = [...(draft[key] as Array<Record<string, unknown>>)];
    arr.splice(idx, 1);
    setDraft({ ...draft, [key]: arr } as EditableDraft);
  }

  // Build a hierarchical list of included categories: top-level + their subcategories.
  const includedCatNames = draft.categories
    .filter((c) => c._include && c.name?.trim())
    .map((c) => ({ name: c.name.trim(), parent: c.parent?.trim() || null }));

  const parentOptions = includedCatNames
    .filter((c) => !c.parent)
    .map((c) => c.name);

  // Each entry: { value: display name, label: "Parent › Child" or just name }
  const categoryOptions = includedCatNames.map((c) => ({
    value: c.name,
    label: c.parent ? `${c.parent} › ${c.name}` : c.name,
  }));

  function addCategoryInline(name: string, parent: string | null) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (draft.categories.some((c) => c.name?.toLowerCase().trim() === trimmed.toLowerCase())) return;
    setDraft({
      ...draft,
      categories: [...draft.categories, { _include: true, name: trimmed, parent }],
    });
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
        <CardContent className="py-3 text-sm text-amber-900 dark:text-amber-100">
          <b>Quick check:</b> AI sometimes misreads source content. Untick anything you don't
          actually offer, edit names/prices in place, or use <b>+ Add</b> to fill in items it
          missed. Subcategories use the <b>Parent</b> dropdown.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clinic info</CardTitle>
          <p className="text-xs text-muted-foreground">Only empty fields on your profile get filled — your existing details won't be overwritten.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={draft.clinic._include} onCheckedChange={(v) => setDraft({ ...draft, clinic: { ...draft.clinic, _include: !!v } })} id="clinic-inc" />
            <Label htmlFor="clinic-inc" className="text-sm text-muted-foreground">Apply clinic details</Label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Clinic name" value={draft.clinic.clinic_name ?? ""} onChange={(v) => setDraft({ ...draft, clinic: { ...draft.clinic, clinic_name: v } })} />
            <Field label="Tagline" value={draft.clinic.tagline ?? ""} onChange={(v) => setDraft({ ...draft, clinic: { ...draft.clinic, tagline: v } })} />
          </div>
          <Field label="Bio / intro" textarea value={draft.clinic.bio ?? ""} onChange={(v) => setDraft({ ...draft, clinic: { ...draft.clinic, bio: v } })} />
        </CardContent>
      </Card>

      <ListCard
        title={`Categories (${includedCats}/${draft.categories.length})`}
        helper="Top-level groupings like Injectables, Skin, Body. Leave Parent blank for a top category, or pick one to make this a subcategory."
        onAll={(v) => toggleAll("categories", v)}
        onAdd={() => addRow("categories")}
        empty="No categories detected — use + Add category to create one."
        rows={draft.categories.map((c, i) => (
          <Row key={i} included={c._include} onToggle={(v) => setRow("categories", i, { _include: v })} onRemove={() => removeRow("categories", i)}>
            <Input className="md:max-w-xs" value={c.name} onChange={(e) => setRow("categories", i, { name: e.target.value })} placeholder="Category name" />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm md:max-w-xs"
              value={c.parent ?? ""}
              onChange={(e) => setRow("categories", i, { parent: e.target.value || null })}
            >
              <option value="">— Top-level category —</option>
              {parentOptions
                .filter((p) => p.toLowerCase() !== c.name?.toLowerCase())
                .map((p) => (
                  <option key={p} value={p}>Subcategory of: {p}</option>
                ))}
            </select>
          </Row>
        ))}
      />

      <ListCard
        title={`Treatments (${includedTr}/${draft.treatments.length})`}
        helper="Each row becomes a bookable service. Add or generate a client-facing description below."
        onAll={(v) => toggleAll("treatments", v)}
        onAdd={() => addRow("treatments")}
        empty="No treatments detected — use + Add treatment to create one."
        rows={draft.treatments.map((t, i) => (
          <TreatmentRow
            key={i}
            treatment={t}
            categoryOptions={categoryOptions}
            parentOptions={parentOptions}
            onAddCategory={addCategoryInline}
            onToggle={(v) => setRow("treatments", i, { _include: v })}
            onRemove={() => removeRow("treatments", i)}
            onChange={(patch) => setRow("treatments", i, patch)}
          />
        ))}
      />

      <ListCard
        title={`Add-ons (${includedAd}/${draft.addons.length})`}
        helper="Optional extras patients pick on top of a treatment (e.g. extra units, numbing)."
        onAll={(v) => toggleAll("addons", v)}
        onAdd={() => addRow("addons")}
        empty="No add-ons detected — use + Add add-on if you offer any."
        rows={draft.addons.map((a, i) => (
          <Row key={i} included={a._include} onToggle={(v) => setRow("addons", i, { _include: v })} onRemove={() => removeRow("addons", i)}>
            <Input className="md:max-w-xs" value={a.name} onChange={(e) => setRow("addons", i, { name: e.target.value })} placeholder="Add-on name" />
            <Input className="md:max-w-[110px]" type="number" step="0.01" value={a.price_gbp ?? ""} onChange={(e) => setRow("addons", i, { price_gbp: e.target.value ? Number(e.target.value) : undefined })} placeholder="£" />
            <Input className="md:max-w-[110px]" type="number" value={a.duration_min ?? ""} onChange={(e) => setRow("addons", i, { duration_min: e.target.value ? Number(e.target.value) : undefined })} placeholder="Extra mins" />
          </Row>
        ))}
      />

      <Card className="border-dashed">
        <CardContent className="py-3 text-xs text-muted-foreground">
          <b>Packages</b> aren't created by AI. Anything that looks like a "course of 3" or bundle stays in its category as a normal treatment — head to <span className="font-medium">Services › Packages</span> to build packages by hand once your treatments are in.
        </CardContent>
      </Card>


      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="text-sm text-muted-foreground">
          Importing <b>{includedTr}</b> treatments, <b>{includedCats}</b> categories,{" "}
          <b>{includedAd}</b> add-ons.
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={busy}>Back</Button>
          <Button onClick={onImport} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Importing…</> : "Import to MODO"}
          </Button>
        </div>
      </div>
    </>
  );
}

function ListCard({ title, rows, onAll, onAdd, empty, helper }: { title: string; rows: React.ReactNode[]; onAll: (v: boolean) => void; onAdd?: () => void; empty: string; helper?: string }) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <button className="text-muted-foreground hover:text-foreground" onClick={() => onAll(true)}>Select all</button>
            <span className="text-muted-foreground">·</span>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => onAll(false)}>Deselect all</button>
            {onAdd && (
              <>
                <span className="text-muted-foreground">·</span>
                <button className="font-medium text-primary hover:underline" onClick={onAdd}>+ Add</button>
              </>
            )}
          </div>
        </div>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : rows}
      </CardContent>
    </Card>
  );
}

function Row({ included, onToggle, onRemove, children }: { included: boolean; onToggle: (v: boolean) => void; onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${included ? "" : "opacity-50"}`}>
      <Checkbox checked={included} onCheckedChange={(v) => onToggle(!!v)} />
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-xs text-muted-foreground hover:text-destructive"
          aria-label="Remove row"
        >
          Remove
        </button>
      )}
    </div>
  );
}


function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {textarea ? (
        <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function PackageRow({
  pkg,
  onToggle,
  onRemove,
  onChange,
}: {
  pkg: Draftable<ExtractedPackage>;
  onToggle: (v: boolean) => void;
  onRemove: () => void;
  onChange: (patch: Partial<ExtractedPackage>) => void;
}) {
  const generate = useServerFn(generateDescription);
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    setBusy(true);
    try {
      const r = await generate({
        data: {
          kind: "package",
          name: pkg.name || "Package",
          treatment_names: pkg.treatment_names ?? [],
          sessions: pkg.sessions,
          price_gbp: pkg.price_gbp,
        },
      });
      if (r.description) onChange({ description: r.description });
      else toast.error("AI didn't return a description");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-2 rounded-md border p-2 ${pkg._include ? "" : "opacity-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox checked={pkg._include} onCheckedChange={(v) => onToggle(!!v)} />
        <Input className="md:max-w-xs" value={pkg.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Package name" />
        <Input className="md:max-w-[110px]" type="number" step="0.01" value={pkg.price_gbp ?? ""} onChange={(e) => onChange({ price_gbp: e.target.value ? Number(e.target.value) : undefined })} placeholder="£" />
        <Input className="md:max-w-[100px]" type="number" value={pkg.sessions ?? ""} onChange={(e) => onChange({ sessions: e.target.value ? Number(e.target.value) : undefined })} placeholder="Sessions" />
        {pkg.treatment_names?.length ? <Badge variant="secondary">{pkg.treatment_names.length} treatments</Badge> : null}
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-xs text-muted-foreground hover:text-destructive"
        >
          Remove
        </button>
      </div>
      {pkg.treatment_names && pkg.treatment_names.length > 0 && (
        <p className="pl-7 text-xs text-muted-foreground">
          Includes: {pkg.treatment_names.join(", ")}
        </p>
      )}
      <div className="space-y-1 pl-7">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Client-facing description</Label>
          <Button type="button" size="sm" variant="ghost" onClick={handleGenerate} disabled={busy} className="h-7 gap-1 text-xs">
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
            {pkg.description ? "Rewrite with AI" : "Generate with AI"}
          </Button>
        </div>
        <Textarea
          rows={2}
          value={pkg.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Shown to clients on the booking page. Leave blank or click Generate."
        />
      </div>
    </div>
  );
}


function TreatmentRow({
  treatment,
  categoryOptions,
  parentOptions,
  onAddCategory,
  onToggle,
  onRemove,
  onChange,
}: {
  treatment: Draftable<ExtractedTreatment>;
  categoryOptions: Array<{ value: string; label: string }>;
  parentOptions: string[];
  onAddCategory: (name: string, parent: string | null) => void;
  onToggle: (v: boolean) => void;
  onRemove: () => void;
  onChange: (patch: Partial<ExtractedTreatment>) => void;
}) {
  const generate = useServerFn(generateDescription);
  const [busy, setBusy] = useState(false);
  const sessions = treatment.session_count ?? 1;

  async function handleGenerate() {
    setBusy(true);
    try {
      const r = await generate({
        data: {
          kind: "treatment",
          name: treatment.name || "Treatment",
          price_gbp: treatment.price_gbp,
        },
      });
      if (r.description) onChange({ description: r.description });
      else toast.error("AI didn't return a description");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  function handleCategoryChange(v: string) {
    if (v === "__new_top__") {
      const name = window.prompt("New category name (e.g. Injectables)")?.trim();
      if (!name) return;
      onAddCategory(name, null);
      onChange({ category: name });
      return;
    }
    if (v === "__new_sub__") {
      const parent = window.prompt(
        `Parent category for the new subcategory. Existing parents:\n\n${parentOptions.join(", ") || "(none yet)"}`,
      )?.trim();
      if (!parent) return;
      const name = window.prompt(`New subcategory name under "${parent}"`)?.trim();
      if (!name) return;
      // Ensure parent exists too
      if (!parentOptions.some((p) => p.toLowerCase() === parent.toLowerCase())) {
        onAddCategory(parent, null);
      }
      onAddCategory(name, parent);
      onChange({ category: name });
      return;
    }
    onChange({ category: v || null });
  }

  return (
    <div className={`space-y-2 rounded-md border p-2 ${treatment._include ? "" : "opacity-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox checked={treatment._include} onCheckedChange={(v) => onToggle(!!v)} />
        <Input className="md:max-w-xs" value={treatment.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Treatment name" />
        <Input className="md:max-w-[110px]" type="number" value={treatment.duration_min ?? ""} onChange={(e) => onChange({ duration_min: e.target.value ? Number(e.target.value) : undefined })} placeholder="Mins" />
        <Input className="md:max-w-[110px]" type="number" step="0.01" value={treatment.price_gbp ?? ""} onChange={(e) => onChange({ price_gbp: e.target.value ? Number(e.target.value) : undefined })} placeholder="£" />
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm md:max-w-xs"
          value={treatment.category ?? ""}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">— No category —</option>
          {categoryOptions.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
          <option value="__new_top__">+ New category…</option>
          <option value="__new_sub__">+ New subcategory…</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-xs text-muted-foreground hover:text-destructive"
        >
          Remove
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 pl-7 text-xs">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Sessions
          <Input
            type="number"
            min={1}
            max={20}
            value={sessions}
            onChange={(e) => {
              const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
              onChange({ session_count: n, allow_split_payment: n > 1 ? treatment.allow_split_payment : false });
            }}
            className="ml-1 h-8 w-16"
          />
        </Label>
        {sessions > 1 && (
          <Label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={!!treatment.allow_split_payment}
              onCheckedChange={(v) => onChange({ allow_split_payment: !!v })}
            />
            Split payment per session (£{treatment.price_gbp ? (treatment.price_gbp / sessions).toFixed(2) : "—"} × {sessions})
          </Label>
        )}
        {sessions > 1 && !treatment.allow_split_payment && (
          <span className="text-muted-foreground">Patient pays full price upfront.</span>
        )}
      </div>

      <div className="space-y-1 pl-7">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Client-facing description</Label>
          <Button type="button" size="sm" variant="ghost" onClick={handleGenerate} disabled={busy} className="h-7 gap-1 text-xs">
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
            {treatment.description ? "Rewrite with AI" : "Generate with AI"}
          </Button>
        </div>
        <Textarea
          rows={2}
          value={treatment.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Shown to clients. Uploaded text appears here automatically — edit or click Generate."
        />
      </div>
    </div>
  );
}

function ReviewsImportCard() {
  const extractAi = useServerFn(extractReviews);
  const commitAi = useServerFn(commitReviews);
  const [open, setOpen] = useState(false);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Array<ExtractedReview & { _include: boolean }> | null>(null);

  function reset() { setDraft(null); setAiFiles([]); setAiText(""); }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareQuote className="size-5 text-primary" /> Import patient reviews
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Don't lose your Google, Facebook or Instagram reviews when you move over. Upload
          screenshots or paste the text — AI pulls out names, ratings and quotes, you tick what to keep.
        </p>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setOpen(true)} size="lg" variant="outline">
          <Wand2 className="mr-2 size-4" /> Import reviews with AI
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Import reviews with AI
            </DialogTitle>
          </DialogHeader>

          {!draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Screenshots or PDFs</Label>
                <Input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => setAiFiles(Array.from(e.target.files ?? []))}
                />
                {aiFiles.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {aiFiles.map((f, i) => <li key={i}>{f.name} · {(f.size / 1024).toFixed(0)} KB</li>)}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <Label>…or paste review text</Label>
                <Textarea
                  rows={5}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder={"e.g.\nSarah — ★★★★★ Amazing service, felt looked after.\nJames — 5/5 Best lip filler I've had."}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  disabled={busy || (!aiFiles.length && !aiText.trim())}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const payload = aiFiles.length
                        ? { files: await Promise.all(aiFiles.map(async (f) => ({ data_url: await fileToDataUrl(f), name: f.name }))) }
                        : { text: aiText.trim() };
                      const r = await extractAi({ data: payload });
                      if (!r.reviews.length) { toast.error("AI couldn't find any reviews. Try a clearer screenshot."); return; }
                      setDraft(r.reviews.map((rv) => ({ ...rv, _include: true })));
                      toast.success(`Found ${r.reviews.length} review${r.reviews.length === 1 ? "" : "s"}`);
                    } catch (e) { toast.error((e as Error).message); }
                    finally { setBusy(false); }
                  }}
                >
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading…</> : <><Wand2 className="mr-2 h-4 w-4" /> Extract with AI</>}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Untick anything you don't want, or edit in place.</p>
              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {draft.map((r, i) => (
                  <div key={i} className={`space-y-2 rounded-md border p-3 ${r._include ? "" : "opacity-50"}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={r._include} onCheckedChange={(v) => {
                        const next = [...draft]; next[i] = { ...next[i], _include: !!v }; setDraft(next);
                      }} />
                      <Input
                        className="max-w-[180px]"
                        value={r.author_name}
                        onChange={(e) => { const next = [...draft]; next[i] = { ...next[i], author_name: e.target.value }; setDraft(next); }}
                        placeholder="First name"
                      />
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" className="p-0.5" onClick={() => {
                            const next = [...draft]; next[i] = { ...next[i], rating: n }; setDraft(next);
                          }}>
                            <Star className={`h-4 w-4 ${n <= (r.rating ?? 5) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      rows={2}
                      value={r.quote}
                      onChange={(e) => { const next = [...draft]; next[i] = { ...next[i], quote: e.target.value }; setDraft(next); }}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>Back</Button>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    const keep = draft.filter((r) => r._include);
                    if (!keep.length) { toast.error("Tick at least one review to import"); return; }
                    setBusy(true);
                    try {
                      const r = await commitAi({ data: { reviews: keep.map(({ _include: _i, ...rest }) => rest) } });
                      toast.success(`Imported ${r.inserted} review${r.inserted === 1 ? "" : "s"}`);
                      setOpen(false);
                      reset();
                    } catch (e) { toast.error((e as Error).message); }
                    finally { setBusy(false); }
                  }}
                >
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</> : <>Import {draft.filter((r) => r._include).length} review(s)</>}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ResetImportCard() {
  const reset = useServerFn(resetClinicServices);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"treatments" | "all">("all");
  const [mode, setMode] = useState<"safe" | "force">("safe");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await reset({ data: { scope, force: mode === "force" } });
      const parts: string[] = [];
      if (r.removed.treatments) parts.push(`${r.removed.treatments} treatments`);
      if (r.removed.addons) parts.push(`${r.removed.addons} add-ons`);
      if (r.removed.categories) parts.push(`${r.removed.categories} categories`);
      toast.success(parts.length ? `Removed ${parts.join(", ")}` : "Nothing to remove");
      if (r.skipped?.treatments) {
        toast.info(`${r.skipped.treatments} treatments kept — they have existing appointments.`);
      }
      if (r.errors?.length) toast.error(r.errors[0]);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }


  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trash2 className="size-5 text-destructive" /> Reset imported services
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Wipe the treatments, add-ons and categories on your account so you can re-run the AI
          import from a clean slate. Treatments that already have appointments against them are kept
          so your history stays intact.
        </p>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 size-4" /> Remove imported services
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove imported services?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This permanently deletes your services. You can re-import them above afterwards.
            </p>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                className="mt-1"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              <span>
                <b>Everything</b> — treatments, add-ons and categories.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                className="mt-1"
                checked={scope === "treatments"}
                onChange={() => setScope("treatments")}
              />
              <span>
                <b>Treatments only</b> — keep my categories and add-ons.
              </span>
            </label>
          </div>
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">When a treatment has existing bookings…</p>
            <label className="flex items-start gap-2">
              <input type="radio" className="mt-1" checked={mode === "safe"} onChange={() => setMode("safe")} />
              <span><b>Keep it</b> — skip treatments that are already booked (safer).</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" className="mt-1" checked={mode === "force"} onChange={() => setMode("force")} />
              <span><b>Delete anyway</b> — bookings stay on the calendar with the treatment name preserved, but the service is removed from your list.</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={run} disabled={busy}>
              {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Removing…</> : "Yes, remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FormMatcherCard() {
  const suggest = useServerFn(suggestFormMatches);
  const commit = useServerFn(commitFormMatches);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ matches: Array<{ treatment_id: string; medical_form_ids: string[]; consent_ids: string[]; aftercare_ids: string[] }>; treatments: IdName[]; medicalForms: IdName[]; consents: IdName[]; aftercares: IdName[] } | null>(null);
  const [picks, setPicks] = useState<Record<string, { medical_form_ids: string[]; consent_ids: string[]; aftercare_ids: string[] }>>({});
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  async function run() {
    setBusy(true);
    try {
      const r = await suggest({ data: {} });
      setResult(r);
      const init: typeof picks = {};
      for (const m of r.matches) {
        init[m.treatment_id] = {
          medical_form_ids: m.medical_form_ids,
          consent_ids: m.consent_ids,
          aftercare_ids: m.aftercare_ids,
        };
      }
      setPicks(init);
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggle(treatmentId: string, kind: "medical_form_ids" | "consent_ids" | "aftercare_ids", id: string) {
    setPicks((prev) => {
      const cur = prev[treatmentId] ?? { medical_form_ids: [], consent_ids: [], aftercare_ids: [] };
      const set = new Set(cur[kind]);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...prev, [treatmentId]: { ...cur, [kind]: Array.from(set) } };
    });
  }

  async function save() {
    if (!result) return;
    const matches = result.treatments.map((t) => ({
      treatment_id: t.id,
      medical_form_ids: picks[t.id]?.medical_form_ids ?? [],
      consent_ids: picks[t.id]?.consent_ids ?? [],
      aftercare_ids: picks[t.id]?.aftercare_ids ?? [],
    }));
    setBusy(true);
    try {
      const r = await commit({ data: { matches, mode } });
      toast.success(`Linked: ${r.medical} medical, ${r.consent} consent, ${r.aftercare} aftercare`);
      if (r.errors.length) toast.error(r.errors[0]);
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="size-5 text-primary" /> Match forms to treatments with AI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          AI scans your treatments and proposes the right medical intake form, consent form and aftercare
          for each one. Review the picks, untick anything you don't want, then save.
        </p>
      </CardHeader>
      <CardContent>
        <Button onClick={run} disabled={busy} variant="outline" size="lg">
          {busy && !open ? <><Loader2 className="mr-2 size-4 animate-spin" /> Thinking…</> : <><Wand2 className="mr-2 size-4" /> Suggest matches</>}
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review AI form matches</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">When saving:</span>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} />
                  Add to existing
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
                  Replace existing
                </label>
              </div>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {result.treatments.map((t) => {
                  const p = picks[t.id] ?? { medical_form_ids: [], consent_ids: [], aftercare_ids: [] };
                  const renderGroup = (
                    label: string,
                    items: IdName[],
                    kind: "medical_form_ids" | "consent_ids" | "aftercare_ids",
                  ) => (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
                      {items.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground">None available</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {items.map((i) => {
                            const on = p[kind].includes(i.id);
                            return (
                              <button
                                key={i.id}
                                type="button"
                                onClick={() => toggle(t.id, kind, i.id)}
                                className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                              >
                                {on ? "✓ " : "+ "}{i.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <div key={t.id} className="space-y-2 rounded-md border p-3">
                      <div className="font-medium">{t.name}</div>
                      {renderGroup("Medical forms", result.medicalForms, "medical_form_ids")}
                      {renderGroup("Consent forms", result.consents, "consent_ids")}
                      {renderGroup("Aftercare", result.aftercares, "aftercare_ids")}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving…</> : "Save links"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}




