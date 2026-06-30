import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  extractClinicData,
  commitClinicImport,
  type ExtractedDraft,
  type ExtractedCategory,
  type ExtractedTreatment,
  type ExtractedAddon,
  type ExtractedPackage,
  type ExtractedClinic,
} from "@/lib/ai-import.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, FileText, Image as ImageIcon, Globe, Table, Loader2, Wand2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/ai-import")({
  component: AiImportPage,
});

type SourceKind = "pdf" | "image" | "spreadsheet" | "url" | "text";

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

async function spreadsheetToText(file: File): Promise<string> {
  // Tiny CSV / TSV handler; for .xlsx ask user to export as CSV.
  const text = await file.text();
  return text.slice(0, 25000);
}

function AiImportPage() {
  const extract = useServerFn(extractClinicData);
  const commit = useServerFn(commitClinicImport);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [draft, setDraft] = useState<EditableDraft | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof commit>> | null>(null);

  // upload state
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<SourceKind>("pdf");

  async function handleExtract() {
    setBusy(true);
    try {
      let result: ExtractedDraft;
      if (kind === "url") {
        if (!url.trim()) throw new Error("Paste a website URL");
        result = await extract({ data: { url: url.trim() } });
      } else if (kind === "text" || kind === "spreadsheet") {
        let body = text.trim();
        if (kind === "spreadsheet" && file) body = await spreadsheetToText(file);
        if (!body) throw new Error("Paste some content or attach a file");
        result = await extract({ data: { text: body } });
      } else {
        if (!file) throw new Error("Choose a file");
        const dataUrl = await fileToDataUrl(file);
        result = await extract({ data: { file_data_url: dataUrl, file_name: file.name } });
      }
      const total =
        (result.categories?.length ?? 0) +
        (result.treatments?.length ?? 0) +
        (result.addons?.length ?? 0) +
        (result.packages?.length ?? 0);
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
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard"><ArrowLeft className="mr-1 size-4" /> Dashboard</Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="size-5 text-primary" /> Import with AI
        </h1>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Set up your clinic in seconds</CardTitle>
            <p className="text-sm text-muted-foreground">
              Send us your existing price list — PDF, photo, spreadsheet or website — and AI will
              pull out your <b>categories, subcategories, treatments, prices and add-ons</b>. You
              review everything on the next screen before anything saves.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <SourceTile
                icon={<Table className="size-5" />}
                label="Spreadsheet"
                desc="Excel or CSV with treatment, price, duration"
                active={kind === "spreadsheet"}
                onClick={() => setKind("spreadsheet")}
              />
              <SourceTile
                icon={<Globe className="size-5" />}
                label="Website URL"
                desc="Best if you link straight to your treatments / pricing page"
                active={kind === "url"}
                onClick={() => setKind("url")}
              />
            </div>

            {kind === "url" && (
              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourclinic.co.uk/treatments" />
                <p className="text-xs text-muted-foreground">
                  Tip: paste the URL of your <b>treatments or pricing page</b>, not your homepage —
                  you'll get far fewer wrong items. If your homepage doesn't list treatments, AI
                  will sometimes pull nothing rather than guess (that's intentional). Anything that
                  looks wrong on the review screen can be unticked or edited before importing.
                </p>
              </div>
            )}

            {(kind === "pdf" || kind === "image") && (
              <div className="space-y-2">
                <Label>{kind === "pdf" ? "PDF file" : "Image / screenshot"}</Label>
                <Input
                  type="file"
                  accept={kind === "pdf" ? "application/pdf" : "image/*"}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
                <p className="text-xs text-muted-foreground">
                  Clearer source = better result. Make sure prices and treatment names are readable.
                </p>
              </div>
            )}

            {kind === "spreadsheet" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>CSV file</Label>
                  <Input type="file" accept=".csv,text/csv,text/tab-separated-values" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <p className="text-xs text-muted-foreground">Excel? Save as CSV first, or paste rows below.</p>
                </div>
                <div className="space-y-2">
                  <Label>Or paste content</Label>
                  <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"e.g.\nInjectables, Lip filler 1ml, 45, 180\nInjectables, Anti-wrinkle 1 area, 30, 120\nSkin, HydraFacial, 60, 95"} />
                </div>
              </div>
            )}

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
              <li>{summary.packages} packages</li>
              {summary.skipped > 0 && <li className="text-muted-foreground">{summary.skipped} skipped as duplicates</li>}
            </ul>
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
  const includedPk = draft.packages.filter((c) => c._include).length;

  function setRow(key: "categories" | "treatments" | "addons" | "packages", idx: number, patch: Record<string, unknown>) {
    const arr = [...(draft[key] as Array<Record<string, unknown>>)];
    arr[idx] = { ...arr[idx], ...patch };
    setDraft({ ...draft, [key]: arr } as EditableDraft);
  }

  function toggleAll<K extends "categories" | "treatments" | "addons" | "packages">(key: K, value: boolean) {
    setDraft({ ...draft, [key]: draft[key].map((r) => ({ ...r, _include: value })) });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Clinic info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={draft.clinic._include} onCheckedChange={(v) => setDraft({ ...draft, clinic: { ...draft.clinic, _include: !!v } })} id="clinic-inc" />
            <Label htmlFor="clinic-inc" className="text-sm text-muted-foreground">Apply (only fills empty fields on your profile)</Label>
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
        onAll={(v) => toggleAll("categories", v)}
        empty="No categories detected."
        rows={draft.categories.map((c, i) => (
          <Row key={i} included={c._include} onToggle={(v) => setRow("categories", i, { _include: v })}>
            <Input className="md:max-w-xs" value={c.name} onChange={(e) => setRow("categories", i, { name: e.target.value })} placeholder="Name" />
            <Input className="md:max-w-xs" value={c.parent ?? ""} onChange={(e) => setRow("categories", i, { parent: e.target.value || null })} placeholder="Parent (optional)" />
          </Row>
        ))}
      />

      <ListCard
        title={`Treatments (${includedTr}/${draft.treatments.length})`}
        onAll={(v) => toggleAll("treatments", v)}
        empty="No treatments detected."
        rows={draft.treatments.map((t, i) => (
          <Row key={i} included={t._include} onToggle={(v) => setRow("treatments", i, { _include: v })}>
            <Input className="md:max-w-xs" value={t.name} onChange={(e) => setRow("treatments", i, { name: e.target.value })} placeholder="Name" />
            <Input className="md:max-w-[120px]" type="number" value={t.duration_min ?? ""} onChange={(e) => setRow("treatments", i, { duration_min: e.target.value ? Number(e.target.value) : undefined })} placeholder="Mins" />
            <Input className="md:max-w-[120px]" type="number" step="0.01" value={t.price_gbp ?? ""} onChange={(e) => setRow("treatments", i, { price_gbp: e.target.value ? Number(e.target.value) : undefined })} placeholder="£" />
            <Input className="md:max-w-xs" value={t.category ?? ""} onChange={(e) => setRow("treatments", i, { category: e.target.value || null })} placeholder="Category" />
          </Row>
        ))}
      />

      <ListCard
        title={`Add-ons (${includedAd}/${draft.addons.length})`}
        onAll={(v) => toggleAll("addons", v)}
        empty="No add-ons detected."
        rows={draft.addons.map((a, i) => (
          <Row key={i} included={a._include} onToggle={(v) => setRow("addons", i, { _include: v })}>
            <Input className="md:max-w-xs" value={a.name} onChange={(e) => setRow("addons", i, { name: e.target.value })} placeholder="Name" />
            <Input className="md:max-w-[120px]" type="number" step="0.01" value={a.price_gbp ?? ""} onChange={(e) => setRow("addons", i, { price_gbp: e.target.value ? Number(e.target.value) : undefined })} placeholder="£" />
            <Input className="md:max-w-[120px]" type="number" value={a.duration_min ?? ""} onChange={(e) => setRow("addons", i, { duration_min: e.target.value ? Number(e.target.value) : undefined })} placeholder="Mins" />
          </Row>
        ))}
      />

      <ListCard
        title={`Packages (${includedPk}/${draft.packages.length})`}
        onAll={(v) => toggleAll("packages", v)}
        empty="No packages detected."
        rows={draft.packages.map((p, i) => (
          <Row key={i} included={p._include} onToggle={(v) => setRow("packages", i, { _include: v })}>
            <Input className="md:max-w-xs" value={p.name} onChange={(e) => setRow("packages", i, { name: e.target.value })} placeholder="Name" />
            <Input className="md:max-w-[120px]" type="number" step="0.01" value={p.price_gbp ?? ""} onChange={(e) => setRow("packages", i, { price_gbp: e.target.value ? Number(e.target.value) : undefined })} placeholder="£" />
            <Input className="md:max-w-[100px]" type="number" value={p.sessions ?? ""} onChange={(e) => setRow("packages", i, { sessions: e.target.value ? Number(e.target.value) : undefined })} placeholder="Sessions" />
            {p.treatment_names?.length ? <Badge variant="secondary">{p.treatment_names.length} treatments</Badge> : null}
          </Row>
        ))}
      />

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="text-sm text-muted-foreground">
          Importing <b>{includedTr}</b> treatments, <b>{includedCats}</b> categories,{" "}
          <b>{includedAd}</b> add-ons, <b>{includedPk}</b> packages.
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={busy}>Back</Button>
          <Button onClick={onImport} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Importing…</> : "Import to MODO Book"}
          </Button>
        </div>
      </div>
    </>
  );
}

function ListCard({ title, rows, onAll, empty }: { title: string; rows: React.ReactNode[]; onAll: (v: boolean) => void; empty: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex gap-2 text-xs">
          <button className="text-muted-foreground hover:text-foreground" onClick={() => onAll(true)}>Select all</button>
          <span className="text-muted-foreground">·</span>
          <button className="text-muted-foreground hover:text-foreground" onClick={() => onAll(false)}>Deselect all</button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : rows}
      </CardContent>
    </Card>
  );
}

function Row({ included, onToggle, children }: { included: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${included ? "" : "opacity-50"}`}>
      <Checkbox checked={included} onCheckedChange={(v) => onToggle(!!v)} />
      {children}
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
