import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/SafeHtml";
import { getLeafletSignedUrl } from "@/lib/leaflets.functions";

/** "Information leaflet" pill + pop-up (text and/or PDF) for the public booking page. */
export function TreatmentLeafletButton({
  name,
  title,
  html,
  url,
  brand,
}: {
  name: string;
  title?: string | null;
  html?: string | null;
  url?: string | null;
  brand: string;
}) {
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const leafletUrl = url || "";
  const leafletTitle = title || `${name} — information`;

  useEffect(() => {
    if (!open || !leafletUrl) return;
    if (!leafletUrl.startsWith("storage:")) {
      setPdfUrl(leafletUrl);
      return;
    }
    let cancelled = false;
    getLeafletSignedUrl({ data: { path: leafletUrl } })
      .then((r) => {
        if (!cancelled) setPdfUrl(r.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, leafletUrl]);

  if (!html && !leafletUrl) return null;

  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80"
        style={{ borderColor: `${brand}55`, color: brand }}
      >
        <Info className="h-3.5 w-3.5" />
        Information leaflet
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{leafletTitle}</DialogTitle>
            <DialogDescription>Patient information for {name}</DialogDescription>
          </DialogHeader>
          {html && (
            <SafeHtml html={html} className="prose prose-sm max-w-none whitespace-pre-line text-sm leading-relaxed" />
          )}
          {leafletUrl &&
            (pdfUrl ? (
              <div className="space-y-2">
                <iframe src={pdfUrl} title={leafletTitle} className="h-[55vh] w-full rounded-md border" />
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold underline"
                  style={{ color: brand }}
                >
                  Open full leaflet (PDF)
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading leaflet…</p>
            ))}
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </span>
  );
}
