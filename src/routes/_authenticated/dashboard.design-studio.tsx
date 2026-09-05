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
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
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
  MousePointerClick,
  RefreshCw,
  Smartphone,
  Rocket,
  SlidersHorizontal,
  Undo2,
  X,
} from "lucide-react";
import { designStudioEnabled } from "@/lib/feature-flags";
import { buildThemeVars } from "@/lib/theme-vars";

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

/** Text on the page that can be typed straight into from the preview. */
type TextKey = "clinic_name" | "tagline";
type ImageKey = "logo_url" | "hero_image_url";

/** What a clicked bit of the preview maps onto. */
type EditTarget =
  | { kind: "color"; key: keyof ClinicThemeInput; label: string }
  | { kind: "text"; textKey: TextKey; label: string; value: string }
  | { kind: "image"; imageKey: ImageKey; label: string };

const TEXT_LABELS: Record<TextKey, string> = {
  clinic_name: "Clinic name",
  tagline: "Tagline",
};

const IMAGE_LABELS: Record<ImageKey, string> = {
  logo_url: "Logo",
  hero_image_url: "Banner photo",
};


const CLICK_MAP: { selector: string; key: keyof ClinicThemeInput; label: string }[] = [
  { selector: "header, [data-region='header']", key: "header_bg_color", label: "Header background" },
  { selector: "footer, [data-region='footer']", key: "footer_bg_color", label: "Footer background" },
  { selector: "button, a[role='button'], .btn", key: "primary_color", label: "Brand colour (buttons)" },
  { selector: "h1, h2, h3, h4", key: "text_color", label: "Headings & text" },
  { selector: "[data-region='card'], article, li, .rounded-xl, .rounded-2xl", key: "menu_card_bg", label: "Card background" },
  { selector: "body, main, section, div", key: "background_color", label: "Page background" },
];

