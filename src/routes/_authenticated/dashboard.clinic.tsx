import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile, getMyProfile } from "@/lib/profiles.functions";
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
  const router = useRouter();
  const update = useServerFn(updateProfile);
  const fetchProfile = useServerFn(getMyProfile);

  const [profileId, setProfileId] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [clinicName, setClinicName] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [brandColor, setBrandColor] = useState("#1f2a44");
  const [heroUrl, setHeroUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await fetchProfile();
      if (p) {
        setProfileId(p.id);
        setSlug(p.slug ?? "");
        setClinicName(p.clinic_name ?? "");
        setTagline(p.tagline ?? "");
        setAbout(p.about ?? "");
        setPhone(p.phone ?? "");
        setEmail(p.email ?? "");
        setBrandColor(p.brand_color ?? "#1f2a44");
        setHeroUrl(p.hero_url ?? "");
        const links = (p.social_links ?? {}) as { instagram?: string; facebook?: string; tiktok?: string };
        setInstagram(links.instagram ?? "");
        setFacebook(links.facebook ?? "");
        setTiktok(links.tiktok ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!profileId) return;
    setSaving(true);
    try {
      await update({
        data: {
          id: profileId,
          clinic_name: clinicName,
          tagline,
          about,
          phone,
          email,
          brand_color: brandColor,
          hero_url: heroUrl,
          social_links: {
            ...(instagram ? { instagram } : {}),
            ...(facebook ? { facebook } : {}),
            ...(tiktok ? { tiktok } : {}),
          },
        },
      });
      toast.success("Saved");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Clinic page</h1>
        <p className="text-muted-foreground">Your public booking page at /m/{slug}.</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand & hero</CardTitle>
          <CardDescription>Colour and hero image used on your public page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Brand colour</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border bg-transparent"
              />
              <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div>
            <Label>Hero image URL</Label>
            <Input value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)} placeholder="https://…" />
            {heroUrl && (
              <img src={heroUrl} alt="" className="mt-2 h-32 w-full rounded-md object-cover" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social links</CardTitle>
          <CardDescription>Shown as icons on your booking page.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Instagram</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle or full URL" /></div>
          <div><Label>Facebook</Label><Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Page URL" /></div>
          <div><Label>TikTok</Label><Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@handle or full URL" /></div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}
