import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/profiles.functions";
import { updatePractitionerBio } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/bio")({
  component: BioEditor,
});

type Qual = { label: string; year?: string };
type TL = { year: string; label: string };

function BioEditor() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updatePractitionerBio);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState("");
  const [quals, setQuals] = useState<Qual[]>([]);
  const [timeline, setTimeline] = useState<TL[]>([]);

  useEffect(() => {
    (async () => {
      const p = await fetchProfile();
      if (p) {
        setBio(p.bio ?? "");
        setAvatar(p.avatar_url ?? "");
        setSpecialties(p.specialties ?? []);
        setQuals((p.qualifications as Qual[] | null) ?? []);
        setTimeline((p.timeline as TL[] | null) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { bio, avatar_url: avatar, specialties, qualifications: quals, timeline } });
      toast.success("Bio saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bio page</h1>
        <p className="text-sm text-muted-foreground">This appears on your public MODO Book bio page.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Photo & biography</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Avatar URL</Label><Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" /></div>
          <div><Label>Biography</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={8} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Specialties</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="e.g. Lip filler" value={specInput} onChange={(e) => setSpecInput(e.target.value)} onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (specInput.trim()) { setSpecialties([...specialties, specInput.trim()]); setSpecInput(""); } }
            }} />
            <Button type="button" onClick={() => { if (specInput.trim()) { setSpecialties([...specialties, specInput.trim()]); setSpecInput(""); } }}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {specialties.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                {s}<button onClick={() => setSpecialties(specialties.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Qualifications</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setQuals([...quals, { label: "", year: "" }])}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {quals.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Qualification" value={q.label} onChange={(e) => { const c = [...quals]; c[i] = { ...c[i], label: e.target.value }; setQuals(c); }} />
              <Input placeholder="Year" className="w-24" value={q.year ?? ""} onChange={(e) => { const c = [...quals]; c[i] = { ...c[i], year: e.target.value }; setQuals(c); }} />
              <Button variant="ghost" size="icon" onClick={() => setQuals(quals.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Experience timeline</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setTimeline([...timeline, { year: "", label: "" }])}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {timeline.map((t, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Year" className="w-24" value={t.year} onChange={(e) => { const c = [...timeline]; c[i] = { ...c[i], year: e.target.value }; setTimeline(c); }} />
              <Input placeholder="Milestone" value={t.label} onChange={(e) => { const c = [...timeline]; c[i] = { ...c[i], label: e.target.value }; setTimeline(c); }} />
              <Button variant="ghost" size="icon" onClick={() => setTimeline(timeline.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save bio"}</Button>
    </div>
  );
}
