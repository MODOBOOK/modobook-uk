import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, type CSSProperties } from "react";
import { getMyTheme } from "@/lib/theme.functions";
import { buildThemeVars } from "@/lib/theme-vars";
import { resolveDashboardTheme } from "@/lib/dashboard-appearance";


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
    return buildThemeVars(resolveDashboardTheme(theme as Record<string, unknown>));
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
