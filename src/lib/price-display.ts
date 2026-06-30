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
