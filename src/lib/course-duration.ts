import { formatDuration } from "@/lib/format-duration";

export type CourseDurationInput = {
  duration_min: number;
  day_count?: number | null;
  days_consecutive?: boolean | null;
  day_duration_min?: number | null;
};

/** Human label for a course length, handling multi-day courses. */
export function courseDuration(c: CourseDurationInput): string {
  const days = Math.max(1, Number(c.day_count ?? 1) || 1);
  const perDay = Number(c.day_duration_min ?? 0) || 0;
  if (days > 1) {
    const each = perDay > 0 ? perDay : Math.round((Number(c.duration_min) || 0) / days);
    const run = c.days_consecutive === false ? "" : " consecutive";
    return `${days}${run} days · ${formatDuration(each)} per day`;
  }
  return formatDuration(c.duration_min);
}
