import { Info } from "lucide-react";

/**
 * Subtle reminder banner shown at the top of editable pages
 * to prompt users to save their work after making changes.
 */
export function SaveReminder({ message }: { message?: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground/80"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        {message ?? "Remember to save your changes — scroll to the bottom of the page and tap Save when you're done editing."}
      </span>
    </div>
  );
}
