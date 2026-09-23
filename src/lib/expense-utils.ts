export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent & room rental" },
  { value: "utilities", label: "Utilities & insurance" },
  { value: "marketing", label: "Marketing & software" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
] as const;

export const FREQUENCIES = [
  { value: "one_off", label: "One-off" },
  { value: "hourly", label: "Per hour (room hire)" },
  { value: "half_hourly", label: "Per half hour (room hire)" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

/** Hourly/half-hourly costs are charged per hour of room use — the amount is the hourly rate. */
export function isHourlyFreq(frequency: string) {
  return frequency === "hourly" || frequency === "half_hourly";
}

/** Cost in cents for a number of minutes of room use. Half-hourly rounds up to whole half-hour blocks. */
export function hourlyCostCents(e: { amount_cents: number; frequency: string }, minutes: number) {
  if (minutes <= 0) return 0;
  if (e.frequency === "half_hourly") return Math.round(Math.ceil(minutes / 30) * 0.5 * e.amount_cents);
  return Math.round((minutes / 60) * e.amount_cents);
}

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
    else if (isHourlyFreq(e.frequency)) break; // hourly costs have no calendar occurrences
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
