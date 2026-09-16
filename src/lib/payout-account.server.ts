/**
 * Which Stripe account actually took the money for an appointment.
 *
 * Booking payments are created on the clinic owner's connected account, EXCEPT
 * when the treating practitioner is a team member whose payouts are set to
 * "their own account" and they have connected one — then the charge lives on
 * that team member's account.
 *
 * Refunds must be issued on the same account the charge lives on, otherwise
 * Stripe cannot find the payment. Use this helper anywhere a refund (or any
 * other action against an existing charge) is performed.
 */
export async function payoutAccountForAppointment(args: {
  profileId: string;
  practitionerId?: string | null;
  clinicAccountId?: string | null;
}): Promise<string | null> {
  const fallback = args.clinicAccountId ?? null;
  if (!args.practitionerId) return fallback;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("staff_members")
      .select("payout_mode, stripe_account_id")
      .eq("profile_id", args.profileId)
      .eq("practitioner_id", args.practitionerId)
      .maybeSingle();
    const staff = data as { payout_mode?: string | null; stripe_account_id?: string | null } | null;
    if (staff?.payout_mode === "own_account" && staff.stripe_account_id) {
      return staff.stripe_account_id;
    }
  } catch (e) {
    console.error("[payoutAccountForAppointment] lookup failed", e);
  }
  return fallback;
}
