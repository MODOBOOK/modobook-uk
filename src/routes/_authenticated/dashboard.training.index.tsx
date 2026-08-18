import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseWithSessions,
  upsertSessions,
  setCourseLocations,
} from "@/lib/training.functions";
import { listMyLocations } from "@/lib/locations.functions";
import { getMyTrainingPage, saveMyTrainingPage } from "@/lib/training-page.functions";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ImageUploader } from "@/components/ImageUploader";
import { formatDuration } from "@/lib/format-duration";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profiles.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GraduationCap, Plus, Trash2, ArrowLeft, Users, Calendar as CalendarIcon, Award, Loader2, Copy, Check, ExternalLink, PencilLine, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Course = Database["public"]["Tables"]["training_courses"]["Row"];
type Session = Database["public"]["Tables"]["training_course_sessions"]["Row"];
type Mode = Database["public"]["Enums"]["training_mode"];

export const Route = createFileRoute("/_authenticated/dashboard/training/")({
  component: TrainingPage,
});

const MODE_LABEL: Record<Mode, string> = {
  one_to_one: "1:1 training",
  group: "Group / cohort",
  multi_day: "Multi-day",
};

function TrainingPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyCourses);
  const createFn = useServerFn(createCourse);
  const deleteFn = useServerFn(deleteCourse);
  const profileFn = useServerFn(getMyProfile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState(false);
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["training-courses"],
    queryFn: () => listFn(),
  });
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const slug = (profileQ.data as { slug?: string } | undefined)?.slug ?? "";
  const publicUrl = slug ? `https://modobook.uk/m/${slug}/training` : "";

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { name: "New course", mode: "one_to_one" } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["training-courses"] });
      setEditingId((row as Course).id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-courses"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Move a course up/down and persist the new order for the public page.
  const updateFn = useServerFn(updateCourse);
  const reorderMut = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const list = [...((q.data ?? []) as Course[])];
      const target = index + dir;
      if (target < 0 || target >= list.length) return;
      const [moved] = list.splice(index, 1);
      list.splice(target, 0, moved);
      await Promise.all(
        list.map((c, i) => updateFn({ data: { id: c.id, sort_order: i } as never })),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-courses"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to reorder"),
  });

  if (editingId) {
    return <CourseEditor id={editingId} onClose={() => setEditingId(null)} />;
  }
  if (editingPage) {
    return <TrainingPageEditor onClose={() => setEditingPage(false)} />;
  }

  const courses = (q.data ?? []) as Course[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <GraduationCap className="h-6 w-6 shrink-0" /> Training
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Courses live on their own public training page — share the link on its own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setEditingPage(true)}>
            <PencilLine className="mr-2 h-4 w-4" /> Edit page
          </Button>
          <Link to="/dashboard/training/bookings"><Button variant="outline"><Users className="mr-2 h-4 w-4" /> Bookings</Button></Link>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            <Plus className="mr-2 h-4 w-4" /> New course
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <div className="font-medium">Your training page</div>
            <p className="text-sm text-muted-foreground break-all">
              {publicUrl ? publicUrl.replace("https://", "") : "Set your booking link to publish"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dates come from your clinic calendar, or set fixed dates per course.
            </p>
          </div>
          {publicUrl && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  toast.success("Training link copied");
                }}
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy link
              </Button>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost"><ExternalLink className="mr-2 h-4 w-4" /> Open</Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>


      {q.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">No courses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first course to start taking training bookings.</p>
            <Button className="mt-4" onClick={() => createMut.mutate()}>
              <Plus className="mr-2 h-4 w-4" /> New course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {courses.map((c, idx) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <Badge variant="outline">{MODE_LABEL[c.mode]}</Badge>
                    {(c as Course & { category?: string | null }).category && (
                      <Badge variant="secondary">{(c as Course & { category?: string | null }).category}</Badge>
                    )}
                    {(() => {
                      const v = (c as Course & { visibility?: string }).visibility ?? (c.active ? "live" : "hidden");
                      const map: Record<string, { label: string; cls: string }> = {
                        live: { label: "Live", cls: "bg-emerald-100 text-emerald-800" },
                        coming_soon: { label: "Coming soon", cls: "bg-amber-100 text-amber-800" },
                        preview_link: { label: "Preview link", cls: "bg-blue-100 text-blue-800" },
                        hidden: { label: "Hidden", cls: "bg-muted text-muted-foreground" },
                      };
                      const m = map[v] ?? map.hidden;
                      return <Badge className={m.cls}>{m.label}</Badge>;
                    })()}
                    {c.cpd_hours != null && (
                      <Badge variant="outline" className="gap-1">
                        <Award className="h-3 w-3" /> {c.cpd_hours} CPD
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    £{Number(c.price).toFixed(2)} · {formatDuration(c.duration_min)}
                    {c.capacity ? ` · up to ${c.capacity} trainees` : ""}
                  </p>
                </div>
                <div className="flex items-center">
                  <Button
                    size="icon" variant="ghost" aria-label="Move up"
                    disabled={idx === 0 || reorderMut.isPending}
                    onClick={() => reorderMut.mutate({ index: idx, dir: -1 })}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" aria-label="Move down"
                    disabled={idx === courses.length - 1 || reorderMut.isPending}
                    onClick={() => reorderMut.mutate({ index: idx, dir: 1 })}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditingId(c.id)}>Edit</Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete "${c.name}"? This can't be undone.`)) deleteMut.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CourseEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getCourseWithSessions);
  const updateFn = useServerFn(updateCourse);
  const upsertFn = useServerFn(upsertSessions);
  const setLocFn = useServerFn(setCourseLocations);
  const locFn = useServerFn(listMyLocations);

  const q = useQuery({
    queryKey: ["training-course", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const locQ = useQuery({ queryKey: ["my-locations"], queryFn: () => locFn() });

  const [form, setForm] = useState<Partial<Course> | null>(null);
  const [sessions, setSessions] = useState<Array<Partial<Session> & { _deleted?: boolean }>>([]);
  const [pickedLocs, setPickedLocs] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const cachedCourses = (qc.getQueryData(["training-courses"]) ?? []) as Array<{ category?: string | null }>;
  const existingCategories = Array.from(
    new Set(cachedCourses.map((c) => (c.category ?? "").trim()).filter(Boolean)),
  ) as string[];

  // Initialise once data loads
  if (form === null && q.data) {
    setForm(q.data.course as Course);
    setSessions(q.data.sessions as Session[]);
    setPickedLocs((q.data.location_ids ?? []) as string[]);
  }

  if (q.isLoading || !form || pickedLocs === null) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const schedulingMode = ((form as Course & { scheduling_mode?: string }).scheduling_mode ?? "fixed") as "fixed" | "availability";
  const isSchedule = (form.mode === "group" || form.mode === "multi_day") && schedulingMode === "fixed";
  const locations = (locQ.data ?? []) as Array<{ id: string; name: string }>;
  const visibility = (form as Course & { visibility?: string }).visibility ?? "live";
  const previewToken = (form as Course & { preview_token?: string | null }).preview_token ?? null;
  const previewUrl = previewToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/m/${(q.data as { slug?: string })?.slug ?? ""}/training/${id}?preview=${previewToken}`
    : "";

  type MultiDay = { day_count?: number | null; days_consecutive?: boolean | null; day_duration_min?: number | null };
  const isMulti = form.mode === "multi_day";
  const dayCount = Math.max(1, Number((form as Course & MultiDay).day_count ?? 1) || 1);
  const perDayMin = Number(
    (form as Course & MultiDay).day_duration_min ?? Math.round((Number(form.duration_min) || 0) / dayCount),
  ) || 0;
  const daysConsecutive = (form as Course & MultiDay).days_consecutive ?? true;
  const patchMulti = (p: MultiDay) => setForm({ ...form, ...((p as unknown) as Partial<Course>) });
  const setDayDuration = (mins: number) =>
    patchMulti({ day_duration_min: mins, ...(isMulti ? { duration_min: mins * dayCount } as MultiDay : { duration_min: mins } as MultiDay) });
  const setDayCount = (n: number) => {
    const days = Math.max(1, n || 1);
    patchMulti({ day_count: days, day_duration_min: perDayMin, ...({ duration_min: perDayMin * days } as MultiDay) });
  };



  async function save() {
    if (!form?.name?.trim()) { toast.error("Course name is required"); return; }
    setSaving(true);
    try {
      await updateFn({
        data: {
          id,
          name: form.name!,
          category: ((form as Course & { category?: string | null }).category || null) as string | null,
          description: form.description ?? null,
          cover_image_url: form.cover_image_url ?? null,
          mode: form.mode,
          duration_min: isMulti ? Math.max(1, perDayMin * dayCount) : (Number(form.duration_min) || 120),
          day_count: isMulti ? dayCount : 1,
          days_consecutive: isMulti ? !!daysConsecutive : true,
          day_duration_min: isMulti ? perDayMin : null,
          price: Number(form.price) || 0,
          deposit_amount: form.deposit_amount != null ? Number(form.deposit_amount) : null,
          payment_mode: form.payment_mode,
          allow_split_payment: !!form.allow_split_payment,
          capacity: form.capacity != null ? Number(form.capacity) : null,
          prerequisites: form.prerequisites ?? null,
          require_prereq_confirm: !!form.require_prereq_confirm,
          cpd_hours: form.cpd_hours != null ? Number(form.cpd_hours) : null,
          certificate_template_url: form.certificate_template_url ?? null,
          materials_html: form.materials_html ?? null,
          kit_list: form.kit_list ?? null,
          handout_url: (form as Course & { handout_url?: string | null }).handout_url ?? null,
          handout_name: (form as Course & { handout_name?: string | null }).handout_name ?? null,
          active: visibility !== "hidden",
          visibility: visibility as "live" | "hidden" | "preview_link" | "coming_soon",
          scheduling_mode: schedulingMode,
        },
      });
      await setLocFn({ data: { course_id: id, location_ids: pickedLocs ?? [] } });
      if (isSchedule) {
        const deleted_ids = sessions.filter((s) => s._deleted && s.id).map((s) => s.id as string);
        const kept = sessions
          .filter((s) => !s._deleted && s.session_date && s.start_time && s.end_time)
          .map((s, idx) => ({
            id: s.id ?? undefined,
            session_date: s.session_date as string,
            start_time: s.start_time as string,
            end_time: s.end_time as string,
            location_id: s.location_id ?? null,
            sort_order: idx,
          }));
        await upsertFn({ data: { course_id: id, sessions: kept, deleted_ids } });
      }
      toast.success("Course saved");
      qc.invalidateQueries({ queryKey: ["training-courses"] });
      qc.invalidateQueries({ queryKey: ["training-course", id] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleLoc(locId: string) {
    setPickedLocs((prev) => {
      const arr = prev ?? [];
      return arr.includes(locId) ? arr.filter((x) => x !== locId) : [...arr, locId];
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to courses
        </Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={visibility}
            onValueChange={(v) => setForm({ ...form, ...(({ visibility: v } as unknown) as Partial<Course>) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="live">Live — bookable on your page</SelectItem>
              <SelectItem value="coming_soon">Coming soon — shown, not bookable</SelectItem>
              <SelectItem value="preview_link">Hidden — share via preview link</SelectItem>
              <SelectItem value="hidden">Hidden — only visible to you</SelectItem>
            </SelectContent>
          </Select>
          {visibility === "preview_link" && previewUrl && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="mb-1 font-medium">Private preview link</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all text-[11px]">{previewUrl}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewUrl); toast.success("Copied"); }}>Copy</Button>
              </div>
              <p className="mt-2 text-muted-foreground">Only people with this link can see and book the course.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Where this course runs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Leave empty to offer this course at all of your locations.
          </p>
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add locations first in the Locations section.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => {
                const on = pickedLocs.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLoc(l.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle>Course details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Foundation Lip Filler Training" />
          </div>
          <div>
            <Label>Category</Label>
            <Input
              list="training-category-options"
              value={(form as Course & { category?: string | null }).category ?? ""}
              onChange={(e) => setForm({ ...form, ...(({ category: e.target.value } as unknown) as Partial<Course>) })}
              placeholder="e.g. Foundation, Advanced, Masterclass"
            />
            <datalist id="training-category-options">
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
            <p className="mt-1 text-xs text-muted-foreground">
              Courses are grouped by category on your public training page. Leave blank for “Other courses”.
            </p>
          </div>
          <div>
            <Label>Short description</Label>
            <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What trainees will learn, level, etc." />
          </div>
          <CourseMedia form={form} setForm={setForm} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Format</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as Mode })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_to_one">1:1 training</SelectItem>
                  <SelectItem value="group">Group / cohort</SelectItem>
                  <SelectItem value="multi_day">Multi-day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isMulti ? "Hours per day" : "Duration"}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  aria-label="Hours"
                  value={Math.floor(perDayMin / 60)}
                  onChange={(e) => {
                    const hrs = Math.max(0, Number(e.target.value) || 0);
                    setDayDuration(hrs * 60 + (perDayMin % 60));
                  }}
                />
                <span className="text-xs text-muted-foreground">hrs</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  aria-label="Minutes"
                  value={perDayMin % 60}
                  onChange={(e) => {
                    const mins = Math.min(59, Math.max(0, Number(e.target.value) || 0));
                    setDayDuration(Math.floor(perDayMin / 60) * 60 + mins);
                  }}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {isMulti
                  ? `${dayCount} day${dayCount === 1 ? "" : "s"} × ${formatDuration(perDayMin)} · ${formatDuration(perDayMin * dayCount)} total`
                  : formatDuration(form.duration_min)}
              </p>
            </div>

            {isSchedule && (
              <div>
                <Label>Capacity (seats)</Label>
                <Input type="number" value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 6" />
              </div>
            )}
          </div>

          {isMulti && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Number of days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={dayCount}
                    onChange={(e) => setDayCount(Number(e.target.value))}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Total course time: {formatDuration(perDayMin * dayCount)}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <div className="pr-3">
                    <Label className="text-sm">Consecutive days</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {daysConsecutive
                        ? "Days run back-to-back (e.g. Mon–Wed)."
                        : "Days are spread out — set each date separately."}
                    </p>
                  </div>
                  <Switch
                    checked={!!daysConsecutive}
                    onCheckedChange={(v) => patchMulti({ days_consecutive: v })}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {schedulingMode === "fixed"
                  ? `Add ${dayCount} session date${dayCount === 1 ? "" : "s"} below${daysConsecutive ? " on consecutive days" : ""}.`
                  : `Trainees book each day from your calendar using ${formatDuration(perDayMin)} slots.`}
              </p>
            </div>
          )}

        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" /> Scheduling</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={schedulingMode}
            onValueChange={(v) => setForm({ ...form, ...(({ scheduling_mode: v } as unknown) as Partial<Course>) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed dates — publish set sessions trainees pick from</SelectItem>
              <SelectItem value="availability">Availability — trainees pick a slot from your normal calendar</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {schedulingMode === "availability"
              ? "Bookings block your calendar just like a treatment — using the course duration as the slot length."
              : "Trainees choose from the specific dates you set below."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Price (£)</Label>
              <Input type="number" step="0.01" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Payment</Label>
              <Select value={form.payment_mode ?? "full"} onValueChange={(v) => setForm({ ...form, payment_mode: v as Course["payment_mode"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full upfront</SelectItem>
                  <SelectItem value="deposit">Deposit only</SelectItem>
                  <SelectItem value="pay_in_clinic">Pay in person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deposit (£)</Label>
              <Input type="number" step="0.01" value={form.deposit_amount ?? ""} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isSchedule && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" /> Session dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.filter((s) => !s._deleted).length === 0 && (
              <p className="text-sm text-muted-foreground">Add the dates trainees can book onto.</p>
            )}
            {sessions.map((s, idx) => s._deleted ? null : (
              <div key={s.id ?? `new-${idx}`} className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-5">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={s.session_date ?? ""} onChange={(e) => {
                    const next = [...sessions]; next[idx] = { ...s, session_date: e.target.value }; setSessions(next);
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input type="time" value={(s.start_time ?? "").slice(0, 5)} onChange={(e) => {
                    const next = [...sessions]; next[idx] = { ...s, start_time: `${e.target.value}:00` }; setSessions(next);
                  }} />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input type="time" value={(s.end_time ?? "").slice(0, 5)} onChange={(e) => {
                    const next = [...sessions]; next[idx] = { ...s, end_time: `${e.target.value}:00` }; setSessions(next);
                  }} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">Location</Label>
                  <Select value={s.location_id ?? "none"} onValueChange={(v) => {
                    const next = [...sessions]; next[idx] = { ...s, location_id: v === "none" ? null : v }; setSessions(next);
                  }}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end sm:col-span-5 sm:justify-end">
                  <Button size="sm" variant="ghost" onClick={() => {
                    const next = [...sessions]; next[idx] = { ...s, _deleted: true }; setSessions(next);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={() => setSessions([...sessions, { session_date: "", start_time: "09:00:00", end_time: "17:00:00", location_id: null }])}>
              <Plus className="mr-2 h-4 w-4" /> Add date
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Prerequisites &amp; certification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Prerequisites / eligibility</Label>
            <Textarea rows={4} value={form.prerequisites ?? ""} onChange={(e) => setForm({ ...form, prerequisites: e.target.value })} placeholder="e.g. Must be a registered medical professional. Level 4 aesthetics qualification required." />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label>Trainees must confirm they meet the prerequisites</Label>
              <p className="text-xs text-muted-foreground">Adds a required checkbox at booking.</p>
            </div>
            <Switch checked={!!form.require_prereq_confirm} onCheckedChange={(v) => setForm({ ...form, require_prereq_confirm: v })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>CPD hours</Label>
              <Input type="number" step="0.5" value={form.cpd_hours ?? ""} onChange={(e) => setForm({ ...form, cpd_hours: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 8" />
            </div>
            <div>
              <Label>Certificate template URL</Label>
              <Input value={form.certificate_template_url ?? ""} onChange={(e) => setForm({ ...form, certificate_template_url: e.target.value })} placeholder="https://…" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Course materials &amp; kit</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Pre-course materials (HTML)</Label>
            <Textarea rows={6} value={form.materials_html ?? ""} onChange={(e) => setForm({ ...form, materials_html: e.target.value })} placeholder="Links to pre-reading, PDF URLs, videos etc. Sent after booking." />
          </div>
          <div>
            <Label>Kit / what to bring</Label>
            <Textarea rows={3} value={form.kit_list ?? ""} onChange={(e) => setForm({ ...form, kit_list: e.target.value })} placeholder="e.g. Notepad, scrubs, own model if available." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type PageDraft = {
  eyebrow: string;
  headline: string;
  intro: string;
  hero_image_url: string | null;
  courses_heading: string;
  highlights: { title: string; body: string }[];
  body_heading: string;
  body_html: string;
  show_highlights: boolean;
  show_cta: boolean;
  cta_heading: string;
  cta_body: string;
  cta_button_label: string;
  cta_url: string;
  seo_title: string;
  seo_description: string;
};

const EMPTY_PAGE: PageDraft = {
  eyebrow: "",
  headline: "",
  intro: "",
  hero_image_url: null,
  courses_heading: "",
  highlights: [],
  body_heading: "",
  body_html: "",
  show_highlights: true,
  show_cta: true,
  cta_heading: "",
  cta_body: "",
  cta_button_label: "",
  cta_url: "",
  seo_title: "",
  seo_description: "",
};

/** Write your own copy for the public /training page. */
function TrainingPageEditor({ onClose }: { onClose: () => void }) {
  const getFn = useServerFn(getMyTrainingPage);
  const saveFn = useServerFn(saveMyTrainingPage);
  const profileFn = useServerFn(getMyProfile);
  const [draft, setDraft] = useState<PageDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const profileId = (profileQ.data as { id?: string } | undefined)?.id ?? "";
  const slug = (profileQ.data as { slug?: string } | undefined)?.slug ?? "";

  const q = useQuery({ queryKey: ["training-page"], queryFn: () => getFn() });

  if (q.isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const row = (q.data ?? null) as Record<string, unknown> | null;
  const current: PageDraft =
    draft ??
    ({
      ...EMPTY_PAGE,
      ...(row
        ? {
            eyebrow: (row.eyebrow as string) ?? "",
            headline: (row.headline as string) ?? "",
            intro: (row.intro as string) ?? "",
            hero_image_url: (row.hero_image_url as string) ?? null,
            courses_heading: (row.courses_heading as string) ?? "",
            highlights: (row.highlights as { title: string; body: string }[]) ?? [],
            body_heading: (row.body_heading as string) ?? "",
            body_html: (row.body_html as string) ?? "",
            show_highlights: row.show_highlights !== false,
            show_cta: row.show_cta !== false,
            cta_heading: (row.cta_heading as string) ?? "",
            cta_body: (row.cta_body as string) ?? "",
            cta_button_label: (row.cta_button_label as string) ?? "",
            cta_url: (row.cta_url as string) ?? "",
            seo_title: (row.seo_title as string) ?? "",
            seo_description: (row.seo_description as string) ?? "",
          }
        : {}),
    } as PageDraft);

  const set = (patch: Partial<PageDraft>) => setDraft({ ...current, ...patch });

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: current });
      toast.success("Training page updated");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {slug && (
            <a href={`/m/${slug}/training`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" /> Preview
              </Button>
            </a>
          )}
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Training page content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write your own words for the public training page. Leave a field blank to keep the default text.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Top of the page</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Small label above the title</Label>
            <Input
              value={current.eyebrow}
              placeholder="Academy"
              onChange={(e) => set({ eyebrow: e.target.value })}
            />
          </div>
          <div>
            <Label>Headline</Label>
            <Input
              value={current.headline}
              placeholder="Training courses taught by a practising clinician"
              onChange={(e) => set({ headline: e.target.value })}
            />
          </div>
          <div>
            <Label>Intro paragraph</Label>
            <Textarea
              rows={3}
              value={current.intro}
              placeholder="Small cohorts, live models where applicable, and full aftercare guidance."
              onChange={(e) => set({ intro: e.target.value })}
            />
          </div>
          {profileId && (
            <ImageUploader
              label="Hero background image"
              value={current.hero_image_url}
              onChange={(url) => set({ hero_image_url: url })}
              profileId={profileId}
              folder="training"
              previewClass="mt-2 h-28 w-full max-w-sm rounded-xl object-cover"
            />
          )}
          <div>
            <Label>Courses section heading</Label>
            <Input
              value={current.courses_heading}
              placeholder="Available courses"
              onChange={(e) => set({ courses_heading: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your own section</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Section heading</Label>
            <Input
              value={current.body_heading}
              placeholder="Why train with us"
              onChange={(e) => set({ body_heading: e.target.value })}
            />
          </div>
          <div>
            <Label>Content</Label>
            <RichTextEditor value={current.body_html} onChange={(html) => set({ body_html: html })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>What's included</CardTitle>
            <Switch
              checked={current.show_highlights}
              onCheckedChange={(v) => set({ show_highlights: v })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add up to 8 points. Leave empty to use the default four.
          </p>
          {current.highlights.map((h, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={h.title}
                  placeholder="Small groups"
                  onChange={(e) => {
                    const next = [...current.highlights];
                    next[i] = { ...h, title: e.target.value };
                    set({ highlights: next });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove point"
                  onClick={() => set({ highlights: current.highlights.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                rows={2}
                value={h.body}
                placeholder="Limited places so you get genuine hands-on time."
                onChange={(e) => {
                  const next = [...current.highlights];
                  next[i] = { ...h, body: e.target.value };
                  set({ highlights: next });
                }}
              />
            </div>
          ))}
          {current.highlights.length < 8 && (
            <Button
              variant="outline"
              onClick={() => set({ highlights: [...current.highlights, { title: "", body: "" }] })}
            >
              <Plus className="mr-2 h-4 w-4" /> Add point
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Call to action</CardTitle>
            <Switch checked={current.show_cta} onCheckedChange={(v) => set({ show_cta: v })} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Heading</Label>
            <Input
              value={current.cta_heading}
              placeholder="Not sure which course is right for you?"
              onChange={(e) => set({ cta_heading: e.target.value })}
            />
          </div>
          <div>
            <Label>Text</Label>
            <Textarea
              rows={3}
              value={current.cta_body}
              onChange={(e) => set({ cta_body: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Button label</Label>
              <Input
                value={current.cta_button_label}
                placeholder="Contact the clinic"
                onChange={(e) => set({ cta_button_label: e.target.value })}
              />
            </div>
            <div>
              <Label>Button link (optional)</Label>
              <Input
                value={current.cta_url}
                placeholder="https://wa.me/…"
                onChange={(e) => set({ cta_url: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Search & sharing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Page title</Label>
            <Input
              value={current.seo_title}
              placeholder="Aesthetics training courses"
              onChange={(e) => set({ seo_title: e.target.value })}
            />
          </div>
          <div>
            <Label>Page description</Label>
            <Textarea
              rows={2}
              value={current.seo_description}
              onChange={(e) => set({ seo_description: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-10">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}


/** Cover photo + optional PDF reading material for a course. */
function CourseMedia({
  form,
  setForm,
}: {
  form: Partial<Course>;
  setForm: (f: Partial<Course>) => void;
}) {
  const profileFn = useServerFn(getMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const profileId = (profileQ.data as { id?: string } | undefined)?.id ?? "";
  const extra = form as Course & { handout_url?: string | null; handout_name?: string | null };
  const [uploading, setUploading] = useState(false);

  async function uploadPdf(file: File) {
    if (!profileId) return;
    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF file");
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${profileId}/training/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("treatment-leaflets")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (error) throw error;
      setForm({
        ...form,
        ...(({ handout_url: `storage:${path}`, handout_name: extra.handout_name || file.name } as unknown) as Partial<Course>),
      });
      toast.success("PDF uploaded — remember to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-md border p-3">
      {profileId && (
        <ImageUploader
          label="Course photo"
          value={form.cover_image_url}
          onChange={(url) => setForm({ ...form, cover_image_url: url })}
          profileId={profileId}
          folder="training-courses"
          previewClass="mt-2 h-28 w-full max-w-sm rounded-lg object-cover"
        />
      )}

      <div>
        <Label>Reading material (PDF)</Label>
        {extra.handout_url ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {extra.handout_name || "Attached PDF"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setForm({ ...form, ...(({ handout_url: null, handout_name: null } as unknown) as Partial<Course>) })
              }
            >
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          </div>
        ) : (
          <Input
            className="mt-2"
            type="file"
            accept="application/pdf"
            disabled={uploading || !profileId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPdf(f);
            }}
          />
        )}
        {extra.handout_url && (
          <Input
            className="mt-2"
            placeholder="Label shown to trainees, e.g. Sculptra pre-reading"
            value={extra.handout_name ?? ""}
            onChange={(e) =>
              setForm({ ...form, ...(({ handout_name: e.target.value } as unknown) as Partial<Course>) })
            }
          />
        )}
        {uploading && <p className="mt-1 text-[11px] text-muted-foreground">Uploading…</p>}
      </div>
    </div>
  );
}
