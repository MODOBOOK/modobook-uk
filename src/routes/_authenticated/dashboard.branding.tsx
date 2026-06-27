import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyTheme, upsertMyTheme, type ClinicThemeInput } from "@/lib/theme.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploader } from "@/components/ImageUploader";
import { toast } from "sonner";
import { Palette } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/branding")({
  component: BrandingPage,
});

const DEFAULTS: Required<
  Pick<
    ClinicThemeInput,
    | "primary_color"
    | "accent_color"
    | "background_color"
    | "text_color"
    | "header_bg_color"
    | "header_text_color"
    | "footer_bg_color"
    | "footer_text_color"
    | "heading_font"
    | "body_font"
  >
> = {
  primary_color: "#0f172a",
  accent_color: "#d4af37",
  background_color: "#ffffff",
  text_color: "#0f172a",
  header_bg_color: "#ffffff",
  header_text_color: "#0f172a",
  footer_bg_color: "#0f172a",
  footer_text_color: "#ffffff",
  heading_font: "Inter",
  body_font: "Inter",
};

const FONTS = [
  "Inter",
  "Playfair Display",
  "Cormorant Garamond",
  "Montserrat",
  "Poppins",
  "DM Serif Display",
  "Lora",
  "Outfit",
  "Figtree",
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function BrandingPage() {
  const fetchTheme = useServerFn(getMyTheme);
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(upsertMyTheme);
  const [state, setState] = useState<ClinicThemeInput>({ ...DEFAULTS });
  const [profileId, setProfileId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([fetchTheme(), fetchProfile()]);
      if (t) setState({ ...DEFAULTS, ...t });
      if (p) setProfileId(p.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof ClinicThemeInput>(key: K, value: ClinicThemeInput[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: state });
      toast.success("Branding saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Branding</h1>
          <p className="text-sm text-muted-foreground">
            Colors, typography, logo and hero image shown on your MODO Book page.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Core colors
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Primary" value={state.primary_color ?? ""} onChange={(v) => set("primary_color", v)} />
          <ColorField label="Accent" value={state.accent_color ?? ""} onChange={(v) => set("accent_color", v)} />
          <ColorField label="Background" value={state.background_color ?? ""} onChange={(v) => set("background_color", v)} />
          <ColorField label="Body text" value={state.text_color ?? ""} onChange={(v) => set("text_color", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Header & footer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Header background" value={state.header_bg_color ?? ""} onChange={(v) => set("header_bg_color", v)} />
          <ColorField label="Header text" value={state.header_text_color ?? ""} onChange={(v) => set("header_text_color", v)} />
          <ColorField label="Footer background" value={state.footer_bg_color ?? ""} onChange={(v) => set("footer_bg_color", v)} />
          <ColorField label="Footer text" value={state.footer_text_color ?? ""} onChange={(v) => set("footer_text_color", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Typography</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Heading font</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={state.heading_font ?? "Inter"}
              onChange={(e) => set("heading_font", e.target.value)}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Body font</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={state.body_font ?? "Inter"}
              onChange={(e) => set("body_font", e.target.value)}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo, favicon & hero image</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Logo URL</Label>
            <Input
              placeholder="https://…/logo.png"
              value={state.logo_url ?? ""}
              onChange={(e) => set("logo_url", e.target.value || null)}
            />
            {state.logo_url && (
              <img src={state.logo_url} alt="logo" className="mt-2 h-12 object-contain" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Favicon URL</Label>
            <Input
              placeholder="https://…/favicon.ico"
              value={state.favicon_url ?? ""}
              onChange={(e) => set("favicon_url", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hero image URL</Label>
            <Input
              placeholder="https://…/hero.jpg"
              value={state.hero_image_url ?? ""}
              onChange={(e) => set("hero_image_url", e.target.value || null)}
            />
          </div>
          {state.hero_image_url && (
            <div className="sm:col-span-2">
              <img
                src={state.hero_image_url}
                alt="hero"
                className="h-40 w-full rounded-md object-cover"
              />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Hero heading</Label>
            <Input
              value={state.hero_heading ?? ""}
              onChange={(e) => set("hero_heading", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Hero subheading</Label>
            <Textarea
              rows={2}
              value={state.hero_subheading ?? ""}
              onChange={(e) => set("hero_subheading", e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-hidden rounded-lg border"
            style={{ background: state.background_color, color: state.text_color, fontFamily: state.body_font }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: state.header_bg_color, color: state.header_text_color }}
            >
              <div className="flex items-center gap-2">
                {state.logo_url ? (
                  <img src={state.logo_url} alt="" className="h-6 object-contain" />
                ) : (
                  <div className="h-6 w-6 rounded" style={{ background: state.primary_color }} />
                )}
                <span style={{ fontFamily: state.heading_font }} className="text-sm font-semibold">
                  Your Clinic
                </span>
              </div>
              <span className="text-xs opacity-70">Book · About · Reviews</span>
            </div>
            <div className="p-6">
              <h2 style={{ fontFamily: state.heading_font }} className="text-2xl font-semibold">
                {state.hero_heading || "Beautiful, natural results."}
              </h2>
              <p className="mt-2 text-sm opacity-80">
                {state.hero_subheading || "Book a consultation with a trusted practitioner."}
              </p>
              <button
                className="mt-4 rounded-md px-4 py-2 text-sm font-medium"
                style={{ background: state.primary_color, color: state.background_color }}
              >
                Book now
              </button>
              <span
                className="ml-2 rounded-md px-3 py-2 text-sm font-medium"
                style={{ color: state.accent_color, border: `1px solid ${state.accent_color}` }}
              >
                View treatments
              </span>
            </div>
            <div
              className="px-4 py-3 text-xs"
              style={{ background: state.footer_bg_color, color: state.footer_text_color }}
            >
              © Your Clinic · Powered by MODO Book
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
