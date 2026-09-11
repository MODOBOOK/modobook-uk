/**
 * Work out which practitioner a booking belongs to when the patient wasn't
 * asked to choose one.
 *
 * Without this, appointments are saved with no practitioner, so the diary,
 * the analytics filters and the "who are they with" line on reminders all
 * fall back to "whole team" — which is what causes half-and-half location
 * days to look wrong.
 *
 * Only ever assigns when the answer is unambiguous:
 *  - the clinic has a single active practitioner, or
 *  - exactly one practitioner is rota'd on at that location/date/time.
 */
export async function resolveBookingPractitioner(
  supabase: any,
  args: {
    profileId: string;
    date: string;
    startTime: string;
    endTime?: string | null;
    locationId?: string | null;
  },
): Promise<string | null> {
  try {
    const toMin = (t?: string | null) => {
      if (!t) return null;
      const [h, m] = String(t).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const start = toMin(args.startTime) ?? 0;
    const end = toMin(args.endTime) ?? start + 1;

    const { data: pracs } = await supabase
      .from("practitioners")
      .select("id")
      .eq("profile_id", args.profileId)
      .eq("active", true);
    const ids = (pracs ?? []).map((p: { id: string }) => p.id as string);
    if (ids.length === 0) return null;
    if (ids.length === 1) return ids[0]!;

    const matchesLocation = (locId: string | null | undefined) =>
      !locId || !args.locationId || locId === args.locationId;
    const covers = (from: string, to: string) =>
      (toMin(from) ?? 0) <= start && (toMin(to) ?? 0) >= end;

    const dow = new Date(`${args.date}T00:00:00`).getDay();
    const [{ data: overrides }, { data: rules }] = await Promise.all([
      supabase
        .from("availability_overrides")
        .select("practitioner_id, location_id, start_time, end_time")
        .eq("profile_id", args.profileId)
        .eq("date", args.date),
      supabase
        .from("availability_rules")
        .select("practitioner_id, location_id, start_time, end_time, effective_from, effective_to")
        .eq("profile_id", args.profileId)
        .eq("day_of_week", dow),
    ]);

    const found = new Set<string>();
    for (const o of (overrides ?? []) as any[]) {
      if (!o.practitioner_id) continue;
      if (!matchesLocation(o.location_id)) continue;
      if (!covers(o.start_time, o.end_time)) continue;
      found.add(o.practitioner_id as string);
    }
    if (found.size === 0) {
      for (const r of (rules ?? []) as any[]) {
        if (!r.practitioner_id) continue;
        if (!matchesLocation(r.location_id)) continue;
        if (r.effective_from && args.date < r.effective_from) continue;
        if (r.effective_to && args.date > r.effective_to) continue;
        if (!covers(r.start_time, r.end_time)) continue;
        found.add(r.practitioner_id as string);
      }
    }
    if (found.size === 1) return [...found][0]!;
    return null;
  } catch {
    return null;
  }
}
