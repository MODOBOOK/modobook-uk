import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bulkSetRebookReminders } from "@/lib/treatments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";

type Item = {
  id: string;
  name: string;
  category_id: string | null;
  rebook_reminder_days?: number | null;
  topup_reminder_days?: number | null;
};

const PRESETS = [
  { label: "Anti-wrinkle · 12 weeks", rebook: 84, topup: null as number | null },
  { label: "Filler · 9 months", rebook: 270, topup: 180 },
  { label: "Skin booster · 6 months", rebook: 180, topup: 120 },
  { label: "Skincare / peels · 6 weeks", rebook: 42, topup: null as number | null },
];

export function BulkRebookRemindersDialog({
  treatments,
  categoryLabel,
  onSaved,
}: {
  treatments: Item[];
  categoryLabel: (id: string | null) => string;
  onSaved: () => void;
}) {
  const bulk = useServerFn(bulkSetRebookReminders);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [rebook, setRebook] = useState("");
  const [topup, setTopup] = useState("");
  const [clearTopup, setClearTopup] = useState(false);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Item[]>();
    for (const t of treatments) {
      if (q && !t.name.toLowerCase().includes(q)) continue;
      const key = t.category_id ?? "__none__";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [treatments, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function apply() {
    if (selected.size === 0) {
      toast.error("Select at least one treatment");
      return;
    }
    if (rebook.trim() === "" && topup.trim() === "" && !clearTopup) {
      toast.error("Enter a reminder interval");
      return;
    }
    setSaving(true);
    try {
      await bulk({
        data: {
          ids: Array.from(selected),
          ...(rebook.trim() === "" ? {} : { rebook_reminder_days: Number(rebook) }),
          ...(clearTopup
            ? { topup_reminder_days: null }
            : topup.trim() === ""
              ? {}
              : { topup_reminder_days: Number(topup) }),
        },
      });
      toast.success(`Reminders updated for ${selected.size} treatment${selected.size === 1 ? "" : "s"}`);
      setOpen(false);
      setSelected(new Set());
      setRebook("");
      setTopup("");
      setClearTopup(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update reminders");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BellRing className="mr-2 h-4 w-4" /> Rebook reminders
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set rebook reminders in bulk</DialogTitle>
          <DialogDescription>
            Pick as many treatments as you like, then set when patients should be reminded. Blank fields are left
            unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="bulk-rebook" className="text-xs text-muted-foreground">
                Rebook reminder — days after appointment
              </Label>
              <Input
                id="bulk-rebook"
                type="number"
                min={1}
                placeholder="e.g. 84"
                value={rebook}
                onChange={(e) => setRebook(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bulk-topup" className="text-xs text-muted-foreground">
                Top-up reminder — days after (optional)
              </Label>
              <Input
                id="bulk-topup"
                type="number"
                min={1}
                placeholder="e.g. 56"
                value={topup}
                disabled={clearTopup}
                onChange={(e) => setTopup(e.target.value)}
              />
              <label className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Checkbox checked={clearTopup} onCheckedChange={(v) => setClearTopup(v === true)} />
                Remove top-up reminder from selected
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setRebook(String(p.rebook));
                  setClearTopup(false);
                  setTopup(p.topup == null ? "" : String(p.topup));
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search treatments…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set(treatments.map((t) => t.id)))}
              >
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>

            <div className="max-h-72 space-y-4 overflow-y-auto rounded-md border p-3">
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No treatments match.</p>
              ) : (
                groups.map(([catId, list]) => {
                  const ids = list.map((t) => t.id);
                  const allOn = ids.every((id) => selected.has(id));
                  return (
                    <div key={catId} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {catId === "__none__" ? "Uncategorised" : categoryLabel(catId)}
                        </p>
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground underline"
                          onClick={() => toggleGroup(ids, !allOn)}
                        >
                          {allOn ? "Deselect" : "Select"} all
                        </button>
                      </div>
                      {list.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                          <span className="flex-1">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {t.rebook_reminder_days ? `${t.rebook_reminder_days}d` : "—"}
                            {t.topup_reminder_days ? ` · top-up ${t.topup_reminder_days}d` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <span className="mr-auto text-xs text-muted-foreground">{selected.size} selected</span>
          <Button onClick={apply} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply to selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
