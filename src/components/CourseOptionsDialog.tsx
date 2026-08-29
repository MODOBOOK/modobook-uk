import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createCourseTreatmentOption, updateTreatment } from "@/lib/treatments.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Layers, Plus, Save, Sparkles, Unlink } from "lucide-react";

export type CourseTreatment = {
  id: string;
  name: string;
  duration: number;
  price: number;
  description?: string | null;
  category_id: string | null;
  course_group?: string | null;
  course_groups?: string[] | null;
  course_recommended?: boolean | null;
  session_count?: number | null;
  allow_split_payment?: boolean | null;
  session_interval_days?: number | null;
  course_unit_label?: string | null;
  course_cta_label?: string | null;
  course_option_label?: string | null;
};

function groupsOf(t: CourseTreatment): string[] {
  const arr = (t.course_groups ?? []).map((g) => g.trim()).filter(Boolean);
  if (arr.length) return arr;
  const single = (t.course_group ?? "").trim();
  return single ? [single] : [];
}

function isSessionLabel(value: string) {
  return /^(?:single|\d+)\s+sessions?(?:\s|$)/i.test(value.trim());
}

function baseTreatmentName(name: string) {
  return name
    .replace(/\s*[—-]\s*(?:single|\d+)\s+sessions?$/i, "")
    .replace(/\s+(?:single|\d+)\s+sessions?$/i, "")
    .trim();
}

const SESSION_WORDS: Record<string, number> = {
  single: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

function sessionCountFromLabel(value: string): number | null {
  const numeric = value.match(/\d+/)?.[0];
  if (numeric) return Math.max(1, Math.floor(Number(numeric)));
  const words = value.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const word of words) {
    if (SESSION_WORDS[word]) return SESSION_WORDS[word];
  }
  return null;
}

function sessionLabelFrom(t: CourseTreatment): string {
  const savedLabel = (t.course_option_label ?? "").trim();
  if (savedLabel) return savedLabel;
  const suffix = t.name.split(/\s+—\s+/).at(-1)?.trim();
  if (suffix && suffix !== t.name && sessionCountFromLabel(suffix)) return suffix;
  const count = t.session_count ?? 1;
  return `${count} session${count === 1 ? "" : "s"}`;
}

type Draft = {
  id: string;
  sessions: string;
  count: string;
  price: string;
  weeks: string;
  split: boolean;
  recommended: boolean;
  saving: boolean;
};

function draftFrom(t: CourseTreatment): Draft {
  const days = t.session_interval_days ?? 0;
  return {
    id: t.id,
    sessions: sessionLabelFrom(t),
    count: String(t.session_count ?? sessionCountFromLabel(sessionLabelFrom(t)) ?? 1),
    price: String(t.price ?? 0),
    weeks: days > 0 ? String(Math.round(days / 7)) : "",
    split: Boolean(t.allow_split_payment),
    recommended: Boolean(t.course_recommended),
    saving: false,
  };
}

/**
 * Manage every session option of a course in one place. Each option loads as
 * its own editable row (sessions, price, split payment, spacing, recommended)
 * instead of a chain of prompts.
 */
