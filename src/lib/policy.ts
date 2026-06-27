export type CancellationRule = {
  hours_before: number; // cancel within this many hours triggers the fee
  fee_percent: number; // % of treatment price
};

export function describeCancellationRules(rules: CancellationRule[]): string[] {
  if (!rules || rules.length === 0) return [];
  const sorted = [...rules].sort((a, b) => a.hours_before - b.hours_before);
  return sorted.map((r) => {
    const hrs = r.hours_before;
    const window =
      hrs < 24 ? `${hrs} hour${hrs === 1 ? "" : "s"}` :
      hrs % 24 === 0 ? `${hrs / 24} day${hrs / 24 === 1 ? "" : "s"}` :
      `${hrs} hours`;
    return `Cancel within ${window} of your appointment — ${r.fee_percent}% charge applies`;
  });
}
