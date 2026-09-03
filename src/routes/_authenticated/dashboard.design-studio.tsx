import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyTheme,
  saveThemeDraft,
  publishThemeDraft,
  discardThemeDraft,
  type ClinicThemeInput,
} from "@/lib/theme.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploader } from "@/components/ImageUploader";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Monitor,
  RefreshCw,
  Smartphone,
  Rocket,
  Undo2,
} from "lucide-react";
import { designStudioEnabled } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/dashboard/design-studio")({
  component: DesignStudioPage,
});

/** A neutral, unbranded MODO shell — the starting point for a new clinic. */
const BLANK: ClinicThemeInput = {
  primary_color: "#2b2118",
  accent_color: "#b08d57",
  background_color: "#ffffff",
  text_color: "#1c1917",
  header_bg_color: "#ffffff",
  header_text_color: "#1c1917",
  footer_bg_color: "#2b2118",
  footer_text_color: "#ffffff",
  menu_card_bg: "#ffffff",
  menu_card_border_color: "#e7e5e4",
  heading_font: "Syne",
  body_font: "Plus Jakarta Sans",
  logo_url: null,
  hero_image_url: null,
  hero_heading: null,
  hero_subheading: null,
};

const FONTS = [
  "Syne",
  "Plus Jakarta Sans",
  "Inter",
  "Playfair Display",
  "Cormorant Garamond",
  "DM Serif Display",
  "Fraunces",
  "Outfit",
  "Manrope",
  "Lora",
];

const COLOR_FIELDS: { key: keyof ClinicThemeInput; label: string; hint: string }[] = [
  { key: "primary_color", label: "Brand colour", hint: "Header, footer and category bands" },
  { key: "accent_color", label: "Accent", hint: "Prices and highlights" },
  { key: "background_color", label: "Page background", hint: "Behind everything" },
  { key: "text_color", label: "Text", hint: "Headings and treatment names" },
  { key: "menu_card_bg", label: "Card background", hint: "Treatment cards" },
];

