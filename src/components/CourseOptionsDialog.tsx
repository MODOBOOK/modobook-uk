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
import { Layers, Plus, Save, Sparkles, Unlink } from "lucide-react";

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

type Draft = {
  id: string;
  sessions: string;
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
    sessions: String(t.session_count ?? 1),
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
  const [adding, setAdding] = useState(false);
  const [newSessions, setNewSessions] = useState("3");
  const [newPrice, setNewPrice] = useState("");
  const [newWeeks, setNewWeeks] = useState("");
  const [newSplit, setNewSplit] = useState(false);
  const [newRecommended, setNewRecommended] = useState(false);

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
    const sessions = Math.max(1, Math.floor(Number(d.sessions) || 1));
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
      await update({
        data: {
          id: t.id,
          price,
          session_count: sessions,
          allow_split_payment: sessions > 1 ? d.split : false,
          session_interval_days: weeks > 0 ? Math.round(weeks * 7) : null,
          course_recommended: d.recommended,
          course_group: groupName,
          course_groups: [groupName],
        },
      });
      setOptions((current) =>
        current.map((option) =>
          option.id === t.id
            ? {
                ...option,
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

  async function addOption() {
    const sessions = Math.max(1, Math.floor(Number(newSessions) || 1));
    const price = Number(newPrice);
    const weeks = newWeeks.trim() ? Number(newWeeks) : 0;
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter the total price for this option");
      return;
    }
    if (!Number.isFinite(weeks) || weeks < 0) {
      toast.error("Enter a valid number of weeks");
      return;
    }
    if (options.some((option) => (option.session_count ?? 1) === sessions)) {
      toast.error(`A ${sessions}-session option already exists. Edit its price above.`);
      return;
    }
    setAdding(true);
    try {
      const created = await createOption({
        data: {
          baseTreatmentId: treatment.id,
          groupName,
          sessions,
          price,
          split: newSplit,
          intervalDays: weeks > 0 ? Math.round(weeks * 7) : null,
          recommended: newRecommended,
        },
      });
      const createdOption = created as CourseTreatment;
      setOptions((current) =>
        [...current.map((option) =>
          option.id === treatment.id
            ? { ...option, course_group: groupName, course_groups: [groupName] }
            : option,
        ), createdOption].sort(
          (a, b) => (a.session_count ?? 1) - (b.session_count ?? 1) || a.price - b.price,
        ),
      );
      setDrafts((current) => ({ ...current, [createdOption.id]: draftFrom(createdOption) }));
      toast.success(`${sessions} session option added`);
      setNewSessions(String(sessions + 1));
      setNewPrice("");
      setNewWeeks("");
      setNewSplit(false);
      setNewRecommended(false);
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add option");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-sm font-semibold">{groupName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Each box below is a separate choice shown to patients. Edit and save each option independently.
        </p>
      </div>
        <div className="space-y-3">
          {options.map((o) => {
            const d = draftFor(o);
            const sessions = Math.max(1, Math.floor(Number(d.sessions) || 1));
            const price = Number(d.price) || 0;
            const per = price / Math.max(1, sessions);
            return (
              <div key={o.id} className="rounded-md border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      £{per.toFixed(2)} per session · {o.duration} min each
                    </p>
                  </div>
                  {d.recommended && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                      <Sparkles className="h-3 w-3" /> Recommended
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Sessions</Label>
                    <Input
                      type="number"
                      min={1}
                      value={d.sessions}
                      onChange={(e) => patch(o.id, o, { sessions: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total price (£)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={d.price}
                      onChange={(e) => patch(o.id, o, { price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Weeks apart</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 4"
                      value={d.weeks}
                      onChange={(e) => patch(o.id, o, { weeks: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={d.split && sessions > 1}
                      disabled={sessions <= 1}
                      onCheckedChange={(v) => patch(o.id, o, { split: v })}
                    />
                    Split payment
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={d.recommended}
                      onCheckedChange={(v) => patch(o.id, o, { recommended: v })}
                    />
                    Recommended
                  </label>
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => removeFromCourse(o)}>
                      <Unlink className="mr-1.5 h-4 w-4" /> Remove
                    </Button>
                    <Button size="sm" disabled={d.saving} onClick={() => saveOption(o)}>
                      <Save className="mr-1.5 h-4 w-4" /> {d.saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div>
            <p className="text-sm font-semibold">Add another session option</p>
            <p className="text-xs text-muted-foreground">Set everything now; the new option will use the same treatment details and locations.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Number of sessions</Label>
              <Input type="number" min={1} value={newSessions} onChange={(e) => setNewSessions(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total price (£)</Label>
              <Input type="number" min={0} step="0.01" placeholder="e.g. 750" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Weeks apart</Label>
              <Input type="number" min={0} placeholder="e.g. 4" value={newWeeks} onChange={(e) => setNewWeeks(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={newSplit && Number(newSessions) > 1} disabled={Number(newSessions) <= 1} onCheckedChange={setNewSplit} />
              Split payment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={newRecommended} onCheckedChange={setNewRecommended} />
              Recommended
            </label>
          </div>
          <Button className="w-full" disabled={adding || !newPrice.trim()} onClick={addOption}>
            <Plus className="mr-1.5 h-4 w-4" /> {adding ? "Adding…" : "Add this session option"}
          </Button>
        </div>
    </div>
  );
}

export default CourseOptionsDialog;
