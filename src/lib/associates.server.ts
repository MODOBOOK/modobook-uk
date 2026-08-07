/**
 * Clinic associates — self-employed practitioners who trade under their own
 * MODO account but work inside (and under the regulatory oversight of) a host
 * clinic. Helpers here deal with the room side: when a host clinic allocates
 * rooms to an associate, every booking the associate takes must consume a room
 * unit, and the associate's own availability closes when no room is free.
 */

type Admin = any;

export type AssociateRoomLink = {
  id: string;
  clinic_profile_id: string;
  associate_profile_id: string | null;
  room_allocation_enabled: boolean;
  block_when_no_room: boolean;
  charge_room_rent: boolean;
  room_id: string | null;
  location_id: string | null;
};

const t2m = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const m2t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;

/** Active link for an associate profile, if the host clinic allocates rooms. */
export async function getActiveRoomLink(admin: Admin, associateProfileId: string): Promise<AssociateRoomLink | null> {
  const { data } = await admin
    .from("clinic_associates")
    .select("id, clinic_profile_id, associate_profile_id, room_allocation_enabled, block_when_no_room, charge_room_rent, room_id, location_id")
    .eq("associate_profile_id", associateProfileId)
    .eq("status", "active")
    .eq("room_allocation_enabled", true)
    .not("room_id", "is", null)
    .maybeSingle();
  return (data as AssociateRoomLink | null) ?? null;
}

type Interval = { start: number; end: number; units: number };

async function roomDayState(admin: Admin, link: AssociateRoomLink, date: string) {
  const { data: room } = await admin
    .from("rental_rooms")
    .select("id, profile_id, quantity, active")
    .eq("id", link.room_id)
    .maybeSingle();
  if (!room || room.active === false) return null;
  const capacity = Math.max(1, Number(room.quantity ?? 1));

  const weekday = new Date(`${date}T12:00:00`).getDay();
  const { data: hours } = await admin
    .from("rental_hours")
    .select("start_time, end_time")
    .eq("room_id", link.room_id)
    .eq("weekday", weekday);
  const open = (hours ?? []).map((h: any) => ({ start: t2m(h.start_time), end: t2m(h.end_time) }));

  const { data: blocks } = await admin
    .from("rental_blocks")
    .select("start_time, end_time, units")
    .eq("room_id", link.room_id)
    .eq("block_date", date);

  const { data: bookings } = await admin
    .from("rental_bookings")
    .select("start_time, end_time, status, unit_index")
    .eq("room_id", link.room_id)
    .eq("booking_date", date)
    .neq("status", "cancelled");

  const taken: Interval[] = [
    ...(blocks ?? []).map((b: any) => ({
      start: t2m(b.start_time ?? "00:00"),
      end: t2m(b.end_time ?? "23:59"),
      units: b.units == null ? capacity : Math.max(1, Number(b.units)),
    })),
    ...(bookings ?? []).map((b: any) => ({ start: t2m(b.start_time), end: t2m(b.end_time), units: 1 })),
  ];

  const usedUnitIndexes = (bookings ?? [])
    .map((b: any) => ({ start: t2m(b.start_time), end: t2m(b.end_time), idx: b.unit_index }))
    .filter((b: any) => b.idx != null);

  return { capacity, open, taken, usedUnitIndexes };
}

/** Units in use across [start,end) — the peak overlap, so a partial clash still counts. */
function peakUsage(taken: Interval[], start: number, end: number) {
  const points = new Set<number>([start]);
  for (const iv of taken) if (iv.start > start && iv.start < end) points.add(iv.start);
  let peak = 0;
  for (const p of points) {
    let used = 0;
    for (const iv of taken) if (iv.start < end && iv.end > p && iv.start <= p) used += iv.units;
    peak = Math.max(peak, used);
  }
  return peak;
}

/**
 * Is a room unit free for this window? Returns the unit index to allocate.
 */
export async function findFreeRoomUnit(
  admin: Admin,
  link: AssociateRoomLink,
  date: string,
  startTime: string,
  endTime: string,
): Promise<{ ok: boolean; unitIndex: number | null }> {
  const state = await roomDayState(admin, link, date);
  if (!state) return { ok: false, unitIndex: null };
  const s = t2m(startTime);
  const e = t2m(endTime);
  const withinOpen = state.open.length === 0 ? false : state.open.some((o: { start: number; end: number }) => s >= o.start && e <= o.end);
  if (!withinOpen) return { ok: false, unitIndex: null };
  if (peakUsage(state.taken, s, e) >= state.capacity) return { ok: false, unitIndex: null };

  const clashing = new Set(
    state.usedUnitIndexes.filter((u: any) => u.start < e && u.end > s).map((u: any) => Number(u.idx)),
  );
  for (let i = 1; i <= state.capacity; i++) if (!clashing.has(i)) return { ok: true, unitIndex: i };
  return { ok: true, unitIndex: null };
}

