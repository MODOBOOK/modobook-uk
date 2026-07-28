import { useState } from "react";
import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { createProfile, getMyProfile, checkSlugAvailable } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, Sparkles, PencilLine, ArrowLeft, ArrowRight } from "lucide-react";
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

const STEPS = [
  { title: "How would you like to start?", hint: "You can change everything later." },
  { title: "The basics", hint: "Your name, clinic and booking link." },
  { title: "Contact & location", hint: "So patients know where to find you." },
  { title: "Your look & welcome", hint: "Optional — skip if you're in a hurry." },
];

function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [useAi, setUseAi] = useState<boolean | null>(null);
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
  const [slugTouched, setSlugTouched] = useState(false);

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

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function applySlug(raw: string) {
    const slug = slugify(raw);
    setForm((f) => ({ ...f, slug }));
    setSlugValid(null);
    setSlugChecking(true);
    checkSlug(slug);
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    applySlug(value);
  }

  // Auto-suggest the booking link from the clinic name until the user edits it.
  function handleClinicNameChange(value: string) {
    setForm((f) => ({ ...f, clinic_name: value }));
    if (!slugTouched) applySlug(value);
  }

  const canContinue =
    step === 0
      ? useAi !== null
      : step === 1
        ? Boolean(form.full_name.trim() && form.clinic_name.trim() && slugValid)
        : true;

  async function handleSubmit() {
    if (!slugValid) {
      toast.error("Choose an available booking link.");
      setStep(1);
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
      toast.success("Clinic created — welcome to MODO.");
      router.navigate({ to: useAi ? "/dashboard/ai-import" : "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-2xl tracking-tight">{STEPS[step].title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].hint}</p>
        </div>

        <Progress value={((step + 1) / STEPS.length) * 100} className="mb-4 h-2" />

        <Card>
          <CardContent className="space-y-6 p-5 sm:p-6">
            {step === 0 && (
              <div className="space-y-3">
                <ChoiceTile
                  selected={useAi === true}
                  onClick={() => setUseAi(true)}
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Set up with AI"
                  description="Upload a price list, PDF, photos or your website and we'll create your treatments and branding for you."
                />
                <ChoiceTile
                  selected={useAi === false}
                  onClick={() => setUseAi(false)}
                  icon={<PencilLine className="h-5 w-5" />}
                  title="Set it up myself"
                  description="Add your treatments and availability manually — a checklist on your dashboard will guide you."
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Your full name</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinic_name">Clinic name</Label>
                    <Input
                      id="clinic_name"
                      value={form.clinic_name}
                      onChange={(e) => handleClinicNameChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Booking link</Label>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-sm text-muted-foreground">/m/</span>
                    <Input
                      id="slug"
                      value={form.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      minLength={3}
                      placeholder="your-clinic"
                      className="flex-1"
                    />
                    {slugChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!slugChecking && slugValid === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {!slugChecking && slugValid === false && <span className="text-xs text-destructive">Taken</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We've suggested one from your clinic name — edit it if you'd like.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
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
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
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
                  <Label htmlFor="brand_color">Brand colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="brand_color"
                      type="color"
                      value={form.brand_color}
                      onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                      className="h-10 w-10 rounded border bg-transparent p-1"
                    />
                    <Input
                      value={form.brand_color}
                      onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intro_heading">Welcome heading</Label>
                  <Input
                    id="intro_heading"
                    value={form.intro_heading}
                    onChange={(e) => setForm((f) => ({ ...f, intro_heading: e.target.value }))}
                    placeholder="e.g. Welcome to your skin and aesthetics clinic"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intro_body">Welcome message</Label>
                  <Textarea
                    id="intro_body"
                    value={form.intro_body}
                    onChange={(e) => setForm((f) => ({ ...f, intro_body: e.target.value }))}
                    placeholder="A short welcome message for patients on your booking link."
                    rows={4}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || loading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>

              {step < STEPS.length - 1 ? (
                <div className="flex items-center gap-2">
                  {step > 1 && (
                    <Button type="button" variant="ghost" onClick={() => setStep(STEPS.length - 1)} disabled={loading}>
                      Skip
                    </Button>
                  )}
                  <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={loading || !slugValid}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create my clinic
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Everything here can be changed later in your dashboard.
        </p>
      </div>
    </div>
  );
}

function ChoiceTile({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"
      }`}
    >
      <span
        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
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
