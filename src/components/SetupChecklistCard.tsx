import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { getSetupChecklist, type SetupStep } from "@/lib/setup-checklist.functions";

export function SetupChecklistCard() {
  const fetchChecklist = useServerFn(getSetupChecklist);
  const [data, setData] = useState<{ steps: SetupStep[]; done: number; total: number } | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetchChecklist()
      .then((d) => setData(d as { steps: SetupStep[]; done: number; total: number }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data || data.total === 0) return null;
  const complete = data.done === data.total;
  // Once every step is done the clinic is set up — the card disappears for good.
  if (complete) return null;

  const pct = Math.round((data.done / data.total) * 100);

  return (
    <Card className="border-accent/40 bg-gradient-to-br from-accent/10 via-background to-background shadow-luxe">
      <CardContent className="p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Getting started
            </p>
            <h2 className="mt-1 truncate font-serif text-xl sm:text-2xl">
              {complete ? "Your clinic is ready" : `${data.done} of ${data.total} steps done`}
            </h2>
          </div>
          <ChevronDown
            className={`size-5 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
          />
        </button>

        <Progress value={pct} className="mt-4 h-2" />

        {open && (
          <div className="mt-4 space-y-2">
            {!complete && (
              <Link
                to="/dashboard/ai-import"
                className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 transition hover:border-primary/60"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Set up faster with AI</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Upload a price list, PDF or website and we'll fill things in
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            )}

            {data.steps.map((s) => (
              <Link
                key={s.key}
                to={s.to}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition hover:border-accent"
              >
                <div
                  className={`grid size-7 shrink-0 place-items-center rounded-full border ${
                    s.done ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {s.done ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-muted-foreground/40" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>
                    {s.label}
                  </p>
                  {!s.done && <p className="truncate text-xs text-muted-foreground">{s.description}</p>}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}

          </div>
        )}
      </CardContent>
    </Card>
  );
}
