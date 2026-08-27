/**
 * Server-side double-booking guard.
 *
 * Availability shown to patients is computed in the browser from a snapshot of
 * the day. If two people hold the page open (or one person's page is stale),
 * both can submit the same slot and we'd happily insert both rows. This module
 * re-checks the slot on the server immediately before AND after the insert, so
 * the loser of a race is rolled back instead of double-booked.
 */

export type TimeRange = { start: string; end: string };

const toMin = (t: string) => {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

type ApptRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string | null;
  payment_status: string | null;
  payment_hold_expires_at: string | null;
  created_at: string;
};

async function loadBusy(
  admin: { from: (t: string) => any },
  profileId: string,
  date: string,
  excludeIds: string[],
) {
  const { data: profileRow } = await admin
    .from("profiles")
    .select("booking_buffer_before_minutes,booking_buffer_after_minutes")
    .eq("id", profileId)
    .maybeSingle();
  const bufferBefore = Number(profileRow?.booking_buffer_before_minutes ?? 0);
  const bufferAfter = Number(profileRow?.booking_buffer_after_minutes ?? 0);

  const { data: rows } = await admin
    .from("appointments")
    .select("id,start_time,end_time,status,payment_status,payment_hold_expires_at,created_at")
    .eq("profile_id", profileId)
    .eq("scheduled_date", date)
    .neq("status", "cancelled");

  const now = Date.now();
  return ((rows ?? []) as ApptRow[])
    .filter((r) => !excludeIds.includes(r.id))
    .filter((r) => {
      // An unpaid pending booking whose Stripe hold has expired no longer
      // blocks the slot (mirrors getDayAvailability).
      const held = r.payment_hold_expires_at;
      if (!held) return true;
      if (r.payment_status === "paid") return true;
      if (r.status !== "pending") return true;
      return new Date(held).getTime() > now;
    })
    .map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      startMin: toMin(r.start_time) - bufferBefore,
      endMin: toMin(r.end_time) + bufferAfter,
    }));
}

const overlaps = (busy: { startMin: number; endMin: number }, r: TimeRange) =>
  toMin(r.start) < busy.endMin && busy.startMin < toMin(r.end);

export const SLOT_TAKEN_MESSAGE =
  "Sorry — that time was just booked by someone else. Please pick another slot.";

/** Throws if any of the requested ranges clashes with an existing appointment. */
export async function assertSlotAvailable(args: {
  admin: any;
  profileId: string;
  date: string;
  ranges: TimeRange[];
  excludeIds?: string[];
}) {
  const busy = await loadBusy(args.admin, args.profileId, args.date, args.excludeIds ?? []);
  const clash = busy.some((b) => args.ranges.some((r) => overlaps(b, r)));
  if (clash) throw new Error(SLOT_TAKEN_MESSAGE);
}

/**
 * Post-insert race check. Returns true when another booking that was created
 * BEFORE ours overlaps our slot — meaning we lost the race and must roll back.
 */
export async function lostBookingRace(args: {
  admin: any;
  profileId: string;
  date: string;
  ranges: TimeRange[];
  ownIds: string[];
  ownCreatedAt?: string;
}) {
  const busy = await loadBusy(args.admin, args.profileId, args.date, args.ownIds);
  const ours = args.ownCreatedAt ? new Date(args.ownCreatedAt).getTime() : Date.now();
  return busy.some(
    (b) =>
      new Date(b.createdAt).getTime() <= ours &&
      args.ranges.some((r) => overlaps(b, r)),
  );
}
