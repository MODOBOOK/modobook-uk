// Shared helpers for multi-week rota availability rules.
// A rule has cycle_length (1|2|4) and weeks_mask (bitmask, bit i = week i active).
// The anchor date is a fixed Monday stored on the profile. Any date's "week letter"
// is floor(daysSince(anchorMonday) / 7) mod cycle_length.

export type RotaRule = {
  cycle_length?: number | null;
  weeks_mask?: number | null;
  /** Rota start date — the shift does not apply before this date. */
  effective_from?: string | null;
  /** Rota end date — the shift stops applying after this date. */
  effective_to?: string | null;
};

export function toMondayIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function weekLetterFor(iso: string, anchorIso: string | null | undefined, cycleLength: number): number {
  if (!anchorIso || cycleLength <= 1) return 0;
  const a = new Date(toMondayIso(anchorIso) + "T00:00:00Z").getTime();
  const b = new Date(toMondayIso(iso) + "T00:00:00Z").getTime();
  const weeks = Math.floor((b - a) / (7 * 24 * 60 * 60 * 1000));
  return ((weeks % cycleLength) + cycleLength) % cycleLength;
}

export function ruleAppliesOnDate(rule: RotaRule, iso: string, anchorIso: string | null | undefined): boolean {
  if (rule.effective_from && iso < rule.effective_from) return false;
  if (rule.effective_to && iso > rule.effective_to) return false;
  const cycle = rule.cycle_length ?? 1;
  const mask = rule.weeks_mask ?? 1;
  if (cycle <= 1) return true;
  const letter = weekLetterFor(iso, anchorIso, cycle);
  return (mask & (1 << letter)) !== 0;
}

export const WEEK_LETTERS = ["A", "B", "C", "D"];
