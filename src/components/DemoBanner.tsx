import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "modo-demo-notice-seen";

/**
 * Shown once per session as a popup when the current profile is flagged
 * is_demo. Pure presentational — parent decides whether demo mode applies;
 * this component decides whether the notice has already been seen.
 */
export function DemoBanner({ role = "practitioner" }: { role?: "practitioner" | "patient" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Demo mode notice"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200/70">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <h2 className="text-base font-semibold">You're in demo mode</h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss demo notice"
            className="rounded-full p-1 text-amber-900/60 hover:bg-amber-200/60 hover:text-amber-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed">
          You're viewing the MODO demo {role} account. File uploads and adding
          new patients are disabled; emails, SMS and payments are mocked.
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          Please don't enter real patient data. Demo data resets nightly.
        </p>
        <Button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full bg-amber-900 text-amber-50 hover:bg-amber-800"
        >
          Got it — explore the demo
        </Button>
      </div>
    </div>
  );
}