function DesignStudioPage() {
  const fetchTheme = useServerFn(getMyTheme);
  const fetchProfile = useServerFn(getMyProfile);
  const saveDraft = useServerFn(saveThemeDraft);
  const publish = useServerFn(publishThemeDraft);
  const discard = useServerFn(discardThemeDraft);
  const saveProfile = useServerFn(updateProfile);

  const [state, setState] = useState<ClinicThemeInput>({ ...BLANK });
  const [profileId, setProfileId] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [editMode, setEditMode] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [savingText, setSavingText] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
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

  // --- Click-to-edit preview -------------------------------------------------
  // The preview is same-origin, so we can highlight what the practitioner hovers
  // and open the matching control — a colour picker, or a text box for the bits
  // of writing that are editable.
  const wirePreview = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll("[data-modo-edit-style]").forEach((n) => n.remove());
    doc.body?.classList.remove("modo-edit-on");
    if (!editMode) return;

    const style = doc.createElement("style");
    style.setAttribute("data-modo-edit-style", "");
    style.textContent = `
      .modo-edit-on * { cursor: crosshair !important; }
      .modo-edit-hover { outline: 2px solid #2563eb !important; outline-offset: -2px !important; }
      .modo-edit-text { outline: 2px dashed #16a34a !important; outline-offset: -2px !important; }
    `;
    doc.head?.appendChild(style);
    doc.body?.classList.add("modo-edit-on");

    type Match =
      | { hit: Element; text: TextKey }
      | { hit: Element; image: ImageKey }
      | { hit: Element; key: keyof ClinicThemeInput; label: string };
    const match = (el: Element): Match | null => {
      const text = el.closest("[data-modo-text]");
      if (text) {
        const tk = text.getAttribute("data-modo-text") as TextKey;
        if (tk in TEXT_LABELS) return { hit: text, text: tk };
      }
      const img = el.closest("[data-modo-image]");
      if (img) {
        const ik = img.getAttribute("data-modo-image") as ImageKey;
        if (ik in IMAGE_LABELS) return { hit: img, image: ik };
      }
      for (const m of CLICK_MAP) {
        const hit = el.closest(m.selector);
        if (hit) return { hit, key: m.key, label: m.label };
      }
      return null;
    };


    let last: Element | null = null;
    const onOver = (e: Event) => {
      const found = match(e.target as Element);
      if (last) last.classList.remove("modo-edit-hover", "modo-edit-text");
      last = found?.hit ?? null;
      if (found && ("text" in found || "image" in found)) last?.classList.add("modo-edit-text");
      else last?.classList.add("modo-edit-hover");
    };
    const onClick = (e: MouseEvent) => {
      const found = match(e.target as Element);
      if (!found) return;
      e.preventDefault();
      e.stopPropagation();
      if ("text" in found) {
        setTarget({
          kind: "text",
          textKey: found.text,
          label: TEXT_LABELS[found.text],
          value: (found.hit.textContent ?? "").trim(),
        });
      } else if ("image" in found) {
        setTarget({ kind: "image", imageKey: found.image, label: IMAGE_LABELS[found.image] });
      } else {
        setTarget({ kind: "color", key: found.key, label: found.label });
      }
    };

    doc.addEventListener("mouseover", onOver, true);
    doc.addEventListener("click", onClick, true);
    return () => {
      doc.removeEventListener("mouseover", onOver, true);
      doc.removeEventListener("click", onClick, true);
    };
  }, [editMode]);

  useEffect(() => {
    const cleanup = wirePreview();
    return cleanup;
  }, [wirePreview, previewKey]);

  // Apply colour/font changes to the preview instantly, before the draft saves.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const vars = buildThemeVars(state as Record<string, unknown>);
    for (const [k, v] of Object.entries(vars)) doc.documentElement.style.setProperty(k, String(v));
    const body = doc.body;
    if (body && state.background_color) body.style.backgroundColor = state.background_color;
  }, [state]);

  // Live-type into the preview while the practitioner edits a piece of writing.
  function previewText(key: TextKey, value: string) {
    const doc = iframeRef.current?.contentDocument;
    const el = doc?.querySelector(`[data-modo-text="${key}"]`);
    if (el) el.textContent = value;
  }

  // Swap the picture in the preview straight away.
  function previewImage(key: ImageKey, url: string | null) {
    const doc = iframeRef.current?.contentDocument;
    const host = doc?.querySelector(`[data-modo-image="${key}"]`);
    if (!host || !url) return;
    if (host instanceof HTMLImageElement) host.src = url;
    else {
      const inner = host.querySelector("img");
      if (inner) inner.setAttribute("src", url);
      else (host as HTMLElement).style.backgroundImage = `url(${url})`;
    }
  }



  async function saveTextTarget() {
    if (!target || target.kind !== "text" || !profileId) return;
    setSavingText(true);
    try {
      await saveProfile({
        data: { id: profileId, [target.textKey]: target.value } as { id: string },
      });
      toast.success(`${target.label} updated`);
      setTarget(null);
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that text");
    } finally {
      setSavingText(false);
    }
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

  const controls = (
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
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Design studio</h1>
          <p className="text-xs text-muted-foreground">
            {editMode
              ? "Tap anything on your page — colours open a picker, writing opens a text box."
              : "Click-to-edit is off — the preview behaves like the real page."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">
            {savingDraft ? "Saving draft…" : hasDraft ? "Draft — not live" : "Matches what's live"}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPanelOpen(true)}>
            <SlidersHorizontal className="mr-1 h-4 w-4" /> Design tools
          </Button>
          <Button
            variant={editMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setEditMode((v) => !v);
              setTarget(null);
            }}
          >
            <MousePointerClick className="mr-1 h-4 w-4" /> {editMode ? "Editing" : "Edit"}
          </Button>
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

      {previewSrc ? (
        <div
          className="mx-auto w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm"
          style={{ maxWidth: device === "mobile" ? 390 : "100%" }}
        >
          <iframe
            key={previewKey}
            ref={iframeRef}
            onLoad={() => wirePreview()}
            src={previewSrc}
            title="Booking page preview"
            className="h-[calc(100vh-9rem)] w-full"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Set your booking link first to see a preview.</p>
      )}

      {/* Inspector — floats over the full-page preview */}
      {target && (
        <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-border bg-background p-3 shadow-xl sm:inset-x-auto sm:right-6 sm:w-[26rem]">
          {target.kind === "color" ? (
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={target.label}
                value={(state[target.key] as string) || "#ffffff"}
                onChange={(e) => setColor(target.key, e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{target.label}</p>
                <p className="text-xs text-muted-foreground">
                  Changes show straight away and save as a draft.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>Done</Button>
            </div>
          ) : target.kind === "image" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{target.label}</p>
                <Button variant="ghost" size="icon" onClick={() => setTarget(null)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ImageUploader
                label=""
                value={state[target.imageKey] as string | null}
                onChange={(v) => {
                  set(target.imageKey, v);
                  previewImage(target.imageKey, v);
                }}
                profileId={profileId}
                folder={target.imageKey === "logo_url" ? "logo" : "hero"}
                previewClass={
                  target.imageKey === "logo_url"
                    ? "mt-2 h-16 object-contain rounded bg-muted/30 p-2"
                    : "mt-2 h-28 w-full rounded-md bg-muted/30 object-cover"
                }
              />
              <p className="text-xs text-muted-foreground">
                Pick a new picture — it saves as a draft until you publish.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{target.label}</p>
                <Button variant="ghost" size="icon" onClick={() => setTarget(null)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                autoFocus
                value={target.value}
                onChange={(e) => {
                  const value = e.target.value;
                  setTarget((t) => (t && t.kind === "text" ? { ...t, value } : t));
                  previewText(target.textKey, value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveTextTarget();
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">This writing goes live as soon as you save it.</p>
                <Button size="sm" onClick={() => void saveTextTarget()} disabled={savingText}>
                  {savingText ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Design tools drawer */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close design tools"
            className="flex-1 bg-black/30"
            onClick={() => setPanelOpen(false)}
          />
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold">Design tools</p>
              <Button variant="ghost" size="icon" onClick={() => setPanelOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {controls}
          </div>
        </div>
      )}
    </div>
  );
}
