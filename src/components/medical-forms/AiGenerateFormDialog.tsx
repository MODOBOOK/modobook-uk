import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { generateFormFromUpload } from "@/lib/ai-form-generate.functions";
import { saveForm } from "@/lib/medical-forms.functions";

const MAX_BYTES = 15 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

export function AiGenerateFormDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const generate = useServerFn(generateFormFromUpload);
  const save = useServerFn(saveForm);

  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const [preview, setPreview] = useState<{ name: string; description: string; schema: any } | null>(null);

  function reset() {
    setFiles([]); setNotes(""); setBusy(false); setStep("input"); setPreview(null);
  }

  async function handleGenerate() {
    if (!files.length && !notes.trim()) {
      toast.error("Upload photos/PDFs or type notes describing the form.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" is too large (max 15MB).`);
      return;
    }
    setBusy(true);
    try {
      const encoded = await Promise.all(
        files.map(async (f) => ({ dataUrl: await readFileAsDataUrl(f), name: f.name })),
      );
      const out = await generate({ data: { files: encoded, notes } });
      setPreview(out);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate form");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setBusy(true);
    try {
      await save({ data: {
        name: preview.name,
        description: preview.description || null,
        schema: preview.schema,
        validity: "always_required",
        treatment_ids: [],
      } });
      toast.success("Form created — open it to edit anything.");
      onCreated();
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const totalFields = preview?.schema?.steps?.reduce(
    (n: number, s: any) => n + (Array.isArray(s.elements) ? s.elements.length : 0), 0,
  ) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Generate form with AI
          </DialogTitle>
          <DialogDescription>
            Upload a photo or PDF of an existing form, or describe it in words.
            AI will draft a form you can review and edit.
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload photos or PDFs</Label>
              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span className="truncate">{f.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
                <Upload className="h-5 w-5" />
                <span>{files.length ? "Add more files" : "Click to choose files"}</span>
                <span className="text-xs">JPG, PNG or PDF · up to 15MB each · multiple allowed</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    if (picked.length) setFiles((prev) => [...prev, ...picked]);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>


            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder='e.g. "Botox consultation form with medical history, allergies, pregnancy check and consent signature."'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Form name</Label>
              <Input value={preview.name} onChange={(e) => setPreview({ ...preview, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={preview.description} onChange={(e) => setPreview({ ...preview, description: e.target.value })} />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">
                {preview.schema.steps.length} step{preview.schema.steps.length === 1 ? "" : "s"} · {totalFields} element{totalFields === 1 ? "" : "s"}
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {preview.schema.steps.map((s: any, i: number) => (
                  <li key={i}>{s.title} — {s.elements.length} field{s.elements.length === 1 ? "" : "s"}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Save to add this to your forms — you can then open it in the editor to fine-tune every field.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          {step === "input" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("input")} disabled={busy}>Back</Button>
              <Button onClick={handleSave} disabled={busy || !preview?.name.trim()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save form
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
