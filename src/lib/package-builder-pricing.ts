/** Shared (client + server safe) pricing rules for "build your own package". */

export type BuilderMode = "sum" | "percent" | "tier_count" | "tier_spend" | "fixed";

export type BuilderTier = { min: number; value: number };

export type BuilderRules = {
  mode: BuilderMode;
  discount_percent?: number | null;
  tiers?: BuilderTier[] | null;
  fixed_price?: number | null;
  pick_count?: number | null;
  min_items?: number | null;
  max_items?: number | null;
};

export type BuilderSelection = { treatment_id: string; qty: number; price: number };

export function totalItems(sel: BuilderSelection[]) {
  return sel.reduce((s, x) => s + Math.max(0, x.qty), 0);
}

export function baseTotal(sel: BuilderSelection[]) {
  return sel.reduce((s, x) => s + Math.max(0, x.qty) * (x.price || 0), 0);
}

function sortedTiers(tiers?: BuilderTier[] | null) {
  return [...(tiers ?? [])]
    .filter((t) => Number.isFinite(t?.min) && Number.isFinite(t?.value))
    .sort((a, b) => a.min - b.min);
}

/** Returns { base, total, saving } for a selection under the builder's rules. */
export function computeBuilderPrice(rules: BuilderRules, sel: BuilderSelection[]) {
  const base = baseTotal(sel);
  const count = totalItems(sel);
  let total = base;

  switch (rules.mode) {
    case "percent": {
      const pct = Number(rules.discount_percent ?? 0);
      total = base * (1 - Math.min(100, Math.max(0, pct)) / 100);
      break;
    }
    case "tier_count": {
      let pct = 0;
      for (const t of sortedTiers(rules.tiers)) if (count >= t.min) pct = t.value;
      total = base * (1 - Math.min(100, Math.max(0, pct)) / 100);
      break;
    }
    case "tier_spend": {
      let off = 0;
      for (const t of sortedTiers(rules.tiers)) if (base >= t.min) off = t.value;
      total = Math.max(0, base - off);
      break;
    }
    case "fixed": {
      total = Number(rules.fixed_price ?? 0);
      break;
    }
    default:
      total = base;
  }

  total = Math.max(0, Math.round(total * 100) / 100);
  return { base: Math.round(base * 100) / 100, total, saving: Math.max(0, Math.round((base - total) * 100) / 100) };
}

/** Human summary of the offer, e.g. "Pick any 3 for £399". */
export function describeBuilder(rules: BuilderRules) {
  switch (rules.mode) {
    case "percent":
      return `${Number(rules.discount_percent ?? 0)}% off your bundle`;
    case "tier_count": {
      const t = sortedTiers(rules.tiers);
      if (!t.length) return "Bundle and save";
      return t.map((x) => `${x.min}+ items ${x.value}% off`).join(" · ");
    }
    case "tier_spend": {
      const t = sortedTiers(rules.tiers);
      if (!t.length) return "Bundle and save";
      return t.map((x) => `£${x.value} off over £${x.min}`).join(" · ");
    }
    case "fixed":
      return `Pick any ${rules.pick_count ?? rules.min_items ?? 3} for £${Number(rules.fixed_price ?? 0).toFixed(2)}`;
    default:
      return "Choose your own combination";
  }
}

/** Validation: null when the selection is allowed, otherwise a reason. */
export function validateSelection(rules: BuilderRules, sel: BuilderSelection[]): string | null {
  const count = totalItems(sel);
  if (count === 0) return "Pick at least one treatment";
  if (rules.mode === "fixed" && rules.pick_count) {
    if (count !== rules.pick_count) return `Pick exactly ${rules.pick_count} to unlock this price`;
    return null;
  }
  const min = rules.min_items ?? 1;
  if (count < min) return `Pick at least ${min} treatments`;
  if (rules.max_items && count > rules.max_items) return `Pick no more than ${rules.max_items} treatments`;
  return null;
}
