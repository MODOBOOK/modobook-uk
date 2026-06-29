import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown, X, ListChecks } from "lucide-react";

export type ConsentSection = {
  title: string;
  body?: string;
  bullets?: string[];
};

/** Modern, sectioned read-only rendering of a consent template. */
export function ConsentSectionsView({
  sections,
  summary,
  fallbackBody,
}: {
  sections?: ConsentSection[] | null;
  summary?: string | null;
  fallbackBody?: string | null;
}) {
  const hasSections = Array.isArray(sections) && sections.length > 0;
  if (!hasSections) {
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 text-sm">
        {fallbackBody || summary || "No consent text provided."}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {summary && (
        <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed text-foreground/80">
          {summary}
        </p>
      )}
      {sections!.map((s, i) => (
        <section
          key={i}
          className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {i + 1}
            </span>
            <h3 className="text-sm font-semibold tracking-tight">{s.title}</h3>
          </header>
          <div className="space-y-2 px-4 py-3 text-sm leading-relaxed">
            {s.body && <p className="text-foreground/85">{s.body}</p>}
            {Array.isArray(s.bullets) && s.bullets.length > 0 && (
              <ul className="space-y-1.5">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span className="text-foreground/80">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Inline editor for an array of consent sections. */
export function ConsentSectionsEditor({
  value,
  onChange,
  disabled,
}: {
  value: ConsentSection[];
  onChange: (v: ConsentSection[]) => void;
  disabled?: boolean;
}) {
  function update(i: number, patch: Partial<ConsentSection>) {
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { title: "New section", body: "" }]);
  }
  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          No sections yet. Add your first section below.
        </p>
      )}
      {value.map((s, i) => (
        <Card key={i} className="border-muted">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <CardTitle className="text-sm">Section</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" disabled={disabled} onClick={() => remove(i)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <Input
              value={s.title}
              disabled={disabled}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Section title (e.g. Risks & complications)"
            />
            <Textarea
              rows={3}
              value={s.body ?? ""}
              disabled={disabled}
              onChange={(e) => update(i, { body: e.target.value })}
              placeholder="Optional paragraph explaining this section."
            />
            <BulletEditor
              value={s.bullets ?? []}
              disabled={disabled}
              onChange={(b) => update(i, { bullets: b })}
            />
          </CardContent>
        </Card>
      ))}
      {!disabled && (
        <Button type="button" size="sm" variant="outline" onClick={add} className="w-full">
          <Plus className="mr-1 h-4 w-4" /> Add section
        </Button>
      )}
    </div>
  );
}

function BulletEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft("");
  }
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <ListChecks className="h-3 w-3" /> Bullet points
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((b, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs"
          >
            {b}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Type a bullet then press Enter"
            className="h-8 text-xs"
          />
          <Button type="button" size="sm" variant="outline" onClick={add}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
