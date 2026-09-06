// Practitioner workspace look & feel. These settings only affect the
// signed-in dashboard — the patient-facing booking page keeps using the
// clinic's public branding from clinic_theme.

import { COLOR_PALETTES } from "@/lib/color-palettes";

export type DashboardPalette = {
  key: string;
  name: string;
  tagline: string;
  swatches: string[];
  colors: Record<string, string>;
};

// The general MODO workspace palette — the same cool clinical slate +
// medical teal used by the Prescriber Hub. This is the default for every
// practitioner dashboard unless they pick another palette in Appearance.
export const DEFAULT_DASHBOARD_PALETTE: DashboardPalette = {
  key: "modo-clinical",
  name: "MODO Clinical",
  tagline: "The standard MODO look — clean slate with medical teal.",
  swatches: ["#f2f6f9", "#182837", "#0f5c6f", "#25a6a6"],
  colors: {
    background_color: "#f2f6f9",
    text_color: "#14202d",
    primary_color: "#0f5c6f",
    accent_color: "#dfeaf0",
    menu_card_bg: "#ffffff",
    menu_card_border_color: "#d4dce2",
    header_bg_color: "#182837",
    header_text_color: "#f5f9fb",
    button_color: "#0f5c6f",
    button_text_color: "#f5f9fb",
  },
};

const EXTRA: DashboardPalette[] = [
  DEFAULT_DASHBOARD_PALETTE,
  {
    key: "midnight",
    name: "Midnight",
    tagline: "Dark charcoal with soft light text — easy on the eyes.",
    swatches: ["#14161a", "#1c1f26", "#7fb3c9", "#eef1f5"],
    colors: {
      background_color: "#14161a",
      text_color: "#eef1f5",
      primary_color: "#7fb3c9",
      accent_color: "#2a303a",
      menu_card_bg: "#1c1f26",
      menu_card_border_color: "#2a303a",
      header_bg_color: "#1c1f26",
      header_text_color: "#eef1f5",
      button_color: "#7fb3c9",
      button_text_color: "#0f1114",
    },
  },
  {
    key: "graphite",
    name: "Graphite",
    tagline: "Neutral grey and white — plain and distraction-free.",
    swatches: ["#ffffff", "#f4f4f5", "#3f3f46", "#18181b"],
    colors: {
      background_color: "#ffffff",
      text_color: "#18181b",
      primary_color: "#3f3f46",
      accent_color: "#e4e4e7",
      menu_card_bg: "#ffffff",
      menu_card_border_color: "#e4e4e7",
      header_bg_color: "#ffffff",
      header_text_color: "#18181b",
      button_color: "#18181b",
      button_text_color: "#ffffff",
    },
  },
];

export const DASHBOARD_PALETTES: DashboardPalette[] = [
  ...COLOR_PALETTES.map((p) => ({
    key: p.key as string,
    name: p.name,
    tagline: p.tagline,
    swatches: p.swatches,
    colors: p.colors as Record<string, string>,
  })),
  ...EXTRA,
];

export const DASHBOARD_FONTS = [
  "Plus Jakarta Sans",
  "Inter",
  "Manrope",
  "DM Sans",
  "Figtree",
  "Outfit",
  "Space Grotesk",
  "Montserrat",
  "Poppins",
] as const;

export function getDashboardPalette(key: string | null | undefined) {
  return DASHBOARD_PALETTES.find((p) => p.key === key) ?? null;
}

/** The theme-shaped object the dashboard should render with. */
export function resolveDashboardTheme(
  theme: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!theme) {
    // No saved theme — use the general MODO Clinical palette.
    return { ...DEFAULT_DASHBOARD_PALETTE.colors };
  }
  // Brand colours only apply when the practitioner has explicitly opted in.
  if (theme["dashboard_follow_brand"] === true) return theme;

  const palette = getDashboardPalette(theme["dashboard_palette"] as string) ?? DEFAULT_DASHBOARD_PALETTE;
  const heading = (theme["dashboard_heading_font"] as string) || null;
  const body = (theme["dashboard_body_font"] as string) || null;
  return {
    ...palette.colors,
    heading_font: heading,
    body_font: body,
  };
}
