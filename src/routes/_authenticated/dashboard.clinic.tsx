import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/clinic")({
  ssr: false,
  component: ClinicPage,
});

function ClinicPage() {
  const { profile } = Route.useRouteContext() as { profile: { id: string; clinic_name: string | null; tagline: string | null; about: string | null; phone: string | null; email: string | null; slug: string } };
  const router = useRouter();
  const update = useServerFn(updateProfile);
  const [clinicName, setClinicName] = useState(profile.clinic_name ?? "");
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [about, setAbout] = useState(profile.about ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await update({ data: { clinic_name: clinicName, tagline, about, phone, email } });
      toast.success("Saved");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Clinic page</h1>
        <p className="text-muted-foreground">Your public booking page at /m/{profile.slug}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Shown on your MODO Book page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Clinic name</Label><Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} /></div>
          <div><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
          <div><Label>About</Label><Textarea rows={5} value={about} onChange={(e) => setAbout(e.target.value)} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
