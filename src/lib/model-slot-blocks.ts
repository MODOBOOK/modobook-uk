// Shared helpers: hide model slots that fall inside practitioner closures
// (blocked dates / blocked times) set on the diary.

export type BlockedDateRow = { date: string; location_id?: string | null };
export type BlockedTimeRow = {
  date: string;
  start_time: string;
  end_time: string;
  location_id?: string | null;
};

type SlotLike = {
  slot_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location_id?: string | null;
  is_flexible?: boolean | null;
};

const toMin = (t?: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m || 0);
};

const sameLocation = (blockLoc: string | null | undefined, slotLoc: string | null | undefined) =>
  !blockLoc || blockLoc === slotLoc;

export function isModelSlotBlocked(
  slot: SlotLike,
  blockedDates: BlockedDateRow[],
  blockedTimes: BlockedTimeRow[],
): boolean {
  // Flexible / undated slots aren't tied to a diary day.
  if (!slot.slot_date) return false;

  for (const b of blockedDates) {
    if (b.date === slot.slot_date && sameLocation(b.location_id, slot.location_id)) return true;
  }

  const s = toMin(slot.start_time);
  const e = toMin(slot.end_time) ?? (s !== null ? s + 1 : null);
  if (s === null || e === null) return false;

  for (const b of blockedTimes) {
    if (b.date !== slot.slot_date) continue;
    if (!sameLocation(b.location_id, slot.location_id)) continue;
    const bs = toMin(b.start_time);
    const be = toMin(b.end_time);
    if (bs === null || be === null) continue;
    if (s < be && e > bs) return true;
  }
  return false;
}

export function filterUnblockedModelSlots<T extends SlotLike>(
  slots: T[],
  blockedDates: BlockedDateRow[],
  blockedTimes: BlockedTimeRow[],
): T[] {
  return slots.filter((s) => !isModelSlotBlocked(s, blockedDates, blockedTimes));
}
