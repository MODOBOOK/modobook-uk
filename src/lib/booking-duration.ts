/** Missing duration retains the legacy fallback; an explicit zero remains zero. */
export function requiredBookingMinutes(duration: number | null | undefined): number {
  return duration == null || !Number.isFinite(duration) ? 15 : Math.max(0, Math.round(duration));
}

export function bookingFitsGap(gapMinutes: number, duration: number | null | undefined): boolean {
  return gapMinutes > 0 && gapMinutes >= requiredBookingMinutes(duration);
}

/** A time grid must advance even when the appointment takes no time. */
export function bookingSlotStep(interval: number | null | undefined, duration = 0): number {
  if (interval != null && Number.isFinite(interval) && interval > 0) return interval;
  return duration > 0 && Number.isFinite(duration) ? duration : 15;
}