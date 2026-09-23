export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent & room rental" },
  { value: "utilities", label: "Utilities & insurance" },
  { value: "marketing", label: "Marketing & software" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
] as const;

export const FREQUENCIES = [
  { value: "one_off", label: "One-off" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

export function categoryLabel(v: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? "Other";
}

type ExpenseLike = { amount_cents: number; frequency: string; start_date: string; end_date: string | null };

/** Every date (YYYY-MM-DD) an expense falls on within [fromIso, toIso]. */
export function expenseOccurrences(e: ExpenseLike, fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const end = e.end_date && e.end_date < toIso ? e.end_date : toIso;
  if (e.frequency === "one_off") {
    if (e.start_date >= fromIso && e.start_date <= toIso) out.push(e.start_date);
    return out;
  }
  const d = new Date(e.start_date + "T00:00:00");
  const startDay = d.getDate();
  let i = 0;
  while (i < 5000) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (iso > end) break;
    if (iso >= fromIso) out.push(iso);
    i++;
    if (e.frequency === "weekly") d.setDate(d.getDate() + 7);
    else if (e.frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
    else {
      // monthly — keep the same day, clamped to month length
      const base = new Date(e.start_date + "T00:00:00");
      base.setDate(1);
      base.setMonth(base.getMonth() + i);
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(startDay, last));
      d.setTime(base.getTime());
    }
  }
  return out;
}

export function monthlyEquivalentCents(e: ExpenseLike) {
  switch (e.frequency) {
    case "weekly": return Math.round((e.amount_cents * 52) / 12);
    case "monthly": return e.amount_cents;
    case "yearly": return Math.round(e.amount_cents / 12);
    default: return 0;
  }
}