function DesignStudioPage() {
  const fetchTheme = useServerFn(getMyTheme);
  const fetchProfile = useServerFn(getMyProfile);
  const saveDraft = useServerFn(saveThemeDraft);
  const publish = useServerFn(publishThemeDraft);
  const discard = useServerFn(discardThemeDraft);

  const [state, setState] = useState<ClinicThemeInput>({ ...BLANK });
  const [profileId, setProfileId] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [previewKey, setPreviewKey] = useState(0);
  const allowed = designStudioEnabled(slug);

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([fetchTheme(), fetchProfile()]);
      if (p) {
        setProfileId(p.id);
        setSlug((p as { slug?: string | null }).slug ?? null);
      }
      if (t) {
        const row = t as Record<string, unknown>;
        const draft = (row.draft ?? null) as ClinicThemeInput | null;
        setHasDraft(!!draft);
        setState({ ...BLANK, ...(row as unknown as ClinicThemeInput), ...(draft ?? {}) });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof ClinicThemeInput>(key: K, value: ClinicThemeInput[K]) {
    setState((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }

  // Brand colour cascades to the matching surfaces so the page stays coherent.
  function setColor(key: keyof ClinicThemeInput, value: string) {
    setState((s) => {
      const next = { ...s } as Record<string, unknown>;
      next[key as string] = value;
      if (key === "primary_color") {
        next.header_bg_color = value;
        next.footer_bg_color = value;
        next.menu_category_bg = value;
      }
      if (key === "accent_color") next.menu_price_color = value;
      if (key === "text_color") next.menu_treatment_name_color = value;
      if (key === "menu_card_bg") next.menu_card_border_color = value;
      return next as ClinicThemeInput;
    });
    setDirty(true);
  }

  const persistDraft = useCallback(
    async (silent = true) => {
      setSavingDraft(true);
      try {
        await saveDraft({ data: state });
        setHasDraft(true);
        setDirty(false);
        setPreviewKey((k) => k + 1);
        if (!silent) toast.success("Draft saved — not live yet");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save draft");
      } finally {
        setSavingDraft(false);
      }
    },
    [saveDraft, state],
  );

  // Debounced autosave so the preview follows along as they design.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading || !dirty || !allowed) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persistDraft(true), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, dirty, loading, allowed, persistDraft]);

  async function handlePublish() {
    setBusy(true);
    try {
      if (dirty) await saveDraft({ data: state });
      await publish({});
      setHasDraft(false);
      setDirty(false);
      setPreviewKey((k) => k + 1);
      toast.success("Published — your booking page is live");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    setBusy(true);
    try {
      await discard({});
      const t = await fetchTheme();
      setState({ ...BLANK, ...((t ?? {}) as unknown as ClinicThemeInput) });
      setHasDraft(false);
      setDirty(false);
      setPreviewKey((k) => k + 1);
      toast.success("Draft discarded — back to what's live");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not discard draft");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Design studio</h1>
        <p className="text-sm text-muted-foreground">
          The live design studio is being trialled with a small group of clinics first. Your
          branding controls are all available on the Branding page in the meantime.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard/branding">Go to Branding</Link>
        </Button>
      </div>
    );
  }

  const steps = [
    { done: !!state.logo_url, label: "Add your logo" },
    { done: !!state.hero_image_url, label: "Add a banner photo" },
    { done: state.primary_color !== BLANK.primary_color, label: "Pick your brand colour" },
    { done: !!state.hero_heading, label: "Write a welcome headline" },
  ];

  const previewSrc = slug ? `/m/${slug}?draft=1&v=${previewKey}` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/dashboard/branding">
              <ArrowLeft className="mr-1 h-4 w-4" /> Branding
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Design studio</h1>
          <p className="text-sm text-muted-foreground">
            Change colours and photos on the left and watch your booking page update on the right.
            Nothing goes live until you publish.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {savingDraft ? "Saving draft…" : hasDraft ? "Draft saved — not live" : "Matches what's live"}
          </span>
          {hasDraft && (
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={busy}>
              <Undo2 className="mr-1 h-4 w-4" /> Discard
            </Button>
          )}
          <Button size="sm" onClick={handlePublish} disabled={busy || (!hasDraft && !dirty)}>
            <Rocket className="mr-1 h-4 w-4" /> {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Getting started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  {s.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your pictures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploader
                label="Logo"
                value={state.logo_url}
                onChange={(v) => set("logo_url", v)}
                profileId={profileId}
                folder="logo"
                previewClass="mt-2 h-16 object-contain rounded bg-muted/30 p-2"
              />
              <ImageUploader
                label="Banner photo"
                value={state.hero_image_url}
                onChange={(v) => set("hero_image_url", v)}
                profileId={profileId}
                folder="hero"
                previewClass="mt-2 h-32 w-full rounded-md bg-muted/30 object-cover"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Colours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {COLOR_FIELDS.map((f) => (
                <div key={f.key as string} className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={f.label}
                    value={(state[f.key] as string) || "#ffffff"}
                    onChange={(e) => setColor(f.key, e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.hint}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Words &amp; fonts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="hero_heading">Welcome headline</Label>
                <Input
                  id="hero_heading"
                  value={state.hero_heading ?? ""}
                  placeholder="e.g. Advanced aesthetics, done properly"
                  onChange={(e) => set("hero_heading", e.target.value || null)}
                />
              </div>
              <div>
                <Label htmlFor="hero_subheading">Sub-heading</Label>
                <Input
                  id="hero_subheading"
                  value={state.hero_subheading ?? ""}
                  placeholder="e.g. Book online in under a minute"
                  onChange={(e) => set("hero_subheading", e.target.value || null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="heading_font">Heading font</Label>
                  <select
                    id="heading_font"
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={state.heading_font ?? "Syne"}
                    onChange={(e) => set("heading_font", e.target.value)}
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="body_font">Body font</Label>
                  <select
                    id="body_font"
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={state.body_font ?? "Plus Jakarta Sans"}
                    onChange={(e) => set("body_font", e.target.value)}
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Everything else — welcome card, layout, buttons and menu styling — still lives on the{" "}
            <Link to="/dashboard/branding" className="underline">Branding page</Link>.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">Live preview</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant={device === "mobile" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice("mobile")}
                aria-label="Mobile preview"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <Button
                variant={device === "desktop" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice("desktop")}
                aria-label="Desktop preview"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void persistDraft(false)}
                aria-label="Refresh preview"
              >
                <RefreshCw className={`h-4 w-4 ${savingDraft ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="bg-muted/30 p-3">
            {previewSrc ? (
              <div className="mx-auto overflow-hidden rounded-xl border border-border bg-background shadow-sm" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
                <iframe
                  key={previewKey}
                  src={previewSrc}
                  title="Booking page preview"
                  className="h-[70vh] w-full"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Set your booking link first to see a preview.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
