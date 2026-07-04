import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { generateAftercareFromUpload } from "@/lib/ai-aftercare-generate.functions";

const MAX_BYTES = 15 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

export function AiGenerateAftercareDialog({
  open, onOpenChange, onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerated: (out: { name: string; delay_hours: number; body_html: string }) => void;
}) {
  const generate = useServerFn(generateAftercareFromUpload);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() { setFiles([]); setNotes(""); setBusy(false); }

  async function handleGenerate() {
    if (!files.length && !notes.trim()) {
      toast.error("Upload photos/PDFs or type notes describing the aftercare.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) { toast.error(`"${tooBig.name}" is too large (max 15MB).`); return; }
    setBusy(true);
    try {
      const encoded = await Promise.all(
        files.map(async (f) => ({ dataUrl: await readFileAsDataUrl(f), name: f.name })),
      );
      const out = await generate({ data: { files: encoded, notes } });
      onGenerated(out);
      onOpenChange(false);
      reset();
      toast.success("Aftercare drafted — review and save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Generate aftercare with AI
          </DialogTitle>
          <DialogDescription>
            Describe the treatment or upload an existing aftercare sheet. AI will draft
            clear, sectioned aftercare you can review and edit before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Upload photos or PDFs (optional)</Label>
            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
              <Upload className="h-5 w-5" />
              <span>{files.length ? "Add more files" : "Click to choose files"}</span>
              <span className="text-xs">JPG, PNG or PDF · up to 15MB each</span>
              <input type="file" accept="image/*,application/pdf" multiple className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) setFiles((prev) => [...prev, ...picked]);
                  e.currentTarget.value = "";
                }} />
            </label>
          </div>

          <div className="space-y-2">
            <Label>Describe the aftercare</Label>
            <Textarea
              placeholder='e.g. "Lip filler aftercare — swelling for 48h, avoid heat/exercise 24h, no makeup on the area for 12h, when to call us."'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
