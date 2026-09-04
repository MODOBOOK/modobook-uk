import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Practitioner-to-practitioner referrals.
 *
 * Each practitioner gets one personal code. A new practitioner who redeems it
 * on Plan & billing gets 25% off their first 3 months; once they start paying,
 * the referrer banks one month at 50% off (one banked month per referral).
 */

const JOINER_DISCOUNT_LABEL = "25% off their first 3 months";
const REFERRER_REWARD_LABEL = "50% off one month of your MODO plan";

async function myProfile(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, slug, clinic_name")
    .eq("user_id", context.userId)
    .single();
  if (error) throw error;
  return data as { id: string; slug: string | null; clinic_name: string | null };
}

/** Everything the referrals page needs: the code, the signups and the rewards. */
export const getMyReferralProgramme = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await myProfile(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: rpcErr } = await supabaseAdmin.rpc(
      "ensure_practitioner_referral_code" as never,
      { _profile_id: profile.id } as never,
    );
    if (rpcErr) throw rpcErr;
    const row = (Array.isArray(created) ? created[0] : created) as
      | { code: string; discount_code_id: string | null }
      | null;

    const { data: codeRow } = await supabaseAdmin
      .from("practitioner_referral_codes")
      .select("id, code, active")
      .eq("owner_profile_id", profile.id)
      .maybeSingle();

    const { data: signups } = await supabaseAdmin
      .from("practitioner_referral_signups")
      .select("id, status, created_at, qualified_at, referred_profile_id")
      .eq("referral_code_id", (codeRow as { id: string } | null)?.id ?? "")
      .order("created_at", { ascending: false });

    const list = (signups ?? []) as {
      id: string;
      status: string;
      created_at: string;
      qualified_at: string | null;
      referred_profile_id: string;
    }[];

    // Names of the clinics that joined, so the list reads like people not ids.
    let names: Record<string, string> = {};
    if (list.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, clinic_name, full_name")
        .in("id", list.map((s) => s.referred_profile_id));
      names = Object.fromEntries(
        ((profs ?? []) as { id: string; clinic_name: string | null; full_name: string | null }[]).map((p) => [
          p.id,
          p.clinic_name || p.full_name || "New practitioner",
        ]),
      );
    }

    const { data: sub } = await supabaseAdmin
      .from("practitioner_subscriptions")
      .select("referral_reward_months_remaining, referral_reward_months_earned")
      .eq("profile_id", profile.id)
      .maybeSingle();

    return {
      code: (codeRow as { code: string } | null)?.code ?? row?.code ?? null,
      active: (codeRow as { active: boolean } | null)?.active ?? true,
      joinerOffer: JOINER_DISCOUNT_LABEL,
      referrerReward: REFERRER_REWARD_LABEL,
      signups: list.map((s) => ({
        id: s.id,
        name: names[s.referred_profile_id] ?? "New practitioner",
        status: s.status,
        joinedAt: s.created_at,
        qualifiedAt: s.qualified_at,
      })),
      rewardMonthsRemaining: Number((sub as any)?.referral_reward_months_remaining ?? 0),
      rewardMonthsEarned: Number((sub as any)?.referral_reward_months_earned ?? 0),
    };
  });

/**
 * Called after a practitioner redeems a code on Plan & billing. If the code was
 * a practitioner referral code, the signup is recorded against the referrer.
 */
export const linkReferralRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { discountCodeId: string }) => i)
  .handler(async ({ data, context }) => {
    const profile = await myProfile(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok, error } = await supabaseAdmin.rpc(
      "record_practitioner_referral" as never,
      { _referred_profile_id: profile.id, _discount_code_id: data.discountCodeId } as never,
    );
    if (error) throw error;
    return { linked: Boolean(ok) };
  });

/**
 * Marks a referral successful once the referred practitioner starts paying —
 * called from the billing webhook / activation path.
 */
export async function qualifyReferralForProfile(profileId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc(
    "qualify_practitioner_referral" as never,
    { _referred_profile_id: profileId } as never,
  );
  if (error) console.error("[referrals] qualify failed", error.message);
}
