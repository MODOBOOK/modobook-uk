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
import { Palette, Check, X, Wand2 } from "lucide-react";
import { PRESETS, LAYOUTS, type ThemePresetKey, type BookingLayoutKey, type ThemePreset } from "@/lib/theme-presets";
import { COLOR_PALETTES, CUSTOM_PALETTE_SLOTS, buildCustomPalette, type ColorPalette } from "@/lib/color-palettes";
import { SaveReminder } from "@/components/SaveReminder";

export const Route = createFileRoute("/_authenticated/dashboard/branding")({
  component: BrandingPage,
});

const DEFAULTS: ClinicThemeInput = {
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
  layout_key: "classic",
  hero_carousel_enabled: false,
  hero_carousel_urls: [],
  welcome_card_show_logo: true,
  welcome_card_show_name: true,
  welcome_card_show_tagline: false,
  welcome_card_show_rating: true,
  welcome_card_show_actions: true,
  welcome_card_show_contact: true,
  welcome_card_show_sms: true,
  welcome_card_show_whatsapp: true,
  welcome_card_show_instagram: true,
  welcome_card_show_facebook: true,
  welcome_card_size: "medium",
  welcome_card_mobile_size: "medium",
  welcome_card_position: "overlap",
  welcome_card_background_type: "solid",
  welcome_card_bg_color: "#ffffff",
  welcome_card_gradient_from: "#ffffff",
  welcome_card_gradient_to: "#f3f4f6",
  welcome_card_border_color: "#e5e7eb",
  welcome_card_border_radius: "1rem",
  welcome_card_border_width: "1px",
  welcome_card_padding: "1.25rem",
  welcome_card_shadow: "0 10px 40px rgba(15,23,42,0.08)",
  welcome_card_opacity: 1,
  welcome_card_blur: 0,
};

const FONTS = [
  "Inter",
  "Plus Jakarta Sans",
  "Syne",
  "Bricolage Grotesque",
  "Manrope",
  "Playfair Display",
  "Cormorant Garamond",
  "Crimson Pro",
  "DM Serif Display",
  "Fraunces",
  "Outfit",
  "Montserrat",
  "Poppins",
  "Lora",
  "Figtree",
];


