import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { CSSProperties } from "react";
import { getMyTheme } from "@/lib/theme.functions";

/**
 * Pulls the practitioner's clinic_theme (colours/fonts chosen in Branding)
 * and returns CSS variable overrides for the dashboard wrapper, so the
 * in-app studio matches their booking link branding.
 */
export function useDashboardThemeStyle(): CSSProperties {
  const fn = useServerFn(getMyTheme);
  const { data: theme } = useQuery({
    queryKey: ["my-theme"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  if (!theme) return {};

  const v: Record<string, string> = {};
  const set = (k: string, val: unknown) => {
    if (typeof val === "string" && val.trim()) v[k] = val;
  };

  set("--background", theme.background_color);
  set("--foreground", theme.text_color);
  set("--card", theme.menu_card_bg ?? theme.background_color);
  set("--card-foreground", theme.text_color);
  set("--popover", theme.menu_card_bg ?? theme.background_color);
  set("--popover-foreground", theme.text_color);
  set("--primary", theme.primary_color);
  set("--primary-foreground", theme.header_bg_color ?? "#ffffff");
  set("--secondary", theme.menu_card_bg ?? theme.background_color);
  set("--secondary-foreground", theme.text_color);
  set("--muted", theme.menu_card_bg ?? theme.background_color);
  set("--muted-foreground", theme.text_color);
  set("--accent", theme.accent_color);
  set("--accent-foreground", theme.header_bg_color ?? "#ffffff");
  set("--border", theme.menu_card_border_color ?? theme.accent_color);
  set("--input", theme.menu_card_border_color ?? theme.accent_color);
  set("--ring", theme.accent_color);

  set("--sidebar", theme.header_bg_color ?? theme.background_color);
  set("--sidebar-foreground", theme.header_text_color ?? theme.text_color);
  set("--sidebar-primary", theme.primary_color);
  set("--sidebar-primary-foreground", theme.header_bg_color ?? "#ffffff");
  set("--sidebar-accent", theme.menu_card_bg ?? theme.background_color);
  set("--sidebar-accent-foreground", theme.text_color);
  set("--sidebar-border", theme.menu_card_border_color ?? theme.accent_color);
  set("--sidebar-ring", theme.accent_color);

  if (theme.heading_font) {
    v["--font-serif"] = `"${theme.heading_font}", Georgia, serif`;
  }
  if (theme.body_font) {
    v["--font-sans"] = `"${theme.body_font}", system-ui, sans-serif`;
  }

  return v as CSSProperties;
}
