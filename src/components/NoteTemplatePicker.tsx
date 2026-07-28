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
              Pick a starting point — it drops straight into the note and stays fully editable.
              Square brackets mark the bits to fill in.
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

          <div className="-mx-1 max-h-[55vh] space-y-4 overflow-y-auto px-1 pb-1">
            {grouped.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">No templates match “{q}”.</p>
            )}
            {grouped.map(([category, items]) => (
              <div key={category} className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </div>
                {items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onInsert(t.body);
                      setOpen(false);
                      setQ("");
                    }}
                    className="w-full rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] leading-snug text-muted-foreground">
                      {t.body}
                    </div>
                  </button>
                ))}
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
