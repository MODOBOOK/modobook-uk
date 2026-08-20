export type PriceMode = "fixed" | "from" | "poa" | "free";
export type TreatmentBadge = "recommended" | "popular" | "new" | "bestseller";

export function formatPrice(
  price: number,
  mode: PriceMode | null | undefined,
  opts: { currency?: string; showZeroAsFree?: boolean } = {},
): string {
  const cur = opts.currency ?? "£";
  const m = mode ?? "fixed";
  if (m === "poa") return "POA";
  if (m === "free") return "Free";
  const amount = `${cur}${Number(price ?? 0).toFixed(2)}`;
  if (m === "from") return `From ${amount}`;
  if ((opts.showZeroAsFree ?? false) && (!price || price === 0)) return "Free";
  return amount;
}

export const BADGE_LABEL: Record<TreatmentBadge, string> = {
  recommended: "Recommended",
  popular: "Popular",
  new: "New",
  bestseller: "Bestseller",
};

export function badgeClasses(badge: TreatmentBadge): string {
  switch (badge) {
    case "recommended":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "popular":
      return "bg-rose-100 text-rose-900 border-rose-300";
    case "new":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "bestseller":
      return "bg-indigo-100 text-indigo-900 border-indigo-300";
  }
}

export type DiscountableTreatment = {
  price?: number | null;
  price_mode?: string | null;
  discount_percent?: number | null;
  discount_starts_at?: string | null;
  discount_ends_at?: string | null;
  discount_days_of_week?: number[] | null;
  discount_show_was_now?: boolean | null;
  discount_label?: string | null;
};

/**
 * Single source of truth for a treatment's live sale price.
 * Returns the base price plus the discounted price when an active
 * percentage discount window applies.
 */
export function treatmentPricing(
  t: DiscountableTreatment | null | undefined,
  basePriceOverride?: number,
): {
  mode: PriceMode;
  base: number;
  price: number;
  hasDiscount: boolean;
  percent: number;
  showWasNow: boolean;
  label: string | null;
} {
  const mode = ((t?.price_mode ?? "fixed") as PriceMode) || "fixed";
  const base = Number(basePriceOverride ?? t?.price ?? 0);
  const pct = t?.discount_percent ?? null;
  const startsAt = t?.discount_starts_at ?? null;
  const endsAt = t?.discount_ends_at ?? null;
  const dows = t?.discount_days_of_week ?? null;
  const now = new Date();
  const inWindow =
    (!startsAt || new Date(startsAt) <= now) &&
    (!endsAt || new Date(endsAt) >= now) &&
    (!dows || dows.length === 0 || dows.includes(now.getDay()));
  const allow = mode !== "poa" && mode !== "free";
  const hasDiscount = Boolean(allow && pct != null && pct > 0 && inWindow && base > 0);
  const price = hasDiscount ? Math.round(base * (1 - (pct as number) / 100) * 100) / 100 : base;
  return {
    mode,
    base,
    price,
    hasDiscount,
    percent: hasDiscount ? (pct as number) : 0,
    showWasNow: t?.discount_show_was_now !== false,
    label: t?.discount_label ?? null,
  };
}
