import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile, getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/about")({
  ssr: false,
  component: AboutEditor,
});

type Hours = { day: string; hours: string };
type FAQ = { q: string; a: string };

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

function AboutEditor() {
  const router = useRouter();
  const update = useServerFn(updateProfile);
  const fetchProfile = useServerFn(getMyProfile);

  const [profileId, setProfileId] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ap, setAp] = useState<AboutPage>({});

  useEffect(() => {
    (async () => {
      const p = await fetchProfile();
      if (p) {
        setProfileId(p.id);
        setSlug(p.slug ?? "");
        setAp(((p as { about_page?: AboutPage }).about_page ?? {}) as AboutPage);
      }
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof AboutPage>(k: K, v: AboutPage[K]) => setAp((s) => ({ ...s, [k]: v }));
  const show = (k: keyof AboutPage, def: boolean) => (ap[k] === undefined ? def : Boolean(ap[k]));

  function addWhy() { set("why_choose", [...(ap.why_choose ?? []), ""]); }
  function setWhy(i: number, v: string) {
    const arr = [...(ap.why_choose ?? [])]; arr[i] = v; set("why_choose", arr);
  }
  function delWhy(i: number) { set("why_choose", (ap.why_choose ?? []).filter((_, j) => j !== i)); }

  function addHours() { set("opening_hours", [...(ap.opening_hours ?? []), { day: "", hours: "" }]); }
  function setHour(i: number, patch: Partial<Hours>) {
    const arr = [...(ap.opening_hours ?? [])]; arr[i] = { ...arr[i], ...patch }; set("opening_hours", arr);
  }
  function delHour(i: number) { set("opening_hours", (ap.opening_hours ?? []).filter((_, j) => j !== i)); }

  function addFaq() { set("faqs", [...(ap.faqs ?? []), { q: "", a: "" }]); }
  function setFaq(i: number, patch: Partial<FAQ>) {
    const arr = [...(ap.faqs ?? [])]; arr[i] = { ...arr[i], ...patch }; set("faqs", arr);
  }
  function delFaq(i: number) { set("faqs", (ap.faqs ?? []).filter((_, j) => j !== i)); }

  async function save() {
    if (!profileId) return;
    setSaving(true);
    try {
      await update({ data: { id: profileId, about_page: ap as Record<string, unknown> } });
      toast.success("About page saved");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const ToggleRow = ({ k, label, hint, def }: { k: keyof AboutPage; label: string; hint?: string; def: boolean }) => (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={show(k, def)} onCheckedChange={(v) => set(k, v as never)} />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">About page</h1>
          <p className="text-muted-foreground text-sm">Lives at /m/{slug || "your-slug"}/about. Names come from <Link to="/dashboard/clinic" className="underline">Clinic page</Link>.</p>
        </div>
        {slug && (
          <a href={`/m/${slug}/about`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
            Preview <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hero & intro</CardTitle>
          <CardDescription>The headline patients see at the top of your about page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow k="show_hero_image" label="Show hero image" hint="Uses your branding hero by default" def={true} />
          <div><Label>Hero image URL (optional override)</Label><Input value={ap.hero_image_url ?? ""} onChange={(e) => set("hero_image_url", e.target.value)} placeholder="https://…" /></div>
          <ToggleRow k="show_intro" label="Show intro section" def={true} />
          <div><Label>Intro heading</Label><Input value={ap.intro_heading ?? ""} onChange={(e) => set("intro_heading", e.target.value)} placeholder="e.g. Welcome to Aesthetics by Nurse Ryan" /></div>
          <div><Label>Intro body</Label><Textarea rows={5} value={ap.intro_body ?? ""} onChange={(e) => set("intro_body", e.target.value)} placeholder="Introduce yourself and your clinic…" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approach & values</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow k="show_mission" label="Show 'My approach'" def={false} />
          <div><Label>My approach</Label><Textarea rows={4} value={ap.mission ?? ""} onChange={(e) => set("mission", e.target.value)} /></div>

          <ToggleRow k="show_why_choose" label="Show 'Why choose us'" def={false} />
          <div className="space-y-2">
            <Label>Why choose us (bullets)</Label>
            {(ap.why_choose ?? []).map((w, i) => (
              <div key={i} className="flex gap-2">
                <Input value={w} onChange={(e) => setWhy(i, e.target.value)} placeholder="e.g. Prescribing nurse with 8+ years experience" />
                <Button type="button" variant="ghost" size="icon" onClick={() => delWhy(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addWhy}><Plus className="h-4 w-4 mr-1" />Add bullet</Button>
          </div>

          <ToggleRow k="show_what_to_expect" label="Show 'What to expect'" def={false} />
          <div><Label>What to expect</Label><Textarea rows={4} value={ap.what_to_expect ?? ""} onChange={(e) => set("what_to_expect", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credentials & locations</CardTitle>
          <CardDescription>These pull from your existing profile fields and Locations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow k="show_specialties" label="Show specialties" def={true} />
          <ToggleRow k="show_qualifications" label="Show qualifications" def={true} />
          <ToggleRow k="show_timeline" label="Show experience timeline" def={true} />
          <ToggleRow k="show_locations" label="Show locations" def={true} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opening hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow k="show_opening_hours" label="Show opening hours" def={false} />
          {(ap.opening_hours ?? []).map((h, i) => (
            <div key={i} className="flex gap-2">
              <Input value={h.day} onChange={(e) => setHour(i, { day: e.target.value })} placeholder="Mon" className="w-32" />
              <Input value={h.hours} onChange={(e) => setHour(i, { hours: e.target.value })} placeholder="9am – 6pm" />
              <Button type="button" variant="ghost" size="icon" onClick={() => delHour(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addHours}><Plus className="h-4 w-4 mr-1" />Add row</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow k="show_faqs" label="Show FAQs" def={false} />
          {(ap.faqs ?? []).map((f, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <Input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} placeholder="Question" />
              <Textarea rows={3} value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} placeholder="Answer" />
              <Button type="button" variant="ghost" size="sm" onClick={() => delFaq(i)}><Trash2 className="h-4 w-4 mr-1" />Remove</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addFaq}><Plus className="h-4 w-4 mr-1" />Add FAQ</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow k="show_contact" label="Show contact section" def={false} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Contact email</Label><Input type="email" value={ap.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></div>
            <div><Label>Contact phone</Label><Input value={ap.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></div>
          </div>
          <div><Label>Extra info</Label><Textarea rows={3} value={ap.contact_extra ?? ""} onChange={(e) => set("contact_extra", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Save about page"}</Button>
    </div>
  );
}
