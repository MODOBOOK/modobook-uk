import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchActiveTerms,
  hasAcceptedCurrentTerms,
  recordTermsAcceptance,
  type ActiveTerms,
} from "@/lib/platform-terms";

export function TermsAcceptanceGate() {
  const [terms, setTerms] = useState<ActiveTerms | null>(null);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let accepted = false;
      try {
        accepted = await hasAcceptedCurrentTerms();
      } catch {
        // If the check fails, fall through and prompt anyway.
      }
      if (accepted || cancelled) return;
      try {
        const active = await fetchActiveTerms();
        if (!active || cancelled) return;
        setTerms(active);
        setOpen(true);
      } catch {
        // silent — don't block the app if terms can't be loaded
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  const accept = async () => {
    if (!terms || !checked) return;
    setSubmitting(true);
    try {
      await recordTermsAcceptance(terms.id, "dashboard_gate");
      setOpen(false);
      toast.success("Terms accepted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record acceptance");
    } finally {
      setSubmitting(false);
    }
  };

  if (!terms) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Block closing without acceptance
        if (!v) return;
        setOpen(v);
      }}
    >
      <DialogContent
        className="max-w-2xl p-0 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Updated Terms & Conditions</DialogTitle>
          <DialogDescription>
            Please review and accept version {terms.version} to continue using MODO.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
          <article className="prose prose-sm max-w-none [&_h1]:mt-0 [&_h2]:mt-6 [&_p]:leading-relaxed">
            <ReactMarkdown>{terms.body_markdown}</ReactMarkdown>
          </article>
        </div>
        <div className="border-t bg-muted/40 px-6 py-4">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(Boolean(v))}
              className="mt-0.5"
            />
            <span>
              I confirm I am the account holder, I have read the Terms & Conditions
              (v{terms.version}), and I accept them on behalf of my clinic.
            </span>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Open in new tab
            </a>
            <Button onClick={accept} disabled={!checked || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept and continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
