import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { generateConsentFromUpload } from "@/lib/ai-consent-generate.functions";
import { saveConsentTemplate } from "@/lib/templates.functions";
import type { ConsentSection } from "@/components/ConsentSections";

const MAX_BYTES = 15 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

type Draft = {
  name: string;
  treatment_type: string;
  summary: string;
  requires_signature: boolean;
  sections: ConsentSection[];
};

export function AiGenerateConsentDialog({
  open, onOpenChange, onCreated, isSystem,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  isSystem?: boolean;
}) {
  const generate = useServerFn(generateConsentFromUpload);
  const save = useServerFn(saveConsentTemplate);

  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const [draft, setDraft] = useState<Draft | null>(null);

  function reset() {
    setFiles([]); setNotes(""); setBusy(false); setStep("input"); setDraft(null);
  }

  async function handleGenerate() {
    if (!files.length && !notes.trim()) {
      toast.error("Type a description or upload photos/PDFs.");
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
      setDraft(out);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate consent");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setBusy(true);
    try {
      await save({
        data: {
          name: draft.name,
          treatment_type: draft.treatment_type || null,
          body_markdown: "",
          requires_signature: draft.requires_signature,
          sections: draft.sections as any,
          summary: draft.summary || null,
          is_system: !!isSystem,
        },
      });
      toast.success("Consent form created — open it to fine-tune before use.");
      onCreated();
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const totalBullets = draft?.sections.reduce(
    (n, s) => n + ((s as any).bullets?.length ?? 0), 0,
  ) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Generate consent with AI
          </DialogTitle>
          <DialogDescription>
            Describe the treatment and AI will draft a full consent form. Optionally upload photos or PDFs of an existing consent as a reference.
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Describe the treatment</Label>
              <Textarea
                placeholder={`e.g. "Botox for forehead lines and crow's feet — include risks, contraindications and 24hr aftercare."`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                You can generate purely from a description — uploads are optional.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reference photos or PDFs (optional)</Label>
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
          </div>
        ) : draft ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Treatment type / tag</Label>
              <Input
                value={draft.treatment_type}
                placeholder="e.g. filler, anti_wrinkle"
                onChange={(e) => setDraft({ ...draft, treatment_type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea
                rows={2}
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">
                {draft.sections.length} section{draft.sections.length === 1 ? "" : "s"} · {totalBullets} bullet point{totalBullets === 1 ? "" : "s"}
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {draft.sections.map((s, i) => (
                  <li key={i}>
                    {s.title}
                    {(s as any).bullets?.length ? ` — ${(s as any).bullets.length} bullets` : ""}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Save to add this to your consent forms — you can then open it in the editor to fine-tune every section.
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
              <Button onClick={handleSave} disabled={busy || !draft?.name.trim()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save consent form
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
