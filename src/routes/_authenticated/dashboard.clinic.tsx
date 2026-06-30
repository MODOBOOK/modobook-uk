import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile, getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [fullName, setFullName] = useState("");
  const [displayNameMode, setDisplayNameMode] = useState<"clinic" | "practitioner" | "both">("both");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [smsNumber, setSmsNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    (async () => {
      const p = await fetchProfile();
      if (p) {
        setProfileId(p.id);
        setSlug(p.slug ?? "");
        setClinicName(p.clinic_name ?? "");
        setFullName(p.full_name ?? "");
        setDisplayNameMode(((p as { display_name_mode?: string }).display_name_mode as "clinic" | "practitioner" | "both") ?? "both");
        setTagline(p.tagline ?? "");

        setPhone(p.phone ?? "");
        setEmail(p.email ?? "");
        const links = (p.social_links ?? {}) as { instagram?: string; facebook?: string; tiktok?: string };
        setInstagram(links.instagram ?? "");
        setFacebook(links.facebook ?? "");
        setTiktok(links.tiktok ?? "");
        setSmsNumber((p as { contact_sms_number?: string | null }).contact_sms_number ?? "");
        setWhatsappNumber((p as { contact_whatsapp_number?: string | null }).contact_whatsapp_number ?? "");
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
          full_name: fullName,
          display_name_mode: displayNameMode,
          tagline,
          phone,
          email,
          social_links: {
            ...(instagram ? { instagram } : {}),
            ...(facebook ? { facebook } : {}),
            ...(tiktok ? { tiktok } : {}),
          },
          contact_sms_number: smsNumber || null,
          contact_whatsapp_number: whatsappNumber || null,
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
            <CardDescription>Basic business details. Add your patient-facing intro in Welcome & policies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Clinic name</Label><Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. Bloom Aesthetics" /></div>
          <div><Label>Practitioner name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Nurse Prescriber Ryan" /></div>
          <div>
            <Label>Display name on dashboard & booking page</Label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { v: "clinic", label: "Clinic name only", hint: "e.g. Bloom Aesthetics" },
                { v: "practitioner", label: "Practitioner name only", hint: "e.g. Nurse Prescriber Ryan" },
                { v: "both", label: "Show both", hint: "Clinic name with practitioner underneath" },
              ] as const).map((opt) => {
                const selected = displayNameMode === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setDisplayNameMode(opt.v)}
                    className={`rounded-md border p-3 text-left text-sm transition ${
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>



      <Card>
        <CardHeader>
          <CardTitle>Contact & social</CardTitle>
          <CardDescription>Patients can tap these to reach you directly from the booking page.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Text/SMS number</Label><Input value={smsNumber} onChange={(e) => setSmsNumber(e.target.value)} placeholder="+44…" /></div>
          <div><Label>WhatsApp number</Label><Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+44…" /></div>
          <div><Label>Instagram</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle or full URL" /></div>
          <div><Label>Facebook</Label><Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Page URL" /></div>
          <div><Label>TikTok</Label><Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@handle or full URL" /></div>
        </CardContent>
      </Card>


      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}
