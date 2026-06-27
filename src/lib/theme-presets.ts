// Style presets practitioners can apply to BOTH their booking link and their
// in-app dashboard. Picking a preset fills in colours/fonts/layout as a
// starting point — every value remains fully editable in Branding.

export type ThemePresetKey = "luxe-editorial" | "clean-modern" | "soft-botanical" | "minimal-mono";

export type BookingLayoutKey = "classic" | "carousel" | "split" | "magazine";

export type ThemePreset = {
  key: ThemePresetKey;
  name: string;
  tagline: string;
  heading_font: string;
  body_font: string;
  layout_key: BookingLayoutKey;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  header_bg_color: string;
  header_text_color: string;
  footer_bg_color: string;
  footer_text_color: string;
  menu_card_bg: string;
  menu_card_border_color: string;
  menu_category_bg: string;
  menu_category_text: string;
  menu_treatment_name_color: string;
  menu_price_color: string;
  menu_treatment_size: "sm" | "md" | "lg";
  menu_treatment_bold: boolean;
  menu_category_bold: boolean;
  swatches: string[]; // for visual preview
};

export const PRESETS: Record<ThemePresetKey, ThemePreset> = {
  "luxe-editorial": {
    key: "luxe-editorial",
    name: "Luxe Editorial",
    tagline: "Warm cream, espresso & italic serif — high-end editorial.",
    heading_font: "Cormorant Garamond",
    body_font: "Plus Jakarta Sans",
    layout_key: "classic",
    primary_color: "#3a2e26",
    accent_color: "#b8895a",
    background_color: "#f5ede1",
    text_color: "#3a2e26",
    header_bg_color: "#faf6ee",
    header_text_color: "#3a2e26",
    footer_bg_color: "#3a2e26",
    footer_text_color: "#f5ede1",
    menu_card_bg: "#faf6ee",
    menu_card_border_color: "#e9dcc8",
    menu_category_bg: "#3a2e26",
    menu_category_text: "#f5ede1",
    menu_treatment_name_color: "#3a2e26",
    menu_price_color: "#7a5a42",
    menu_treatment_size: "md",
    menu_treatment_bold: false,
    menu_category_bold: false,
    swatches: ["#3a2e26", "#b8895a", "#f5ede1", "#faf6ee"],
  },
  "clean-modern": {
    key: "clean-modern",
    name: "Clean & Modern",
    tagline: "Crisp white, geometric sans — like your booking link.",
    heading_font: "Plus Jakarta Sans",
    body_font: "Plus Jakarta Sans",
    layout_key: "classic",
    primary_color: "#0f172a",
    accent_color: "#3b82f6",
    background_color: "#ffffff",
    text_color: "#0f172a",
    header_bg_color: "#ffffff",
    header_text_color: "#0f172a",
    footer_bg_color: "#0f172a",
    footer_text_color: "#ffffff",
    menu_card_bg: "#ffffff",
    menu_card_border_color: "#e5e7eb",
    menu_category_bg: "#0f172a",
    menu_category_text: "#ffffff",
    menu_treatment_name_color: "#0f172a",
    menu_price_color: "#0f172a",
    menu_treatment_size: "sm",
    menu_treatment_bold: true,
    menu_category_bold: true,
    swatches: ["#0f172a", "#3b82f6", "#ffffff", "#f3f4f6"],
  },
  "soft-botanical": {
    key: "soft-botanical",
    name: "Soft Botanical",
    tagline: "Sage, blush & ivory — calm, spa-like.",
    heading_font: "Fraunces",
    body_font: "Outfit",
    layout_key: "split",
    primary_color: "#4a6741",
    accent_color: "#d4a5a5",
    background_color: "#f8f4ee",
    text_color: "#2d3b29",
    header_bg_color: "#f8f4ee",
    header_text_color: "#2d3b29",
    footer_bg_color: "#4a6741",
    footer_text_color: "#f8f4ee",
    menu_card_bg: "#ffffff",
    menu_card_border_color: "#dde5d4",
    menu_category_bg: "#4a6741",
    menu_category_text: "#f8f4ee",
    menu_treatment_name_color: "#2d3b29",
    menu_price_color: "#7a8b6f",
    menu_treatment_size: "md",
    menu_treatment_bold: false,
    menu_category_bold: true,
    swatches: ["#4a6741", "#d4a5a5", "#f8f4ee", "#dde5d4"],
  },
  "minimal-mono": {
    key: "minimal-mono",
    name: "Minimal Mono",
    tagline: "Pure black & white, Swiss grid — ultra-clean.",
    heading_font: "Inter",
    body_font: "Inter",
    layout_key: "magazine",
    primary_color: "#000000",
    accent_color: "#000000",
    background_color: "#ffffff",
    text_color: "#000000",
    header_bg_color: "#ffffff",
    header_text_color: "#000000",
    footer_bg_color: "#000000",
    footer_text_color: "#ffffff",
    menu_card_bg: "#ffffff",
    menu_card_border_color: "#000000",
    menu_category_bg: "#000000",
    menu_category_text: "#ffffff",
    menu_treatment_name_color: "#000000",
    menu_price_color: "#000000",
    menu_treatment_size: "sm",
    menu_treatment_bold: true,
    menu_category_bold: true,
    swatches: ["#000000", "#ffffff", "#f3f4f6", "#9ca3af"],
  },
};

export const LAYOUTS: { key: BookingLayoutKey; name: string; description: string }[] = [
  { key: "classic", name: "Classic Hero", description: "Big hero image with floating welcome card." },
  { key: "carousel", name: "Image Carousel", description: "Auto-rotating gallery at the top." },
  { key: "split", name: "Split Editorial", description: "Photo left, booking menu right on desktop." },
  { key: "magazine", name: "Minimal Magazine", description: "Editorial wordmark with a small photo strip." },
];
