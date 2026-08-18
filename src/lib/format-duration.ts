/** Human duration: 360 -> "6 hrs", 90 -> "1 hr 30 min", 45 -> "45 min". */
export function formatDuration(mins: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(mins ?? 0)));
  if (!total) return "0 min";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} hr${h === 1 ? "" : "s"} ${m} min`;
  if (h) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${m} min`;
}
