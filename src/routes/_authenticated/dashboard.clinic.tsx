import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile, getMyProfile, checkSlugAvailable } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { SaveReminder } from "@/components/SaveReminder";
import { buildBookingUrl, bookingUrlLabel } from "@/lib/booking-url";
import { Check, X, Loader2, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/clinic")({
  ssr: false,
  component: ClinicPage,
});

function ClinicPage() {
  const router = useRouter();
  const update = useServerFn(updateProfile);
  const fetchProfile = useServerFn(getMyProfile);
  const checkSlug = useServerFn(checkSlugAvailable);

  const [savedSlug, setSavedSlug] = useState<string>("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

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
        setSavedSlug(p.slug ?? "");
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

  // Debounced slug availability check
  useEffect(() => {
    const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!profileId) return;
    if (normalized === savedSlug) { setSlugStatus("idle"); return; }
    if (normalized.length < 3) { setSlugStatus("invalid"); return; }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await checkSlug({ data: { slug: normalized, excludeOwn: profileId } });
        setSlugStatus(res.available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, profileId, savedSlug]);

  async function save() {
    if (!profileId) return;
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (normalizedSlug !== savedSlug) {
      if (normalizedSlug.length < 3) { toast.error("Booking link must be at least 3 characters"); return; }
      if (slugStatus === "taken") { toast.error("That booking link is taken"); return; }
    }
    setSaving(true);
    try {
      await update({
        data: {
          id: profileId,
          slug: normalizedSlug,
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

      setSavedSlug(normalizedSlug);
      setSlug(normalizedSlug);
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
        <p className="text-muted-foreground">Your public booking page at {bookingUrlLabel(savedSlug || slug)}.</p>
      </div>
      <SaveReminder />

      <Card>
        <CardHeader>
          <CardTitle>Booking link</CardTitle>
          <CardDescription>Change the name at the end of your booking URL. Existing links using the old name will stop working.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Booking link</Label>
            <div className="mt-1 flex items-stretch gap-2">
              <div className="flex flex-1 items-stretch rounded-md border overflow-hidden">
                <span className="px-3 flex items-center bg-muted text-sm text-muted-foreground select-none">modobook.uk/m/</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="your-clinic"
                  className="border-0 rounded-none focus-visible:ring-0"
                />
                <span className="px-3 flex items-center">
                  {slugStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {slugStatus === "available" && <Check className="h-4 w-4 text-emerald-600" />}
                  {(slugStatus === "taken" || slugStatus === "invalid") && <X className="h-4 w-4 text-destructive" />}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const url = buildBookingUrl(savedSlug || slug);
                  navigator.clipboard.writeText(url).then(() => toast.success("Copied"));
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {slugStatus === "taken" && <span className="text-destructive">That name is already taken.</span>}
              {slugStatus === "invalid" && <span className="text-destructive">Use at least 3 characters — letters, numbers or hyphens.</span>}
              {slugStatus === "available" && <span className="text-emerald-600">Available. Save to update your link.</span>}
              {slugStatus === "idle" && <>Full URL: {buildBookingUrl(savedSlug || slug)}</>}
              {slugStatus === "checking" && <>Checking availability…</>}
            </p>
          </div>
        </CardContent>
      </Card>

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

      <LoginEmailCard />

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}

function LoginEmailCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrent(data.user?.email ?? "");
      setNext(data.user?.email ?? "");
    });
  }, []);

  async function change() {
    const email = next.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/dashboard/clinic` },
      );
      if (error) throw error;
      setSent(true);
      toast.success("Confirmation link sent — check both inboxes to finish the change");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change login email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login email</CardTitle>
        <CardDescription>
          The address you sign in with. Changing it sends a confirmation link — the change only
          takes effect once you click it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>New login email</Label>
          <Input type="email" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        {sent && (
          <p className="text-xs text-muted-foreground">
            Confirmation sent. Until it&rsquo;s confirmed, keep signing in with {current}.
          </p>
        )}
        <Button
          variant="outline"
          onClick={change}
          disabled={busy || !next.trim() || next.trim().toLowerCase() === current.toLowerCase()}
        >
          {busy ? "Sending…" : "Change login email"}
        </Button>
      </CardContent>
    </Card>
  );
}

