import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/profiles.functions";
import { updatePractitionerBio } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/dashboard/bio")({
  component: BioEditor,
});

type Qual = { label: string; year?: string };
type TL = { year: string; label: string };
type FAQ = { q: string; a: string };
type Hours = { day: string; hours: string };

type AboutPage = {
  show_hero_image?: boolean;
  hero_image_url?: string;
  show_bio?: boolean;
  show_intro?: boolean;
  intro_heading?: string;
  intro_body?: string;
  show_mission?: boolean;
  mission?: string;
  show_why_choose?: boolean;
  why_choose?: string[];
  show_what_to_expect?: boolean;
  what_to_expect?: string;
  show_specialties?: boolean;
  show_qualifications?: boolean;
  show_timeline?: boolean;
  show_locations?: boolean;
  show_opening_hours?: boolean;
  opening_hours?: Hours[];
  show_faqs?: boolean;
  faqs?: FAQ[];
  show_contact?: boolean;
  contact_email?: string;
  contact_phone?: string;
  contact_extra?: string;
};

const DEFAULTS: AboutPage = {
  show_hero_image: true,
  show_bio: true,
  show_intro: false,
  show_mission: false,
  show_why_choose: false,
  show_what_to_expect: false,
  show_specialties: true,
  show_qualifications: true,
  show_timeline: true,
  show_locations: true,
  show_opening_hours: false,
  show_faqs: false,
  show_contact: false,
};

