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

const EXTRA: DashboardPalette[] = [
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
  if (!theme) return null;
  if (theme["dashboard_follow_brand"] !== false) return theme;

  const palette = getDashboardPalette(theme["dashboard_palette"] as string) ?? DASHBOARD_PALETTES[0];
  const heading = (theme["dashboard_heading_font"] as string) || null;
  const body = (theme["dashboard_body_font"] as string) || null;
  return {
    ...palette.colors,
    heading_font: heading,
    body_font: body,
  };
}