/**
 * Times of day on which the associate cannot take bookings because no room is
 * free. Returned in the same shape the public availability code uses for busy
 * blocks so callers can merge them straight in.
 */
export async function associateRoomBusy(
  admin: Admin,
  associateProfileId: string,
  date: string,
): Promise<{ start_time: string; end_time: string; status: string }[]> {
  const link = await getActiveRoomLink(admin, associateProfileId);
  if (!link || !link.block_when_no_room) return [];
  const state = await roomDayState(admin, link, date);
  if (!state) return [{ start_time: "00:00:00", end_time: "23:59:00", status: "no-room" }];

  const busy: { start_time: string; end_time: string; status: string }[] = [];
  // Everything outside the room's opening hours is unavailable.
  const open = [...state.open].sort((a, b) => a.start - b.start);
  if (open.length === 0) return [{ start_time: "00:00:00", end_time: "23:59:00", status: "no-room" }];
  let cursor = 0;
  for (const o of open) {
    if (o.start > cursor) busy.push({ start_time: m2t(cursor), end_time: m2t(o.start), status: "no-room" });
    cursor = Math.max(cursor, o.end);
  }
  if (cursor < 24 * 60) busy.push({ start_time: m2t(cursor), end_time: m2t(24 * 60 - 1), status: "no-room" });

  // Inside opening hours, block any 15-minute window where the room is at capacity.
  const step = 15;
  let runStart: number | null = null;
  for (const o of open) {
    for (let m = o.start; m < o.end; m += step) {
      const full = peakUsage(state.taken, m, Math.min(m + step, o.end)) >= state.capacity;
      if (full && runStart == null) runStart = m;
      if (!full && runStart != null) {
        busy.push({ start_time: m2t(runStart), end_time: m2t(m), status: "no-room" });
        runStart = null;
      }
    }
    if (runStart != null) {
      busy.push({ start_time: m2t(runStart), end_time: m2t(o.end), status: "no-room" });
      runStart = null;
    }
  }
  return busy;
}

/**
 * Reserve a room unit for an associate's appointment. Safe to call more than
 * once — the unique index on associate_appointment_id keeps it idempotent.
 */
export async function allocateRoomForAppointment(appointmentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin: Admin = supabaseAdmin;
  const { data: appt } = await admin
    .from("appointments")
    .select("id, profile_id, scheduled_date, start_time, end_time, patient_name, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt || appt.status === "cancelled") return null;

  const link = await getActiveRoomLink(admin, appt.profile_id);
  if (!link) return null;

  const { data: existing } = await admin
    .from("rental_bookings")
    .select("id")
    .eq("associate_appointment_id", appointmentId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { ok, unitIndex } = await findFreeRoomUnit(admin, link, appt.scheduled_date, appt.start_time, appt.end_time);
  if (!ok) return null;

  const { data: assoc } = await admin
    .from("profiles")
    .select("clinic_name, full_name, email")
    .eq("id", link.associate_profile_id)
    .maybeSingle();

  const hours =
    Math.round(((t2m(appt.end_time) - t2m(appt.start_time)) / 60) * 100) / 100;

  let price = 0;
  if (link.charge_room_rent) {
    const { data: room } = await admin.from("rental_rooms").select("hourly_rate").eq("id", link.room_id).maybeSingle();
    price = Math.round(Number(room?.hourly_rate ?? 0) * hours * 100) / 100;
  }

  const { data: inserted, error } = await admin
    .from("rental_bookings")
    .insert({
      profile_id: link.clinic_profile_id,
      room_id: link.room_id,
      booking_date: appt.scheduled_date,
      start_time: appt.start_time,
      end_time: appt.end_time,
      unit: "hour",
      hours,
      price,
      status: "confirmed",
      payment_status: price > 0 ? "pending" : "paid",
      payment_mode: "enquiry",
      renter_name: assoc?.clinic_name || assoc?.full_name || "Associate",
      renter_email: assoc?.email || "",
      renter_business: assoc?.clinic_name ?? null,
      notes: `Auto-allocated for associate booking (${appt.patient_name ?? "patient"})`,
      unit_index: unitIndex,
      associate_profile_id: link.associate_profile_id,
      associate_appointment_id: appointmentId,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[associates] room allocation failed", error);
    return null;
  }
  return (inserted?.id as string) ?? null;
}

/** Release the room when an associate's appointment is cancelled. */
export async function releaseRoomForAppointment(appointmentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as Admin)
    .from("rental_bookings")
    .update({ status: "cancelled" })
    .eq("associate_appointment_id", appointmentId);
}