export function CourseOptionsDialog({
  treatment,
  allTreatments,
  onSaved,
}: {
  treatment: CourseTreatment;
  allTreatments: CourseTreatment[];
  onSaved: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Layers className="mr-1.5 h-4 w-4" /> Course options
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Course options</DialogTitle>
          <DialogDescription>
            Each session amount has its own price, payment setting and spacing.
          </DialogDescription>
        </DialogHeader>
        <CourseOptionsEditor treatment={treatment} allTreatments={allTreatments} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

export function CourseOptionsEditor({
  treatment,
  allTreatments,
  onSaved,
}: {
  treatment: CourseTreatment;
  allTreatments: CourseTreatment[];
  onSaved: () => void | Promise<void>;
}) {
  const createOption = useServerFn(createCourseTreatmentOption);
  const update = useServerFn(updateTreatment);
  const [newSessions, setNewSessions] = useState("3");
  const [unitLabel, setUnitLabel] = useState(
    (treatment.course_unit_label ?? "").trim() || "sessions",
  );
  const [ctaLabel, setCtaLabel] = useState((treatment.course_cta_label ?? "").trim());
  const [savingWording, setSavingWording] = useState(false);

  const groupName = useMemo(() => {
    const existing = groupsOf(treatment).find((group) => !isSessionLabel(group));
    return existing || baseTreatmentName(treatment.name);
  }, [treatment]);

  const matchingOptions = useMemo(() => {
    const inGroup = allTreatments.filter((t) => {
      const explicitGroup = groupsOf(t).find((group) => !isSessionLabel(group));
      return (explicitGroup || baseTreatmentName(t.name)) === groupName && groupsOf(t).length > 0;
    });
    const list = inGroup.length ? inGroup : [treatment];
    return [...list].sort(
      (a, b) => (a.session_count ?? 1) - (b.session_count ?? 1) || a.price - b.price,
    );
  }, [allTreatments, groupName, treatment]);
  const [options, setOptions] = useState<CourseTreatment[]>(matchingOptions);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(matchingOptions.slice(0, 1).map((option) => option.id)),
  );

  useEffect(() => {
    setOptions((current) => {
      const byId = new Map(current.map((option) => [option.id, option]));
      for (const option of matchingOptions) byId.set(option.id, option);
      return [...byId.values()].sort(
        (a, b) => (a.session_count ?? 1) - (b.session_count ?? 1) || a.price - b.price,
      );
    });
  }, [matchingOptions]);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftFor = (t: CourseTreatment) => drafts[t.id] ?? draftFrom(t);
  const patch = (id: string, t: CourseTreatment, next: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? draftFrom(t)), ...next } }));

  async function saveOption(t: CourseTreatment) {
    const d = draftFor(t);
    const sessionLabel = d.sessions.trim();
    const sessions = sessionCountFromLabel(sessionLabel) ?? 1;
    if (!sessionLabel) {
      toast.error("Give this option a name");
      return;
    }
    const price = Number(d.price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    const weeks = d.weeks.trim() ? Number(d.weeks) : 0;
    if (!Number.isFinite(weeks) || weeks < 0) {
      toast.error("Enter a valid number of weeks between sessions");
      return;
    }
    patch(t.id, t, { saving: true });
    try {
      if (t.id.startsWith("new-")) {
        const created = await createOption({
          data: {
            baseTreatmentId: treatment.id,
            groupName,
            sessions,
            optionLabel: sessionLabel,
            price,
            split: sessions > 1 ? d.split : false,
            intervalDays: weeks > 0 ? Math.round(weeks * 7) : null,
            recommended: d.recommended,
          },
        }) as CourseTreatment;
        const savedName = `${groupName} — ${sessionLabel}`;
        await update({
          data: {
            id: created.id,
            name: savedName,
            course_option_label: sessionLabel,
            course_unit_label: unitLabel.trim() || "sessions",
            course_cta_label: ctaLabel.trim() || null,
          },
        });
        created.name = savedName;
        setOptions((current) => current
          .map((option) => option.id === t.id ? created : option)
          .sort((a, b) => (a.session_count ?? 1) - (b.session_count ?? 1) || a.price - b.price));
        setExpandedIds((current) => {
          const next = new Set(current);
          next.delete(t.id);
          next.add(created.id);
          return next;
        });
        setDrafts((current) => {
          const next = { ...current, [created.id]: draftFrom(created) };
          delete next[t.id];
          return next;
        });
        toast.success(`${sessions} session option saved`);
        await onSaved();
        return;
      }
      await update({
        data: {
          id: t.id,
          name: `${groupName} — ${sessionLabel}`,
          course_option_label: sessionLabel,
          price,
          session_count: sessions,
          allow_split_payment: sessions > 1 ? d.split : false,
          session_interval_days: weeks > 0 ? Math.round(weeks * 7) : null,
          course_recommended: d.recommended,
          course_group: groupName,
          course_groups: [groupName],
          course_unit_label: unitLabel.trim() || "sessions",
          course_cta_label: ctaLabel.trim() || null,
        },
      });
      setOptions((current) =>
        current.map((option) =>
          option.id === t.id
            ? {
                ...option,
                 name: `${groupName} — ${sessionLabel}`,
                course_option_label: sessionLabel,
                price,
                session_count: sessions,
                allow_split_payment: sessions > 1 ? d.split : false,
                session_interval_days: weeks > 0 ? Math.round(weeks * 7) : null,
                course_recommended: d.recommended,
                course_group: groupName,
                course_groups: [groupName],
              }
            : option,
        ),
      );
      toast.success(`${sessions} session option saved`);
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save option");
    } finally {
      patch(t.id, t, { saving: false });
    }
  }

  async function removeFromCourse(t: CourseTreatment) {
    if (t.id.startsWith("new-")) {
      setOptions((current) => current.filter((option) => option.id !== t.id));
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(t.id);
        return next;
      });
      return;
    }
    if (!confirm("Remove this option from the course? The treatment itself stays.")) return;
    try {
      await update({ data: { id: t.id, course_group: null, course_groups: [] } });
      setOptions((current) => current.filter((option) => option.id !== t.id));
      toast.success("Option removed from course");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove option");
    }
  }

  function addOption() {
    const sessionLabel = newSessions.trim();
    const sessions = sessionCountFromLabel(sessionLabel) ?? 1;
    if (!sessionLabel) {
      toast.error("Give this option a name");
      return;
    }
    const norm = (v: string) => v.trim().toLowerCase();
    if (options.some((option) => norm(sessionLabelFrom(option)) === norm(sessionLabel))) {
      toast.error("An option with that exact name already exists. Give this one a different name.");
      return;
    }
    const id = `new-${Date.now()}`;
    const option: CourseTreatment = {
      ...treatment,
      id,
      name: `${groupName} — ${sessionLabel}`,
      course_option_label: sessionLabel,
      price: 0,
      session_count: sessions,
      allow_split_payment: false,
      session_interval_days: null,
      course_recommended: false,
      course_group: groupName,
      course_groups: [groupName],
    };
    setOptions((current) => [...current, option].sort(
      (a, b) => (a.session_count ?? 1) - (b.session_count ?? 1) || a.price - b.price,
    ));
    setDrafts((current) => ({ ...current, [id]: { ...draftFrom(option), sessions: sessionLabel } }));
    setExpandedIds((current) => new Set(current).add(id));
    setNewSessions("");
  }

  async function saveWording() {
    const unit = unitLabel.trim() || "sessions";
    const cta = ctaLabel.trim();
    setSavingWording(true);
    try {
      await Promise.all(
        options
          .filter((o) => !o.id.startsWith("new-"))
          .map((o) => update({ data: { id: o.id, course_unit_label: unit, course_cta_label: cta || null } })),
      );
      setOptions((current) =>
        current.map((o) => ({ ...o, course_unit_label: unit, course_cta_label: cta || null })),
      );
      toast.success("Wording saved");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save wording");
    } finally {
      setSavingWording(false);
    }
  }

  const unitPreview = unitLabel.trim() || "sessions";

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-sm font-semibold">{groupName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add a session amount, then open its section to set the price, payment choice and spacing.
        </p>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-semibold">Wording</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">What are you selling?</Label>
            <Input
              value={unitLabel}
              onChange={(e) => setUnitLabel(e.target.value)}
              placeholder="sessions, areas, mls"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Button / pop-up title</Label>
            <Input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder={`Choose your ${unitPreview}`}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Clients will see “{ctaLabel.trim() || `Choose your ${unitPreview}`}” on the treatment and in the pop-up.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={saveWording} disabled={savingWording}>
          <Save className="mr-1.5 h-4 w-4" /> {savingWording ? "Saving…" : "Save wording"}
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs">Session option</Label>
          <Input
            type="text"
            placeholder="e.g. Premium, Three sessions"
            value={newSessions}
            onChange={(e) => setNewSessions(e.target.value)}
          />
        </div>
        <Button type="button" onClick={addOption}>
          <Plus className="mr-1.5 h-4 w-4" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {options.map((o) => {
          const d = draftFor(o);
          const sessions = sessionCountFromLabel(d.sessions) ?? o.session_count ?? 1;
          const price = Number(d.price) || 0;
          const per = price / Math.max(1, sessions);
          const expanded = expandedIds.has(o.id);
          return (
            <div key={o.id} className="overflow-hidden rounded-md border bg-background">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setExpandedIds((current) => {
                  const next = new Set(current);
                  if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                  return next;
                })}
                className="h-auto w-full justify-between gap-3 rounded-none p-3 text-left hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{d.sessions || `${sessions} sessions`}</p>
                    {d.recommended && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                        <Sparkles className="h-3 w-3" /> Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {price > 0 ? `£${price.toFixed(2)} total · £${per.toFixed(2)} per session` : "Open to add price and details"}
                  </p>
                </div>
                {expanded ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
              </Button>

              {expanded && (
                <div className="space-y-3 border-t p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Session option</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Course of three"
                        value={d.sessions}
                        onChange={(e) => patch(o.id, o, { sessions: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total price (£)</Label>
                      <Input type="number" min={0} step="0.01" value={d.price} onChange={(e) => patch(o.id, o, { price: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Weeks apart</Label>
                      <Input type="number" min={0} placeholder="e.g. 4" value={d.weeks} onChange={(e) => patch(o.id, o, { weeks: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={d.split && sessions > 1} disabled={sessions <= 1} onCheckedChange={(v) => patch(o.id, o, { split: v })} />
                      Split payment
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={d.recommended} onCheckedChange={(v) => patch(o.id, o, { recommended: v })} />
                      Recommended
                    </label>
                    <div className="ml-auto flex items-center gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeFromCourse(o)}>
                        <Unlink className="mr-1.5 h-4 w-4" /> Remove
                      </Button>
                      <Button type="button" size="sm" disabled={d.saving} onClick={() => saveOption(o)}>
                        <Save className="mr-1.5 h-4 w-4" /> {d.saving ? "Saving…" : "Save option"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CourseOptionsDialog;
