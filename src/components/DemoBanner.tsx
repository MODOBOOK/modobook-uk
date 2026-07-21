import { Sparkles } from "lucide-react";

/**
 * Shown at the top of the app when the current profile is flagged is_demo.
 * Pure presentational — parent decides visibility.
 */
export function DemoBanner({ role = "practitioner" }: { role?: "practitioner" | "patient" }) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-950 shadow-sm">
      <Sparkles className="h-3.5 w-3.5" />
      <span>
        Demo mode — you're viewing the MODO demo {role} account. Emails, SMS and
        payments are mocked. Data resets nightly.
      </span>
    </div>
  );
}
