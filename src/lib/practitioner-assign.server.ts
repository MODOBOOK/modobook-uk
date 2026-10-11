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
/**
 * Which treatments a practitioner offers, based on their assigned service
 * list. A practitioner with no assignments offers everything (matches the
 * booking-page menu rule); once they have a list, only those services count.
 */
export async function practitionerOffersTreatments(
  supabase: any,
  profileId: string,
  practitionerId: string,
  treatmentIds: string[],
): Promise<boolean> {
  if (treatmentIds.length === 0) return true;
  const { data: rows } = await supabase
    .from("practitioner_treatments")
    .select("treatment_id")
    .eq("profile_id", profileId)
    .eq("practitioner_id", practitionerId);
  const mine = new Set((rows ?? []).map((r: { treatment_id: string }) => r.treatment_id));
  if (mine.size === 0) return true;
  return treatmentIds.every((id) => mine.has(id));
}

/**
 * When the patient hasn't picked a practitioner ("no preference"), which
 * practitioners could actually take this booking? Used to stop hours
 * belonging to someone who doesn't offer the service from creating
 * bookable slots. Returns null when no filtering is needed (a practitioner
 * was chosen, or no treatments were specified).
 */
export async function eligiblePractitionerIds(
  supabase: any,
  profileId: string,
  chosenPractitionerId: string | null,
  treatmentIds?: string[],
): Promise<Set<string> | null> {
  if (chosenPractitionerId) return null;
  const ids = (treatmentIds ?? []).filter(Boolean);
  if (ids.length === 0) return null;
  try {
    const [{ data: pracs }, { data: links }] = await Promise.all([
      supabase.from("practitioners").select("id").eq("profile_id", profileId).eq("active", true),
      supabase.from("practitioner_treatments").select("practitioner_id, treatment_id").eq("profile_id", profileId),
    ]);
    const byPract = new Map<string, Set<string>>();
    for (const l of (links ?? []) as any[]) {
      const arr = byPract.get(l.practitioner_id) ?? new Set<string>();
      arr.add(l.treatment_id as string);
      byPract.set(l.practitioner_id, arr);
    }
    return new Set(
      ((pracs ?? []) as any[])
        .filter((p) => {
          const mine = byPract.get(p.id as string);
          // No service list = offers everything (matches the menu rule).
          return !mine || mine.size === 0 || ids.every((t) => mine.has(t));
        })
        .map((p) => p.id as string),
    );
  } catch {
    return null;
  }
}

export async function resolveBookingPractitioner(
  supabase: any,
  args: {
    profileId: string;
    date: string;
    startTime: string;
    endTime?: string | null;
    locationId?: string | null;
    /** Services being booked — a practitioner is only assigned if they offer them. */
    treatmentIds?: string[];
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
    const treatmentIds = args.treatmentIds ?? [];

    const { data: pracs } = await supabase
      .from("practitioners")
      .select("id")
      .eq("profile_id", args.profileId)
      .eq("active", true);
    const ids = (pracs ?? []).map((p: { id: string }) => p.id as string);
    if (ids.length === 0) return null;
    if (ids.length === 1) {
      return (await practitionerOffersTreatments(supabase, args.profileId, ids[0]!, treatmentIds))
        ? ids[0]!
        : null;
    }

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
    // Never assign someone who doesn't offer the service being booked.
    for (const id of [...found]) {
      if (!(await practitionerOffersTreatments(supabase, args.profileId, id, treatmentIds))) {
        found.delete(id);
      }
    }
    if (found.size === 1) return [...found][0]!;
    return null;
  } catch {
    return null;
  }
}
