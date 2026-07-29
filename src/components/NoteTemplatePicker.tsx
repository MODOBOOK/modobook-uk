import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Search } from "lucide-react";
import { templatesForScope, type NoteTemplate } from "@/lib/note-templates";

type Scope = NonNullable<NoteTemplate["scope"]>[number];

interface Props {
  /** Called with the template text — insert or append into your field. */
  onInsert: (text: string) => void;
  scope?: Scope;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
}

export function NoteTemplatePicker({
  onInsert,
  scope = "note",
  label = "Use a template",
  size = "sm",
  variant = "outline",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const templates = useMemo(() => templatesForScope(scope), [scope]);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter(
      (t) =>
        t.label.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.body.toLowerCase().includes(query),
    );
  }, [templates, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, NoteTemplate[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <FileText className="mr-1 h-3.5 w-3.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Note templates</DialogTitle>
            <DialogDescription>
              Pick one — it drops straight into the note, fully written and still editable.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search treatments…"
              className="h-9 pl-8 text-sm"
            />
          </div>

          <div className="-mx-1 max-h-[55vh] overflow-y-auto px-1 pb-1">
            {grouped.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">No templates match “{q}”.</p>
            )}
            {grouped.map(([category, items]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="sticky top-0 z-10 bg-background py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </div>
                <div className="divide-y rounded-lg border">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.body.replace(/\s+/g, " ").trim()}
                      onClick={() => {
                        onInsert(t.body);
                        setOpen(false);
                        setQ("");
                      }}
                      style={{ height: 34 }}
                      className="flex w-full items-center overflow-hidden bg-card px-3 text-left leading-none transition hover:bg-primary/5"
                    >
                      <span className="block max-w-full truncate whitespace-nowrap text-sm font-medium">
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>

              </div>
            ))}
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}

/** Append template text to existing content with sensible spacing. */
export function appendTemplate(current: string, text: string) {
  const base = (current ?? "").trimEnd();
  return base ? `${base}\n\n${text}` : text;
}
