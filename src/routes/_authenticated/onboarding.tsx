import { useState } from "react";
import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { createProfile, getMyProfile, checkSlugAvailable } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { debounce } from "@/lib/debounce";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await getMyProfile();
    if (profile) {
      throw redirect({ to: "/dashboard" });
    }
    const { getHubContext } = await import("@/lib/hub.functions");
    const ctx = await getHubContext().catch(() => null);
    if (ctx?.role === "prescriber") {
      throw redirect({ to: "/prescriber" });
    }
  },

  component: OnboardingPage,
});

function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    clinic_name: "",
    slug: "",
    tagline: "",
    intro_heading: "",
    intro_body: "",
    phone: "",
    address_line1: "",
    city: "",
    postcode: "",
    brand_color: "#111827",
  });
  const [slugValid, setSlugValid] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  const checkSlug = debounce(async (slug: string) => {
    if (slug.length < 3) {
      setSlugValid(null);
      setSlugChecking(false);
      return;
    }
    setSlugChecking(true);
    try {
      const result = await checkSlugAvailable({ data: { slug } });
      setSlugValid(result.available);
    } catch {
      setSlugValid(false);
    } finally {
      setSlugChecking(false);
    }
  }, 400);

  function handleSlugChange(value: string) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, slug }));
    setSlugValid(null);
    setSlugChecking(true);
    checkSlug(slug);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slugValid) {
      toast.error("Choose an available booking link.");
      return;
    }
    setLoading(true);
    try {
      await createProfile({
        data: {
          full_name: form.full_name,
          clinic_name: form.clinic_name,
          slug: form.slug,
          tagline: form.tagline,
          welcome_intro_html: textToParagraphHtml(form.intro_body),
          about_page: { intro_heading: form.intro_heading, show_intro: true },
          phone: form.phone,
          address: {
            line1: form.address_line1,
            city: form.city,
            postcode: form.postcode,
          },
          brand_color: form.brand_color,
        },
      });
      toast.success("Profile created. Welcome to your dashboard!");
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set up your clinic</h1>
          <p className="text-muted-foreground">Tell us a few details so patients can book with you.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Clinic details</CardTitle>
            <CardDescription>You can change all of this later in your dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Your full name</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic_name">Clinic name</Label>
                  <Input
                    id="clinic_name"
                    value={form.clinic_name}
                    onChange={(e) => setForm((f) => ({ ...f, clinic_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Booking link</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/</span>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                    minLength={3}
                    placeholder="your-clinic"
                    className="flex-1"
                  />
                  {slugChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!slugChecking && slugValid === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {!slugChecking && slugValid === false && <span className="text-xs text-destructive">Taken</span>}
                </div>
                <p className="text-xs text-muted-foreground">Patients will use this link to book. Use only letters, numbers and hyphens.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                  placeholder="e.g. Medical aesthetics in central London"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro_heading">Welcome intro heading</Label>
                <Input
                  id="intro_heading"
                  value={form.intro_heading}
                  onChange={(e) => setForm((f) => ({ ...f, intro_heading: e.target.value }))}
                  placeholder="e.g. Welcome to your skin and aesthetics clinic"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro_body">Welcome intro text</Label>
                <Textarea
                  id="intro_body"
                  value={form.intro_body}
                  onChange={(e) => setForm((f) => ({ ...f, intro_body: e.target.value }))}
                  placeholder="A short welcome message for patients on your booking link."
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_color">Brand colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="brand_color"
                      type="color"
                      value={form.brand_color}
                      onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                      className="h-10 w-10 rounded border bg-transparent p-1"
                    />
                    <Input value={form.brand_color} onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Clinic address</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    placeholder="Street address"
                    value={form.address_line1}
                    onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                  />
                  <Input
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                  <Input
                    placeholder="Postcode"
                    value={form.postcode}
                    onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !slugValid}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create clinic profile
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function textToParagraphHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}
