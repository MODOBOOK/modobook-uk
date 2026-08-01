import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, type CSSProperties } from "react";
import { getMyTheme } from "@/lib/theme.functions";
import { buildThemeVars } from "@/lib/theme-vars";


/**
 * Pulls the practitioner's clinic_theme (colours/fonts chosen in Branding)
 * and returns CSS variable overrides for the dashboard wrapper, so the
 * in-app studio matches their booking link branding.
 *
 * Also mirrors the variables onto :root so Radix portals (Dialog, Sheet,
 * Popover, Select) — which render outside the dashboard wrapper — inherit
 * the same theme.
 */
export function useDashboardThemeStyle(): CSSProperties {
  const fn = useServerFn(getMyTheme);
  const { data: theme } = useQuery({
    queryKey: ["my-theme"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const vars = useMemo<Record<string, string>>(() => {
    if (!theme) return {};
    return buildVars(theme as Record<string, unknown>);
  }, [theme]);

  const serialized = JSON.stringify(vars);
  useEffect(() => {
    const root = document.documentElement;
    const applied: string[] = [];
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
      applied.push(key);
    }
    return () => {
      for (const key of applied) root.style.removeProperty(key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return vars as CSSProperties;
}

function buildVars(theme: Record<string, unknown>): Record<string, string> {
  const v: Record<string, string> = {};
  const get = (k: string) => {
    const val = theme[k];
    return typeof val === "string" && val.trim() ? val : null;
  };
  const set = (k: string, val: string | null) => {
    if (val) v[k] = val;
  };

  const bg = get("background_color");
  const text = get("text_color");
  const primary = get("primary_color");
  const accent = get("accent_color");
  const cardBg = get("menu_card_bg") ?? bg;
  const cardBorder = get("menu_card_border_color") ?? accent;
  const headerBg = get("header_bg_color") ?? "#ffffff";
  const headerText = get("header_text_color") ?? text;
  const headingFont = get("heading_font");
  const bodyFont = get("body_font");

  set("--background", bg);
  set("--foreground", text);
  set("--card", cardBg);
  set("--card-foreground", text);
  set("--popover", cardBg);
  set("--popover-foreground", text);
  set("--primary", primary);
  set("--primary-foreground", headerBg);
  set("--secondary", cardBg);
  set("--secondary-foreground", text);
  set("--muted", cardBg);
  set("--muted-foreground", text);
  set("--accent", accent);
  set("--accent-foreground", headerBg);
  set("--border", cardBorder);
  set("--input", cardBorder);
  set("--ring", accent);

  set("--sidebar", headerBg);
  set("--sidebar-foreground", headerText);
  set("--sidebar-primary", primary);
  set("--sidebar-primary-foreground", headerBg);
  set("--sidebar-accent", cardBg);
  set("--sidebar-accent-foreground", text);
  set("--sidebar-border", cardBorder);
  set("--sidebar-ring", accent);

  if (headingFont) v["--font-serif"] = `"${headingFont}", Georgia, serif`;
  if (bodyFont) v["--font-sans"] = `"${bodyFont}", system-ui, sans-serif`;

  return v;
}
