// Maps a practitioner's clinic_theme row onto the shadcn semantic CSS
// variables, so every component (cards, buttons, inputs, dialogs) on both the
// dashboard and the public patient portal picks up their branding instead of
// falling back to the default MODO palette.

export function buildThemeVars(theme: Record<string, unknown> | null | undefined): Record<string, string> {
  const v: Record<string, string> = {};
  if (!theme) return v;

  const get = (k: string) => {
    const val = theme[k];
    return typeof val === "string" && val.trim() ? val.trim() : null;
  };
  const set = (k: string, val: string | null) => {
    if (val) v[k] = val;
  };
  const mix = (a: string | null, b: string | null, pct: number) =>
    a && b ? `color-mix(in oklab, ${a} ${pct}%, ${b})` : null;

  const bg = get("background_color");
  const text = get("text_color");
  const primary = get("primary_color");
  const accent = get("accent_color");
  const cardBg = get("menu_card_bg") ?? bg;
  const cardBorder = get("menu_card_border_color") ?? accent;
  const headerBg = get("header_bg_color") ?? "#ffffff";
  const headerText = get("header_text_color") ?? text;
  const buttonBg = get("button_color") ?? primary;
  const buttonText = get("button_text_color") ?? headerBg;
  const headingFont = get("heading_font");
  const bodyFont = get("body_font");

  set("--background", bg);
  set("--foreground", text);
  set("--card", cardBg);
  set("--card-foreground", text);
  set("--popover", cardBg);
  set("--popover-foreground", text);
  set("--primary", buttonBg);
  set("--primary-foreground", buttonText);
  set("--secondary", mix(text, cardBg ?? bg, 7) ?? cardBg);
  set("--secondary-foreground", text);
  set("--muted", mix(text, bg ?? cardBg, 6) ?? cardBg);
  set("--muted-foreground", mix(text, bg ?? cardBg, 62) ?? text);
  set("--accent", mix(accent, cardBg ?? bg, 22) ?? cardBg);
  set("--accent-foreground", text);
  set("--border", cardBorder);
  set("--input", cardBorder);
  set("--ring", accent);

  set("--sidebar", headerBg);
  set("--sidebar-foreground", headerText);
  set("--sidebar-primary", buttonBg);
  set("--sidebar-primary-foreground", buttonText);
  set("--sidebar-accent", mix(text, headerBg, 7) ?? cardBg);
  set("--sidebar-accent-foreground", headerText);
  set("--sidebar-border", cardBorder);
  set("--sidebar-ring", accent);

  if (headingFont) v["--font-serif"] = `"${headingFont}", Georgia, serif`;
  if (bodyFont) v["--font-sans"] = `"${bodyFont}", system-ui, sans-serif`;

  return v;
}
