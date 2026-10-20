/**
 * Pure availability helpers for room rental — shared by the server functions
 * and unit tests. No server-only imports allowed here.
 */

export type RentalDayHours = { start_time: string; end_time: string };
export type RentalBlock = { start_time?: string | null; end_time?: string | null; units?: number | null };
export type RentalBookingSlice = { start_time: string; end_time: string };

function hhmm(t: string) {
  return t.slice(0, 5);
}
export function rentalToMin(t: string) {
  const [h, m] = hhmm(t).split(":").map(Number);
  return h * 60 + m;
}

/** How many rooms are taken out of service across [s,e) by closures. */
export function rentalBlockedUnits(blocks: RentalBlock[], capacity: number, s: number, e: number) {
  let max = 0;
  for (const b of blocks) {
    const bs = b.start_time ? rentalToMin(b.start_time) : 0;
    const be = b.end_time ? rentalToMin(b.end_time) : 1440;
    if (s < be && e > bs) {
      const u = b.units == null ? capacity : Math.max(0, Number(b.units));
      if (u > max) max = u;
    }
  }
  return Math.min(capacity, max);
}

function slotFree(blocks: RentalBlock[], booked: RentalBookingSlice[], capacity: number, s: number, e: number) {
  const usable = capacity - rentalBlockedUnits(blocks, capacity, s, e);
  const used = booked.filter((b) => s < rentalToMin(b.end_time) && e > rentalToMin(b.start_time)).length;
  return usable - used > 0;
}

/**
 * Can `needSlots` consecutive slots be booked on a day with the given open
 * hours, closures and existing bookings?
 *
 * A booking longer than the day's whole open span (e.g. a "full day" when the
 * clinic opens fewer hours that day, like a Saturday) means booking the entire
 * open day — so the day counts as available when every open slot is free,
 * not when an impossible longer run fits.
 */
export function rentalDayHasAvailability(opts: {
  dayHours: RentalDayHours[];
  blocks: RentalBlock[];
  booked: RentalBookingSlice[];
  capacity: number;
  step: number;
  needSlots: number;
}): boolean {
  const { dayHours, blocks, booked, step } = opts;
  const capacity = Math.max(1, opts.capacity);
  const need = Math.max(1, opts.needSlots);
  if (dayHours.length === 0) return false;

  const openMin = dayHours.reduce((sum, h) => sum + (rentalToMin(h.end_time) - rentalToMin(h.start_time)), 0);

  if (need * step >= openMin) {
    // Whole-day booking: every open slot must be free.
    return dayHours.every((h) => {
      for (let mm = rentalToMin(h.start_time); mm + step <= rentalToMin(h.end_time); mm += step) {
        if (!slotFree(blocks, booked, capacity, mm, mm + step)) return false;
      }
      return true;
    });
  }

  for (const h of dayHours) {
    let run = 0;
    for (let mm = rentalToMin(h.start_time); mm + step <= rentalToMin(h.end_time); mm += step) {
      run = slotFree(blocks, booked, capacity, mm, mm + step) ? run + 1 : 0;
      if (run >= need) return true;
    }
  }
  return false;
}
