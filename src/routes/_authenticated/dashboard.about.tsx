import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile, getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, ExternalLink, Eye, EyeOff,
  Image as ImageIcon, Sparkles, HeartHandshake, ShieldCheck, MessageCircle,
  Award, Clock, MapPin, HelpCircle, Tag, GraduationCap, History, Save,
} from "lucide-react";
import { SaveReminder } from "@/components/SaveReminder";
import { ImageUploader } from "@/components/ImageUploader";
import { User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/about")({
  ssr: false,
  component: AboutEditor,
});

type Hours = { day: string; hours: string };
type FAQ = { q: string; a: string };
type Qual = { label: string; year?: string };
type TimelineItem = { year: string; label: string };

type AboutPage = {
  show_intro?: boolean;
  show_mission?: boolean;
  show_why_choose?: boolean;
  show_what_to_expect?: boolean;
  show_specialties?: boolean;
  show_qualifications?: boolean;
  show_timeline?: boolean;
  show_locations?: boolean;
  show_opening_hours?: boolean;
  show_faqs?: boolean;
  show_contact?: boolean;
  show_hero_image?: boolean;
  hero_image_url?: string;
  intro_heading?: string;
  intro_body?: string;
  mission?: string;
  why_choose?: string[];
  what_to_expect?: string;
  opening_hours?: Hours[];
  faqs?: FAQ[];
  contact_email?: string;
  contact_phone?: string;
  contact_extra?: string;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function AboutEditor() {
  const router = useRouter();
  const update = useServerFn(updateProfile);
  const fetchProfile = useServerFn(getMyProfile);

  const [profileId, setProfileId] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ap, setAp] = useState<AboutPage>({});
  const [tagline, setTagline] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [quals, setQuals] = useState<Qual[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await fetchProfile();
      if (p) {
        setProfileId(p.id);
        setSlug(p.slug ?? "");
        setAp(((p as { about_page?: AboutPage }).about_page ?? {}) as AboutPage);
        setTagline(p.tagline ?? "");
        setSpecialties(((p as { specialties?: string[] }).specialties ?? []));
        setQuals(((p as unknown as { qualifications?: Qual[] }).qualifications ?? []));
        setTimeline(((p as unknown as { timeline?: TimelineItem[] }).timeline ?? []));
        setAvatarUrl((p as { avatar_url?: string | null }).avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof AboutPage>(k: K, v: AboutPage[K]) => setAp((s) => ({ ...s, [k]: v }));
  const show = (k: keyof AboutPage, def: boolean) => (ap[k] === undefined ? def : Boolean(ap[k]));

  async function save() {
    if (!profileId) return;
    setSaving(true);
    try {
      await update({
        data: {
          id: profileId,
          about_page: ap as Record<string, unknown>,
          tagline,
          specialties,
          qualifications: quals,
          timeline,
          avatar_url: avatarUrl,
        },
      });
      toast.success("About page saved");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-32">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">About page</h1>
          <p className="text-sm text-muted-foreground">
            Each block below is a section on your public page at <span className="font-mono text-xs">/m/{slug || "your-slug"}/about</span>.
            Toggle off to hide. Names come from <Link to="/dashboard/clinic" className="underline">Clinic page</Link>.
          </p>
        </div>
        {slug && (
          <a
            href={`/m/${slug}/about`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Preview live <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <SaveReminder />

      {/* TAGLINE — always shown under name */}
      <Bubble icon={Tag} title="Tagline" subtitle="One line shown directly under your name at the top of the page.">
        <Input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Prescribing nurse · Subtle, natural aesthetics"
          maxLength={120}
        />
      </Bubble>

      {/* HERO */}
      <Bubble
        icon={ImageIcon}
        title="Hero image"
        subtitle="The wide banner at the top of your about page."
        on={show("show_hero_image", true)}
        onToggle={(v) => set("show_hero_image", v)}
      >
        <Label className="text-xs text-muted-foreground">Override image URL (optional — defaults to your branding hero)</Label>
        <Input
          value={ap.hero_image_url ?? ""}
          onChange={(e) => set("hero_image_url", e.target.value)}
          placeholder="https://…"
        />
      </Bubble>

      {/* INTRO */}
      <Bubble
        icon={Sparkles}
        title="Welcome intro"
        subtitle="A warm welcome. Heading shows in your brand colour."
        on={show("show_intro", true)}
        onToggle={(v) => set("show_intro", v)}
      >
        <Field label="Heading">
          <Input
            value={ap.intro_heading ?? ""}
            onChange={(e) => set("intro_heading", e.target.value)}
            placeholder="e.g. Welcome to Aesthetics by Nurse Ryan"
          />
        </Field>
        <Field label="Body">
          <Textarea
            rows={5}
            value={ap.intro_body ?? ""}
            onChange={(e) => set("intro_body", e.target.value)}
            placeholder="Introduce yourself and your clinic in a few sentences…"
          />
        </Field>
      </Bubble>

      {/* APPROACH */}
      <Bubble
        icon={HeartHandshake}
        title="My approach"
        subtitle="How you work with patients — your philosophy in your own words."
        on={show("show_mission", false)}
        onToggle={(v) => set("show_mission", v)}
      >
        <Textarea
          rows={4}
          value={ap.mission ?? ""}
          onChange={(e) => set("mission", e.target.value)}
          placeholder="e.g. I believe in subtle, natural-looking results that enhance your features without changing who you are…"
        />
      </Bubble>

      {/* WHY CHOOSE */}
      <Bubble
        icon={ShieldCheck}
        title="Why choose us"
        subtitle="Short bullet points. Each becomes a card on the live page."
        on={show("show_why_choose", false)}
        onToggle={(v) => set("show_why_choose", v)}
      >
        <ChipList
          items={ap.why_choose ?? []}
          onChange={(arr) => set("why_choose", arr)}
          placeholder="e.g. Prescribing nurse with 8+ years experience"
          addLabel="Add bullet"
        />
      </Bubble>

      {/* WHAT TO EXPECT */}
      <Bubble
        icon={MessageCircle}
        title="What to expect"
        subtitle="Walk patients through what their visit looks like."
        on={show("show_what_to_expect", false)}
        onToggle={(v) => set("show_what_to_expect", v)}
      >
        <Textarea
          rows={4}
          value={ap.what_to_expect ?? ""}
          onChange={(e) => set("what_to_expect", e.target.value)}
          placeholder="e.g. Your appointment starts with a relaxed consultation…"
        />
      </Bubble>

      {/* SPECIALTIES */}
      <Bubble
        icon={Sparkles}
        title="Specialties"
        subtitle="Areas you focus on. These appear as pills on your page."
        on={show("show_specialties", true)}
        onToggle={(v) => set("show_specialties", v)}
      >
        <ChipList
          items={specialties}
          onChange={setSpecialties}
          placeholder="e.g. Anti-wrinkle injections"
          addLabel="Add specialty"
          variant="pill"
        />
      </Bubble>

      {/* QUALIFICATIONS */}
      <Bubble
        icon={GraduationCap}
        title="Qualifications"
        subtitle="Your credentials, training, and certifications."
        on={show("show_qualifications", true)}
        onToggle={(v) => set("show_qualifications", v)}
      >
        <div className="space-y-2">
          {quals.length === 0 && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
              No qualifications added yet.
            </p>
          )}
          {quals.map((q, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 rounded-xl border bg-card p-2">
              <Input
                value={q.label}
                onChange={(e) => setQuals(quals.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                placeholder="e.g. BSc (Hons) Adult Nursing"
              />
              <Input
                value={q.year ?? ""}
                onChange={(e) => setQuals(quals.map((x, j) => j === i ? { ...x, year: e.target.value } : x))}
                placeholder="2018"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setQuals(quals.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setQuals([...quals, { label: "", year: "" }])}>
            <Plus className="mr-1 h-4 w-4" />Add qualification
          </Button>
        </div>
      </Bubble>

      {/* TIMELINE */}
      <Bubble
        icon={History}
        title="Experience timeline"
        subtitle="Career milestones in chronological order."
        on={show("show_timeline", true)}
        onToggle={(v) => set("show_timeline", v)}
      >
        <div className="space-y-2">
          {timeline.length === 0 && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
              No milestones added yet.
            </p>
          )}
          {timeline.map((t, i) => (
            <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2 rounded-xl border bg-card p-2">
              <Input
                value={t.year}
                onChange={(e) => setTimeline(timeline.map((x, j) => j === i ? { ...x, year: e.target.value } : x))}
                placeholder="2020"
              />
              <Input
                value={t.label}
                onChange={(e) => setTimeline(timeline.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                placeholder="e.g. Opened private clinic"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setTimeline(timeline.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setTimeline([...timeline, { year: "", label: "" }])}>
            <Plus className="mr-1 h-4 w-4" />Add milestone
          </Button>
        </div>
      </Bubble>

      {/* LOCATIONS */}
      <Bubble
        icon={MapPin}
        title="Locations"
        subtitle="Pulled from your Locations page automatically."
        on={show("show_locations", true)}
        onToggle={(v) => set("show_locations", v)}
      >
        <Link
          to="/dashboard/locations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] underline"
        >
          Manage locations <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </Bubble>

      {/* OPENING HOURS */}
      <Bubble
        icon={Clock}
        title="Opening hours"
        subtitle="Day-by-day clinic hours."
        on={show("show_opening_hours", false)}
        onToggle={(v) => set("show_opening_hours", v)}
      >
        <div className="space-y-2">
          {(ap.opening_hours ?? []).map((h, i) => (
            <div key={i} className="grid grid-cols-[140px_minmax(0,1fr)_auto] gap-2 rounded-xl border bg-card p-2">
              <select
                value={h.day}
                onChange={(e) => {
                  const arr = [...(ap.opening_hours ?? [])];
                  arr[i] = { ...arr[i], day: e.target.value };
                  set("opening_hours", arr);
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Choose day</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <Input
                value={h.hours}
                onChange={(e) => {
                  const arr = [...(ap.opening_hours ?? [])];
                  arr[i] = { ...arr[i], hours: e.target.value };
                  set("opening_hours", arr);
                }}
                placeholder="9am – 6pm  ·  or  ·  Closed"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => set("opening_hours", (ap.opening_hours ?? []).filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set("opening_hours", [...(ap.opening_hours ?? []), { day: "", hours: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" />Add day
          </Button>
        </div>
      </Bubble>

      {/* FAQs */}
      <Bubble
        icon={HelpCircle}
        title="Frequently asked"
        subtitle="Anticipate common questions to reduce admin."
        on={show("show_faqs", false)}
        onToggle={(v) => set("show_faqs", v)}
      >
        <div className="space-y-2">
          {(ap.faqs ?? []).map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border bg-card p-3">
              <Input
                value={f.q}
                onChange={(e) => {
                  const arr = [...(ap.faqs ?? [])]; arr[i] = { ...arr[i], q: e.target.value }; set("faqs", arr);
                }}
                placeholder="Question"
              />
              <Textarea
                rows={3}
                value={f.a}
                onChange={(e) => {
                  const arr = [...(ap.faqs ?? [])]; arr[i] = { ...arr[i], a: e.target.value }; set("faqs", arr);
                }}
                placeholder="Answer"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("faqs", (ap.faqs ?? []).filter((_, j) => j !== i))}
              >
                <Trash2 className="mr-1 h-4 w-4" />Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set("faqs", [...(ap.faqs ?? []), { q: "", a: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" />Add FAQ
          </Button>
        </div>
      </Bubble>

      {/* CONTACT */}
      <Bubble
        icon={MessageCircle}
        title="Get in touch"
        subtitle="A simple contact panel at the bottom of the page."
        on={show("show_contact", false)}
        onToggle={(v) => set("show_contact", v)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={ap.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} placeholder="hello@clinic.com" />
          </Field>
          <Field label="Phone">
            <Input value={ap.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} placeholder="07…" />
          </Field>
        </div>
        <Field label="Extra info">
          <Textarea
            rows={3}
            value={ap.contact_extra ?? ""}
            onChange={(e) => set("contact_extra", e.target.value)}
            placeholder="e.g. We respond within 24 hours, Mon–Fri."
          />
        </Field>
      </Bubble>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save about page"}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Reusable bubbles ---------- */

function Bubble({
  icon: Icon, title, subtitle, on, onToggle, children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  on?: boolean;
  onToggle?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const hasToggle = typeof on === "boolean" && onToggle;
  return (
    <section
      className={`rounded-2xl border bg-card p-4 shadow-sm transition sm:p-5 ${
        hasToggle && !on ? "opacity-60" : ""
      }`}
    >
      <header className="mb-3 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--brand)]/10 text-[var(--brand)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {hasToggle && (
          <div className="flex shrink-0 items-center gap-1.5">
            {on ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            <Switch checked={on} onCheckedChange={onToggle} />
          </div>
        )}
      </header>
      <div className="space-y-3 pl-0 sm:pl-12">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ChipList({
  items, onChange, placeholder, addLabel, variant = "row",
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  addLabel: string;
  variant?: "row" | "pill";
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          Nothing here yet — add your first one.
        </p>
      )}
      {items.map((v, i) => (
        <div key={i} className={`flex gap-2 rounded-xl border bg-card p-2 ${variant === "pill" ? "rounded-full" : ""}`}>
          <Input
            value={v}
            onChange={(e) => onChange(items.map((x, j) => j === i ? e.target.value : x))}
            placeholder={placeholder}
            className={variant === "pill" ? "border-0 shadow-none focus-visible:ring-0" : ""}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        <Plus className="mr-1 h-4 w-4" />{addLabel}
      </Button>
    </div>
  );
}