function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded border bg-transparent" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function parseUrls(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
  }
  return [];
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
      if (t) {
        const merged: ClinicThemeInput = {
          ...DEFAULTS,
          ...(t as Record<string, unknown> as ClinicThemeInput),
          hero_carousel_urls: parseUrls((t as Record<string, unknown>).hero_carousel_urls),
        };
        setState(merged);
      }
      if (p) setProfileId(p.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof ClinicThemeInput>(key: K, value: ClinicThemeInput[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function applyPreset(preset: ThemePreset) {
    setState((s) => ({
      ...s,
      preset_key: preset.key,
      layout_key: preset.layout_key,
      heading_font: preset.heading_font,
      body_font: preset.body_font,
      primary_color: preset.primary_color,
      accent_color: preset.accent_color,
      background_color: preset.background_color,
      text_color: preset.text_color,
      header_bg_color: preset.header_bg_color,
      header_text_color: preset.header_text_color,
      footer_bg_color: preset.footer_bg_color,
      footer_text_color: preset.footer_text_color,
      menu_card_bg: preset.menu_card_bg,
      menu_card_border_color: preset.menu_card_border_color,
      menu_category_bg: preset.menu_category_bg,
      menu_category_text: preset.menu_category_text,
      menu_treatment_name_color: preset.menu_treatment_name_color,
      menu_price_color: preset.menu_price_color,
      menu_treatment_size: preset.menu_treatment_size,
      menu_treatment_bold: preset.menu_treatment_bold,
      menu_category_bold: preset.menu_category_bold,
      welcome_card_show_logo: preset.welcome_card_show_logo,
      welcome_card_show_name: preset.welcome_card_show_name,
      welcome_card_show_tagline: preset.welcome_card_show_tagline,
      welcome_card_show_rating: preset.welcome_card_show_rating,
      welcome_card_show_actions: preset.welcome_card_show_actions,
      welcome_card_show_contact: preset.welcome_card_show_contact,
      welcome_card_show_sms: preset.welcome_card_show_sms,
      welcome_card_show_whatsapp: preset.welcome_card_show_whatsapp,
      welcome_card_show_instagram: preset.welcome_card_show_instagram,
      welcome_card_show_facebook: preset.welcome_card_show_facebook,
      welcome_card_size: preset.welcome_card_size,
      welcome_card_mobile_size: preset.welcome_card_mobile_size,
      welcome_card_position: preset.welcome_card_position,
      welcome_card_background_type: preset.welcome_card_background_type,
      welcome_card_bg_color: preset.welcome_card_bg_color,
      welcome_card_gradient_from: preset.welcome_card_gradient_from,
      welcome_card_gradient_to: preset.welcome_card_gradient_to,
      welcome_card_border_color: preset.welcome_card_border_color,
      welcome_card_border_radius: preset.welcome_card_border_radius,
      welcome_card_border_width: preset.welcome_card_border_width,
      welcome_card_padding: preset.welcome_card_padding,
      welcome_card_shadow: preset.welcome_card_shadow,
      welcome_card_opacity: preset.welcome_card_opacity,
      welcome_card_blur: preset.welcome_card_blur,
    }));
    toast.success(`${preset.name} applied — every value is still editable`);
  }

  function applyWelcomeCardPreset(p: Partial<ClinicThemeInput>) {
    setState((s) => ({ ...s, ...p }));
    toast.success("Card style preset applied");
  }

  function applyColorPalette(palette: ColorPalette) {
    setState((s) => ({ ...s, ...palette.colors }));
    toast.success(`${palette.name} palette applied`);
  }

  const [customColors, setCustomColors] = useState<[string, string, string, string]>([
    "#faf7f2", "#ece6db", "#8b7355", "#3a3530",
  ]);
  function updateCustomColor(idx: 0 | 1 | 2 | 3, hex: string) {
    setCustomColors((c) => {
      const next = [...c] as [string, string, string, string];
      next[idx] = hex;
      return next;
    });
  }
  function applyCustomPalette() {
    const valid = customColors.every((c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c));
    if (!valid) { toast.error("Enter valid hex codes (e.g. #faf7f2)"); return; }
    setState((s) => ({ ...s, ...buildCustomPalette(customColors) }));
    toast.success("Custom palette applied");
  }

  const activePaletteKey = COLOR_PALETTES.find(
    (p) => p.colors.background_color === state.background_color && p.colors.primary_color === state.primary_color,
  )?.key;

  const WELCOME_CARD_PRESETS: { label: string; style: Partial<ClinicThemeInput> }[] = [
    {
      label: "Minimal pill",
      style: {
        welcome_card_size: "compact",
        welcome_card_mobile_size: "compact",
        welcome_card_background_type: "solid",
        welcome_card_bg_color: "#ffffff",
        welcome_card_border_color: "#e5e7eb",
        welcome_card_border_radius: "9999px",
        welcome_card_border_width: "1px",
        welcome_card_padding: "0.75rem 1.25rem",
        welcome_card_shadow: "0 4px 20px rgba(0,0,0,0.06)",
        welcome_card_opacity: 1,
        welcome_card_blur: 0,
      },
    },
    {
      label: "Luxe glass",
      style: {
        welcome_card_size: "medium",
        welcome_card_mobile_size: "medium",
        welcome_card_background_type: "glass",
        welcome_card_bg_color: "rgba(255,255,255,0.72)",
        welcome_card_border_color: "rgba(255,255,255,0.5)",
        welcome_card_border_radius: "1.25rem",
        welcome_card_border_width: "1px",
        welcome_card_padding: "1.5rem",
        welcome_card_shadow: "0 20px 60px rgba(0,0,0,0.12)",
        welcome_card_opacity: 1,
        welcome_card_blur: 12,
      },
    },
    {
      label: "Wide banner",
      style: {
        welcome_card_size: "wide",
        welcome_card_mobile_size: "wide",
        welcome_card_background_type: "gradient",
        welcome_card_gradient_from: "#ffffff",
        welcome_card_gradient_to: "#f8f8f8",
        welcome_card_border_color: "#e5e7eb",
        welcome_card_border_radius: "1rem",
        welcome_card_border_width: "1px",
        welcome_card_padding: "1rem 1.5rem",
        welcome_card_shadow: "0 10px 40px rgba(0,0,0,0.08)",
        welcome_card_opacity: 1,
        welcome_card_blur: 0,
      },
    },
    {
      label: "Floating card",
      style: {
        welcome_card_size: "medium",
        welcome_card_mobile_size: "medium",
        welcome_card_background_type: "solid",
        welcome_card_bg_color: "#ffffff",
        welcome_card_border_color: "transparent",
        welcome_card_border_radius: "1.5rem",
        welcome_card_border_width: "0px",
        welcome_card_padding: "1.75rem",
        welcome_card_shadow: "0 24px 80px rgba(0,0,0,0.14)",
        welcome_card_opacity: 1,
        welcome_card_blur: 0,
      },
    },
  ];

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

  const carouselUrls = parseUrls(state.hero_carousel_urls);
  const addCarouselUrl = (url: string | null) => {
    if (!url) return;
    setState((s) => ({ ...s, hero_carousel_urls: [...parseUrls(s.hero_carousel_urls), url] }));
  };
  const removeCarouselUrl = (i: number) => {
    setState((s) => ({ ...s, hero_carousel_urls: parseUrls(s.hero_carousel_urls).filter((_, idx) => idx !== i) }));
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Branding</h1>
          <p className="text-sm text-muted-foreground">
            Pick a style preset to start, then make every colour, font and layout your own.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="sm:w-auto">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
      <SaveReminder />

      {/* Style presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4" /> Style preset
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Applies to your booking link and your dashboard. Loads colours, fonts and layout as a starting point — everything is fully editable below.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {Object.values(PRESETS).map((p) => {
            const active = state.preset_key === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition hover:shadow-md ${active ? "ring-2 ring-primary" : ""}`}
                style={{ background: p.background_color, color: p.text_color, fontFamily: p.body_font }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest opacity-70">Preset</p>
                    <p className="truncate text-xl font-semibold" style={{ fontFamily: p.heading_font }}>{p.name}</p>
                    <p className="mt-1 text-xs opacity-80">{p.tagline}</p>
                  </div>
                  {active && <span className="rounded-full bg-primary p-1 text-primary-foreground"><Check className="h-3 w-3" /></span>}
                </div>
                <div className="mt-3 flex gap-1.5">
                  {p.swatches.map((c, i) => (
                    <span key={i} className="h-5 w-5 rounded-full border border-black/10" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-60">
                  <span>{p.heading_font}</span><span>·</span><span>{LAYOUTS.find((l) => l.key === p.layout_key)?.name}</span>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Colour palette — six curated, harmonious sets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Colour palette
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Six hand-picked palettes. One click sets every colour on your booking page so it always looks clean — no clashing or contrast issues.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_PALETTES.map((p) => {
            const active = activePaletteKey === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyColorPalette(p)}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition hover:shadow-md ${active ? "ring-2 ring-primary" : ""}`}
                style={{ background: p.swatches[0], color: p.swatches[3] }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{p.name}</p>
                    <p className="mt-0.5 text-xs opacity-80">{p.tagline}</p>
                  </div>
                  {active && (
                    <span className="rounded-full bg-primary p-1 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-1.5">
                  {p.swatches.map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-full border border-black/10 shadow-sm" style={{ background: c }} />
                  ))}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Custom palette — build your own from 4 hex codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4" /> Build your own palette
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pick 4 colours — from lightest to darkest — and we'll apply them everywhere. Paste a hex code or use the colour picker.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {CUSTOM_PALETTE_SLOTS.map((slot) => (
              <div key={slot.key} className="rounded-xl border p-3">
                <Label className="text-xs font-semibold">{slot.label}</Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{slot.hint}</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={customColors[slot.key]}
                    onChange={(e) => updateCustomColor(slot.key, e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-md border bg-transparent"
                    aria-label={`${slot.label} colour picker`}
                  />
                  <Input
                    value={customColors[slot.key]}
                    onChange={(e) => updateCustomColor(slot.key, e.target.value)}
                    placeholder={slot.suggested}
                    className="font-mono uppercase"
                    maxLength={7}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {customColors.map((c, i) => (
                <span key={i} className="h-8 w-8 rounded-full border border-black/10 shadow-sm" style={{ background: c }} />
              ))}
            </div>
            <Button type="button" onClick={applyCustomPalette} className="ml-auto">
              Apply custom palette
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tip: keep slot 1 very light and slot 4 very dark for the best contrast and readability.
          </p>
        </CardContent>
      </Card>



      {/* Booking-link layout */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Booking-link layout</CardTitle>
          <p className="text-xs text-muted-foreground">Choose how the top of your booking page is arranged.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {LAYOUTS.map((l) => {
            const active = (state.layout_key ?? "classic") === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setState((s) => ({
                  ...s,
                  layout_key: l.key as BookingLayoutKey,
                  hero_carousel_enabled: l.key === "carousel",
                }))}
                className={`rounded-xl border p-3 text-left transition hover:shadow-md ${active ? "ring-2 ring-primary" : ""}`}
              >
                <LayoutThumb kind={l.key} />
                <p className="mt-2 text-sm font-semibold">{l.name}</p>
                <p className="text-xs text-muted-foreground">{l.description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Banner images — content depends on chosen layout */}
      {(state.layout_key ?? "classic") === "carousel" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Carousel banner images</CardTitle>
            <p className="text-xs text-muted-foreground">Upload 2 or more images for the auto-rotating banner. Each one can be cropped and repositioned after upload, and resizes for desktop and mobile.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {carouselUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {carouselUrls.map((u, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-md border">
                    <img src={u} alt="" className="h-28 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeCarouselUrl(i)}
                      aria-label="Delete image"
                      className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white shadow-md transition hover:bg-black"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <ImageUploader
              label="Add image to carousel"
              value={null}
              onChange={(v) => addCarouselUrl(v)}
              profileId={profileId}
              folder="carousel"
              previewClass="hidden"
            />
          </CardContent>
        </Card>
      ) : null}


      {/* Welcome card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome card</CardTitle>
          <p className="text-xs text-muted-foreground">Customise the floating clinic card on your booking page.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: "welcome_card_show_logo", label: "Show logo" },
              { key: "welcome_card_show_name", label: "Show clinic name" },
              { key: "welcome_card_show_tagline", label: "Show tagline" },
              { key: "welcome_card_show_rating", label: "Show star rating" },
              { key: "welcome_card_show_actions", label: "Show action buttons" },
              { key: "welcome_card_show_contact", label: "Show contact chips" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(state[item.key as keyof ClinicThemeInput] as boolean)}
                  onChange={(e) => set(item.key as keyof ClinicThemeInput, e.target.checked as ClinicThemeInput[keyof ClinicThemeInput])}
                />
                {item.label}
              </label>
            ))}
          </div>

          {state.welcome_card_show_contact && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { key: "welcome_card_show_sms", label: "Text / SMS" },
                { key: "welcome_card_show_whatsapp", label: "WhatsApp" },
                { key: "welcome_card_show_instagram", label: "Instagram" },
                { key: "welcome_card_show_facebook", label: "Facebook" },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!(state[item.key as keyof ClinicThemeInput] as boolean)}
                    onChange={(e) => set(item.key as keyof ClinicThemeInput, e.target.checked as ClinicThemeInput[keyof ClinicThemeInput])}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Quick card presets</Label>
            <div className="flex flex-wrap gap-2">
              {WELCOME_CARD_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyWelcomeCardPreset(p.style)}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Desktop size</Label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={state.welcome_card_size ?? "medium"}
                onChange={(e) => set("welcome_card_size", e.target.value)}
              >
                <option value="compact">Compact pill</option>
                <option value="medium">Medium card</option>
                <option value="wide">Wide banner (mobile friendly)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Mobile size</Label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={state.welcome_card_mobile_size ?? "medium"}
                onChange={(e) => set("welcome_card_mobile_size", e.target.value)}
              >
                <option value="compact">Compact pill</option>
                <option value="medium">Medium card</option>
                <option value="wide">Wide banner</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Position (desktop)</Label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={state.welcome_card_position ?? "overlap"}
                onChange={(e) => set("welcome_card_position", e.target.value)}
              >
                <option value="overlap">Overlap hero</option>
                <option value="below">Below hero</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Background style</Label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={state.welcome_card_background_type ?? "solid"}
                onChange={(e) => set("welcome_card_background_type", e.target.value)}
              >
                <option value="solid">Solid colour</option>
                <option value="glass">Frosted glass</option>
                <option value="gradient">Gradient</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(state.welcome_card_background_type === "gradient" ? (
              <>
                <ColorField label="Gradient from" value={state.welcome_card_gradient_from ?? "#ffffff"} onChange={(v) => set("welcome_card_gradient_from", v)} />
                <ColorField label="Gradient to" value={state.welcome_card_gradient_to ?? "#f3f4f6"} onChange={(v) => set("welcome_card_gradient_to", v)} />
              </>
            ) : (
              <ColorField label="Card background" value={state.welcome_card_bg_color ?? "#ffffff"} onChange={(v) => set("welcome_card_bg_color", v)} />
            ))}
            <ColorField label="Border colour" value={state.welcome_card_border_color ?? "#e5e7eb"} onChange={(v) => set("welcome_card_border_color", v)} />
            <div className="space-y-1.5">
              <Label>Border radius</Label>
              <Input value={state.welcome_card_border_radius ?? "1rem"} onChange={(e) => set("welcome_card_border_radius", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Border width</Label>
              <Input value={state.welcome_card_border_width ?? "1px"} onChange={(e) => set("welcome_card_border_width", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Padding</Label>
              <Input value={state.welcome_card_padding ?? "1.25rem"} onChange={(e) => set("welcome_card_padding", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Shadow</Label>
              <Input value={state.welcome_card_shadow ?? "0 10px 40px rgba(0,0,0,0.08)"} onChange={(e) => set("welcome_card_shadow", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Opacity ({Math.round((state.welcome_card_opacity ?? 1) * 100)}%)</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.welcome_card_opacity ?? 1}
                onChange={(e) => set("welcome_card_opacity", parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Backdrop blur ({state.welcome_card_blur ?? 0}px)</Label>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={state.welcome_card_blur ?? 0}
                onChange={(e) => set("welcome_card_blur", parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>


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
        <CardHeader><CardTitle className="text-base">Header & footer</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Header background" value={state.header_bg_color ?? ""} onChange={(v) => set("header_bg_color", v)} />
          <ColorField label="Header text" value={state.header_text_color ?? ""} onChange={(v) => set("header_text_color", v)} />
          <ColorField label="Footer background" value={state.footer_bg_color ?? ""} onChange={(v) => set("footer_bg_color", v)} />
          <ColorField label="Footer text" value={state.footer_text_color ?? ""} onChange={(v) => set("footer_text_color", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Typography</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Heading font</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.heading_font ?? "Inter"} onChange={(e) => set("heading_font", e.target.value)}>
              {FONTS.map((f) => (<option key={f} value={f} style={{ fontFamily: f }}>{f}</option>))}
            </select>
            <p className="text-xs italic opacity-70" style={{ fontFamily: state.heading_font ?? "Inter" }}>The quick brown fox.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Body font</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.body_font ?? "Inter"} onChange={(e) => set("body_font", e.target.value)}>
              {FONTS.map((f) => (<option key={f} value={f} style={{ fontFamily: f }}>{f}</option>))}
            </select>
            <p className="text-xs opacity-70" style={{ fontFamily: state.body_font ?? "Inter" }}>The quick brown fox.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo, tab icon & banner</CardTitle>
          <p className="text-xs text-muted-foreground">Banner images now keep the full upload visible on mobile. Crop is optional if you want to trim the image.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ImageUploader label="Logo" value={state.logo_url} onChange={(v) => set("logo_url", v)} profileId={profileId} folder="logo" previewClass="mt-2 h-16 object-contain rounded bg-muted/30 p-2" />
          </div>
          <ImageUploader label="Tab icon (browser tab)" value={state.favicon_url} onChange={(v) => set("favicon_url", v)} profileId={profileId} folder="favicon" previewClass="mt-2 h-8 w-8 object-contain rounded" cropAspect={1} />
          {(state.layout_key ?? "classic") === "classic" && (
            <ImageUploader label="Banner image" value={state.hero_image_url} onChange={(v) => set("hero_image_url", v)} profileId={profileId} folder="hero" previewClass="mt-2 h-40 w-full rounded-md bg-muted/30 object-contain" />
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Banner title</Label>
            <Input value={state.hero_heading ?? ""} onChange={(e) => set("hero_heading", e.target.value || null)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Banner subtitle</Label>
            <Textarea rows={2} value={state.hero_subheading ?? ""} onChange={(e) => set("hero_subheading", e.target.value || null)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Booking menu styling</CardTitle>
          <p className="text-xs text-muted-foreground">Controls how categories and treatments look on your customer-facing booking page.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Category header background" value={state.menu_category_bg ?? "#111827"} onChange={(v) => set("menu_category_bg", v)} />
          <ColorField label="Category header text" value={state.menu_category_text ?? "#ffffff"} onChange={(v) => set("menu_category_text", v)} />
          <ColorField label="Treatment card background" value={state.menu_card_bg ?? "#ffffff"} onChange={(v) => set("menu_card_bg", v)} />
          <ColorField label="Treatment card border" value={state.menu_card_border_color ?? "#e5e7eb"} onChange={(v) => set("menu_card_border_color", v)} />
          <ColorField label="Treatment name color" value={state.menu_treatment_name_color ?? state.primary_color ?? "#0f172a"} onChange={(v) => set("menu_treatment_name_color", v)} />
          <ColorField label="Price color" value={state.menu_price_color ?? state.primary_color ?? "#0f172a"} onChange={(v) => set("menu_price_color", v)} />
          <div className="space-y-1.5">
            <Label>Treatment card size</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.menu_treatment_size ?? "sm"} onChange={(e) => set("menu_treatment_size", e.target.value)}>
              <option value="sm">Small (compact)</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={state.menu_category_bold ?? true} onChange={(e) => set("menu_category_bold", e.target.checked)} />
              Bold category titles
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={state.menu_treatment_bold ?? true} onChange={(e) => set("menu_treatment_bold", e.target.checked)} />
              Bold treatment names
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Header bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Header bar</CardTitle>
          <p className="text-xs text-muted-foreground">Top navigation on every booking page.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.header_sticky ?? true} onChange={(e) => set("header_sticky", e.target.checked)} />
            Sticky header (stays on screen)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.header_show_name ?? true} onChange={(e) => set("header_show_name", e.target.checked)} />
            Show clinic name in header
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.header_show_tagline ?? true} onChange={(e) => set("header_show_tagline", e.target.checked)} />
            Show practitioner name under clinic
          </label>
          <div className="space-y-1.5">
            <Label>Logo size</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.header_logo_size ?? "medium"} onChange={(e) => set("header_logo_size", e.target.value)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>"Book" tab label</Label>
            <Input value={state.header_button_label ?? "Book"} onChange={(e) => set("header_button_label", e.target.value)} placeholder="Book" />
          </div>
        </CardContent>
      </Card>

      {/* Hero settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hero section</CardTitle>
          <p className="text-xs text-muted-foreground">Top image on your booking page.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Hero height</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.hero_height ?? "medium"} onChange={(e) => set("hero_height", e.target.value)}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="tall">Tall</option>
              <option value="extra_tall">Extra tall</option>
              <option value="huge">Huge</option>
              <option value="natural">Fit to image (auto height)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Image fit</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.hero_fit ?? "contain"} onChange={(e) => set("hero_fit", e.target.value)}>
              <option value="contain">Fit whole image (letterbox)</option>
              <option value="cover">Fill & crop</option>
            </select>
            <p className="text-[11px] text-muted-foreground">"Fit to image" ignores this and shows the picture at its natural size.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Text alignment</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.hero_text_alignment ?? "center"} onChange={(e) => set("hero_text_alignment", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.hero_show_text ?? true} onChange={(e) => set("hero_show_text", e.target.checked)} />
            Show heading & subheading over image
          </label>
          <ColorField label="Overlay colour" value={state.hero_overlay_color ?? "#000000"} onChange={(v) => set("hero_overlay_color", v)} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Overlay darkness ({Math.round((state.hero_overlay_opacity ?? 0.25) * 100)}%)</Label>
            <input type="range" min={0} max={0.8} step={0.05} value={state.hero_overlay_opacity ?? 0.25} onChange={(e) => set("hero_overlay_opacity", parseFloat(e.target.value))} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buttons</CardTitle>
          <p className="text-xs text-muted-foreground">Style of the Book buttons across the booking page.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ColorField label="Button colour" value={state.button_color ?? state.primary_color ?? "#0f172a"} onChange={(v) => set("button_color", v)} />
          <ColorField label="Button text colour" value={state.button_text_color ?? "#ffffff"} onChange={(v) => set("button_text_color", v)} />
          <div className="space-y-1.5">
            <Label>Corner radius</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.button_radius ?? "rounded-xl"} onChange={(e) => set("button_radius", e.target.value)}>
              <option value="rounded-md">Soft</option>
              <option value="rounded-xl">Rounded</option>
              <option value="pill">Pill</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!state.button_uppercase} onChange={(e) => set("button_uppercase", e.target.checked)} />
            Uppercase button text
          </label>
        </CardContent>
      </Card>

      {/* Spacing & density */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spacing & density</CardTitle>
          <p className="text-xs text-muted-foreground">How tight or airy your booking page feels.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Page density</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.page_density ?? "cozy"} onChange={(e) => set("page_density", e.target.value)}>
              <option value="compact">Compact</option>
              <option value="cozy">Cozy</option>
              <option value="spacious">Spacious</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Contact tiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">"Get in touch" tiles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Layout</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.contact_tile_layout ?? "grid"} onChange={(e) => set("contact_tile_layout", e.target.value)}>
              <option value="grid">Grid</option>
              <option value="horizontal-list">Horizontal list</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Icon size</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.contact_tile_icon_size ?? "md"} onChange={(e) => set("contact_tile_icon_size", e.target.value)}>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
          <ColorField label="Tile background" value={state.contact_tile_bg_color ?? "#ffffff"} onChange={(v) => set("contact_tile_bg_color", v)} />
          <ColorField label="Tile border" value={state.contact_tile_border_color ?? "#e5e7eb"} onChange={(v) => set("contact_tile_border_color", v)} />
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-luxe">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}


function LayoutThumb({ kind }: { kind: BookingLayoutKey }) {
  const base = "h-20 w-full rounded-md border bg-muted/40";
  if (kind === "classic") {
    return (
      <div className={`${base} flex flex-col gap-1 p-1.5`}>
        <div className="h-8 rounded bg-muted-foreground/40" />
        <div className="-mt-3 h-4 rounded bg-background shadow" />
        <div className="mt-1 grid grid-cols-2 gap-1">
          <div className="h-2 rounded bg-muted-foreground/30" /><div className="h-2 rounded bg-muted-foreground/30" />
        </div>
      </div>
    );
  }
  if (kind === "carousel") {
    return (
      <div className={`${base} flex flex-col gap-1 p-1.5`}>
        <div className="flex gap-1">
          <div className="h-10 flex-1 rounded bg-muted-foreground/40" />
          <div className="h-10 w-3 rounded bg-muted-foreground/20" />
        </div>
        <div className="mx-auto mt-1 flex gap-0.5">
          {[0,1,2].map(i => <span key={i} className={`h-1 w-3 rounded-full ${i===0?"bg-foreground":"bg-muted-foreground/30"}`} />)}
        </div>
        <div className="grid grid-cols-2 gap-1"><div className="h-2 rounded bg-muted-foreground/30" /><div className="h-2 rounded bg-muted-foreground/30" /></div>
      </div>
    );
  }
  if (kind === "split") {
    return (
      <div className={`${base} grid grid-cols-2 gap-1 p-1.5`}>
        <div className="rounded bg-muted-foreground/40" />
        <div className="space-y-1">
          <div className="h-2 rounded bg-muted-foreground/40" />
          <div className="h-2 w-3/4 rounded bg-muted-foreground/30" />
          <div className="h-4 rounded bg-muted-foreground/30" />
          <div className="h-4 rounded bg-muted-foreground/30" />
        </div>
      </div>
    );
  }
  return (
    <div className={`${base} flex flex-col gap-1 p-1.5`}>
      <div className="mx-auto h-2 w-1/2 rounded bg-foreground" />
      <div className="mx-auto h-1.5 w-2/3 rounded bg-muted-foreground/40" />
      <div className="mt-1 flex gap-1">
        <div className="h-6 flex-1 rounded bg-muted-foreground/30" />
        <div className="h-6 flex-1 rounded bg-muted-foreground/30" />
        <div className="h-6 flex-1 rounded bg-muted-foreground/30" />
      </div>
    </div>
  );
}