function BioEditor() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updatePractitionerBio);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string>("");
  const [profileId, setProfileId] = useState<string>("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState("");
  const [quals, setQuals] = useState<Qual[]>([]);
  const [timeline, setTimeline] = useState<TL[]>([]);
  const [ap, setAp] = useState<AboutPage>(DEFAULTS);

  useEffect(() => {
    (async () => {
      const p = await fetchProfile();
      if (p) {
        setSlug(p.slug ?? "");
        setProfileId(p.id ?? "");
        setBio(p.bio ?? "");
        setAvatar(p.avatar_url ?? "");
        setSpecialties(p.specialties ?? []);
        setQuals((p.qualifications as Qual[] | null) ?? []);
        setTimeline((p.timeline as TL[] | null) ?? []);
        const stored = (p as unknown as { about_page?: AboutPage }).about_page ?? {};
        setAp({ ...DEFAULTS, ...stored });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof AboutPage>(k: K, v: AboutPage[K]) {
    setAp((prev) => ({ ...prev, [k]: v }));
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { bio, avatar_url: avatar, specialties, qualifications: quals, timeline, about_page: ap as Record<string, unknown> } });
      toast.success("About page saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">About page</h1>
          <p className="text-sm text-muted-foreground">Tell patients who you are. All sections below can be toggled on or off.</p>
        </div>
        {slug && (
          <Button size="sm" variant="outline" asChild>
            <Link to="/m/$slug/about" params={{ slug }} target="_blank">
              <ExternalLink className="mr-1 h-4 w-4" /> Preview live page
            </Link>
          </Button>
        )}
      </div>

      {/* HERO IMAGE */}
      <ToggleCard
        title="Banner image"
        description="Large image at the very top of your About page."
        enabled={ap.show_hero_image ?? true}
        onToggle={(v) => update("show_hero_image", v)}
      >
        <ImageUploader
          profileId={profileId}
          folder="about-hero"
          value={ap.hero_image_url ?? ""}
          onChange={(url: string | null) => update("hero_image_url", url ?? "")}
          label="Upload banner"
          cropAspect={16 / 9}
        />
      </ToggleCard>

      {/* PROFILE PHOTO + BIO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile photo</CardTitle>
          <CardDescription>Used at the top of the about page and across your booking site.</CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUploader
            profileId={profileId}
            folder="avatar"
            value={avatar}
            onChange={(url: string | null) => setAvatar(url ?? "")}
            label="Upload photo"
            cropAspect={1}
          />
        </CardContent>
      </Card>

      <ToggleCard
        title="Biography"
        description="Your personal story — training, journey, what you're known for."
        enabled={ap.show_bio ?? true}
        onToggle={(v) => update("show_bio", v)}
      >
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={8} placeholder="I'm a Nurse Prescriber with over 10 years…" />
      </ToggleCard>

      {/* INTRO BLOCK */}
      <ToggleCard
        title="Welcome / intro block"
        description="A bold welcome heading and short paragraph at the top of the page."
        enabled={ap.show_intro ?? false}
        onToggle={(v) => update("show_intro", v)}
      >
        <div className="space-y-3">
          <div>
            <Label>Heading</Label>
            <Input value={ap.intro_heading ?? ""} onChange={(e) => update("intro_heading", e.target.value)} placeholder="Welcome to the clinic" />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea rows={4} value={ap.intro_body ?? ""} onChange={(e) => update("intro_body", e.target.value)} />
          </div>
        </div>
      </ToggleCard>

      {/* MISSION */}
      <ToggleCard
        title="Our approach / mission"
        description="Your philosophy, values, and how you approach treatments."
        enabled={ap.show_mission ?? false}
        onToggle={(v) => update("show_mission", v)}
      >
        <Textarea rows={5} value={ap.mission ?? ""} onChange={(e) => update("mission", e.target.value)} placeholder="We believe in natural, considered results…" />
      </ToggleCard>

      {/* WHY CHOOSE */}
      <ToggleCard
        title="Why choose us"
        description="Bullet points patients will see as cards."
        enabled={ap.show_why_choose ?? false}
        onToggle={(v) => update("show_why_choose", v)}
      >
        <StringListEditor
          items={ap.why_choose ?? []}
          onChange={(arr) => update("why_choose", arr)}
          placeholder="Prescriber-led, 10+ years experience…"
        />
      </ToggleCard>

      {/* WHAT TO EXPECT */}
      <ToggleCard
        title="What to expect"
        description="Walk patients through their first visit."
        enabled={ap.show_what_to_expect ?? false}
        onToggle={(v) => update("show_what_to_expect", v)}
      >
        <Textarea rows={5} value={ap.what_to_expect ?? ""} onChange={(e) => update("what_to_expect", e.target.value)} placeholder="On arrival you'll be greeted with…" />
      </ToggleCard>

      {/* SPECIALTIES */}
      <ToggleCard
        title="Specialties"
        description="Tag pills shown on the About page."
        enabled={ap.show_specialties ?? true}
        onToggle={(v) => update("show_specialties", v)}
      >
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Lip filler"
            value={specInput}
            onChange={(e) => setSpecInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (specInput.trim()) { setSpecialties([...specialties, specInput.trim()]); setSpecInput(""); }
              }
            }}
          />
          <Button type="button" onClick={() => { if (specInput.trim()) { setSpecialties([...specialties, specInput.trim()]); setSpecInput(""); } }}>Add</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {specialties.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
              {s}<button onClick={() => setSpecialties(specialties.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      </ToggleCard>

      {/* QUALIFICATIONS */}
      <ToggleCard
        title="Qualifications"
        description="Degrees, training and certifications."
        enabled={ap.show_qualifications ?? true}
        onToggle={(v) => update("show_qualifications", v)}
        action={<Button size="sm" variant="outline" onClick={() => setQuals([...quals, { label: "", year: "" }])}><Plus className="mr-1 h-4 w-4" />Add</Button>}
      >
        <div className="space-y-2">
          {quals.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Qualification" value={q.label} onChange={(e) => { const c = [...quals]; c[i] = { ...c[i], label: e.target.value }; setQuals(c); }} />
              <Input placeholder="Year" className="w-24" value={q.year ?? ""} onChange={(e) => { const c = [...quals]; c[i] = { ...c[i], year: e.target.value }; setQuals(c); }} />
              <Button variant="ghost" size="icon" onClick={() => setQuals(quals.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </ToggleCard>

      {/* TIMELINE */}
      <ToggleCard
        title="Experience timeline"
        description="Career milestones in date order."
        enabled={ap.show_timeline ?? true}
        onToggle={(v) => update("show_timeline", v)}
        action={<Button size="sm" variant="outline" onClick={() => setTimeline([...timeline, { year: "", label: "" }])}><Plus className="mr-1 h-4 w-4" />Add</Button>}
      >
        <div className="space-y-2">
          {timeline.map((t, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Year" className="w-24" value={t.year} onChange={(e) => { const c = [...timeline]; c[i] = { ...c[i], year: e.target.value }; setTimeline(c); }} />
              <Input placeholder="Milestone" value={t.label} onChange={(e) => { const c = [...timeline]; c[i] = { ...c[i], label: e.target.value }; setTimeline(c); }} />
              <Button variant="ghost" size="icon" onClick={() => setTimeline(timeline.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </ToggleCard>

      {/* LOCATIONS */}
      <ToggleCard
        title="Locations & addresses"
        description="All of your active locations show automatically with their full address. Manage them under Locations."
        enabled={ap.show_locations ?? true}
        onToggle={(v) => update("show_locations", v)}
      >
        <Button size="sm" variant="outline" asChild>
          <Link to="/dashboard/locations"><ExternalLink className="mr-1 h-4 w-4" /> Manage locations</Link>
        </Button>
      </ToggleCard>

      {/* OPENING HOURS */}
      <ToggleCard
        title="Opening hours"
        description="Day-by-day hours patients can read at a glance."
        enabled={ap.show_opening_hours ?? false}
        onToggle={(v) => update("show_opening_hours", v)}
        action={
          <Button size="sm" variant="outline" onClick={() => update("opening_hours", [...(ap.opening_hours ?? []), { day: "", hours: "" }])}>
            <Plus className="mr-1 h-4 w-4" />Add day
          </Button>
        }
      >
        <div className="space-y-2">
          {(ap.opening_hours ?? []).map((h, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Monday" className="w-32" value={h.day} onChange={(e) => {
                const c = [...(ap.opening_hours ?? [])]; c[i] = { ...c[i], day: e.target.value }; update("opening_hours", c);
              }} />
              <Input placeholder="9:00 – 17:00 (or 'Closed')" value={h.hours} onChange={(e) => {
                const c = [...(ap.opening_hours ?? [])]; c[i] = { ...c[i], hours: e.target.value }; update("opening_hours", c);
              }} />
              <Button variant="ghost" size="icon" onClick={() => update("opening_hours", (ap.opening_hours ?? []).filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ToggleCard>

      {/* FAQs */}
      <ToggleCard
        title="Frequently asked questions"
        description="Pre-empt the questions you get asked most."
        enabled={ap.show_faqs ?? false}
        onToggle={(v) => update("show_faqs", v)}
        action={
          <Button size="sm" variant="outline" onClick={() => update("faqs", [...(ap.faqs ?? []), { q: "", a: "" }])}>
            <Plus className="mr-1 h-4 w-4" />Add FAQ
          </Button>
        }
      >
        <div className="space-y-3">
          {(ap.faqs ?? []).map((f, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex gap-2">
                <Input placeholder="Question" value={f.q} onChange={(e) => {
                  const c = [...(ap.faqs ?? [])]; c[i] = { ...c[i], q: e.target.value }; update("faqs", c);
                }} />
                <Button variant="ghost" size="icon" onClick={() => update("faqs", (ap.faqs ?? []).filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea rows={3} placeholder="Answer" value={f.a} onChange={(e) => {
                const c = [...(ap.faqs ?? [])]; c[i] = { ...c[i], a: e.target.value }; update("faqs", c);
              }} />
            </div>
          ))}
        </div>
      </ToggleCard>

      {/* CONTACT */}
      <ToggleCard
        title="Contact block"
        description="Email, phone, and any extra contact info to show on the About page."
        enabled={ap.show_contact ?? false}
        onToggle={(v) => update("show_contact", v)}
      >
        <div className="space-y-3">
          <div><Label>Email</Label><Input type="email" value={ap.contact_email ?? ""} onChange={(e) => update("contact_email", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={ap.contact_phone ?? ""} onChange={(e) => update("contact_phone", e.target.value)} /></div>
          <div><Label>Extra info</Label><Textarea rows={3} value={ap.contact_extra ?? ""} onChange={(e) => update("contact_extra", e.target.value)} placeholder="Best time to reach us, Instagram DM preferred, etc." /></div>
        </div>
      </ToggleCard>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={onSave} disabled={saving} size="lg" className="shadow-lg">
          {saving ? "Saving…" : "Save About page"}
        </Button>
      </div>
    </div>
  );
}

function ToggleCard({
  title,
  description,
  enabled,
  onToggle,
  action,
  children,
}: {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </CardHeader>
      {enabled && <CardContent>{children}</CardContent>}
    </Card>
  );
}

function StringListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input value={v} placeholder={placeholder} onChange={(e) => {
            const c = [...items]; c[i] = e.target.value; onChange(c);
          }} />
          <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...items, ""])}>
        <Plus className="mr-1 h-4 w-4" /> Add item
      </Button>
    </div>
  );
}
