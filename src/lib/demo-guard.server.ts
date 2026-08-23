// Server-only guards that stop the shared public demo clinic from being used
// to hand anyone real access to MODO (staff invites, prescriber hub links,
// patient accounts attached to the demo clinic, etc).
//
// Do NOT import at module scope from routes or *.functions.ts — load inside
// handlers with `await import("./demo-guard.server")`.

export const DEMO_BLOCKED_MESSAGE =
  "This action is disabled in the MODO demo clinic. Start a free trial to invite people to a real clinic.";

/** True when the given profile id is the shared demo clinic. */
export async function isDemoProfileId(profileId: string | null | undefined): Promise<boolean> {
  if (!profileId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_demo")
    .eq("id", profileId)
    .maybeSingle();
  return Boolean((data as { is_demo?: boolean } | null)?.is_demo);
}

/** True when the signed-in user owns (or is staff of) the demo clinic. */
export async function isDemoUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("is_demo")
    .eq("user_id", userId)
    .maybeSingle();
  if ((prof as { is_demo?: boolean } | null)?.is_demo) return true;
  const { data: staff } = await supabaseAdmin
    .from("staff_members")
    .select("profile_id, profiles!inner(is_demo)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return Boolean((staff as any)?.profiles?.is_demo);
}

/** Throws when the profile is the demo clinic. */
export async function assertNotDemoProfile(
  profileId: string | null | undefined,
  message: string = DEMO_BLOCKED_MESSAGE,
): Promise<void> {
  if (await isDemoProfileId(profileId)) throw new Error(message);
}

/** Throws when the signed-in user is inside the demo clinic. */
export async function assertNotDemoUser(
  userId: string | null | undefined,
  message: string = DEMO_BLOCKED_MESSAGE,
): Promise<void> {
  if (await isDemoUser(userId)) throw new Error(message);
}

/**
 * Demo/tour sessions must never be able to leave a real booking on a real
 * clinic's calendar. Any patient email in the reserved @modo.demo space is
 * only allowed to book against the demo clinic itself.
 */
export async function assertNotDemoPatientBooking(
  profileId: string | null | undefined,
  patientEmail: string | null | undefined,
): Promise<void> {
  const email = (patientEmail ?? "").trim().toLowerCase();
  if (!email.endsWith("@modo.demo")) return;
  if (await isDemoProfileId(profileId)) return;
  throw new Error(
    "Demo accounts can only book inside the MODO demo clinic. Start a free trial to take real bookings.",
  );
}
