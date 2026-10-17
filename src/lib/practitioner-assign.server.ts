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
 * Validate the practitioner a patient picked before a booking is written.
 *
 * The practitioner on a booking decides which Stripe account takes the
 * deposit, so we never silently swap the patient's choice for someone else:
 *  - a chosen practitioner must belong to this clinic, be active and offer
 *    every service being booked, otherwise the booking is refused;
 *  - when the clinic requires patients to choose (and has more than one
 *    practitioner), a booking with no choice is refused rather than being
 *    auto-assigned to whoever happens to be on the rota.
 * Returns the validated practitioner id (or null when none was needed).
 */
export async function validateChosenPractitioner(
  supabase: any,
  args: {
    profileId: string;
    practitionerId: string | null | undefined;
    treatmentIds: string[];
    /** A model slot advertised for a specific team member counts as a choice. */
    fallbackPractitionerId?: string | null;
    /**
     * Multi-treatment baskets can include a package item someone else
     * performs; there the chosen practitioner must offer at least one item
     * (they still own the booking and its deposit).
     */
    requireAll?: boolean;
    /** Model-slot bookings are advertised by the clinic; no choice needed. */
    allowNone?: boolean;
  },
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const chosen = args.practitionerId || null;
  if (chosen) {
    const { data: pract } = await supabaseAdmin
      .from("practitioners")
      .select("id, name, active")
      .eq("id", chosen)
      .eq("profile_id", args.profileId)
      .maybeSingle();
    const p = pract as { id: string; name?: string | null; active?: boolean | null } | null;
    if (!p || p.active === false) {
      throw new Error("The practitioner you chose is no longer available. Please go back and choose again.");
    }
    const requireAll = args.requireAll !== false;
    const offers = requireAll
      ? await practitionerOffersTreatments(supabase, args.profileId, chosen, args.treatmentIds)
      : args.treatmentIds.length === 0 ||
        (
          await Promise.all(
            args.treatmentIds.map((t) => practitionerOffersTreatments(supabase, args.profileId, chosen, [t])),
          )
        ).some(Boolean);
    if (!offers) {
      throw new Error(
        `${p.name ?? "This practitioner"} doesn't offer this treatment. Please go back and choose another practitioner.`,
      );
    }
    return chosen;
  }
  if (args.fallbackPractitionerId) return args.fallbackPractitionerId;
  if (args.allowNone) return null;
  const [{ data: prof }, { data: pracs }] = await Promise.all([
    supabaseAdmin.from("profiles").select("practitioner_selection_mode").eq("id", args.profileId).maybeSingle(),
    supabaseAdmin.from("practitioners").select("id").eq("profile_id", args.profileId).eq("active", true),
  ]);
  const mode = (prof as { practitioner_selection_mode?: string | null } | null)?.practitioner_selection_mode;
  if (mode === "required" && (pracs ?? []).length > 1) {
    throw new Error("Please choose your practitioner before booking.");
  }
  return null;
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
