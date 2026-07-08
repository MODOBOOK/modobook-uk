import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// -------------------- Practitioner: settings --------------------

export const getMyReferralSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("clinic_referral_settings")
      .select("*")
      .eq("clinic_profile_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  });

const SaveSchema = z.object({
  enabled: z.boolean(),
  show_on_public_page: z.boolean().default(false),
  referrer_credit_kind: z.enum(["pennies", "percent"]).default("pennies"),
  referrer_credit_pennies: z.number().int().min(0).max(1_000_000),
  referrer_credit_percent: z.number().int().min(0).max(100),
  referrer_points: z.number().int().min(0).max(100_000),
  friend_credit_kind: z.enum(["pennies", "percent"]).default("pennies"),
  friend_credit_pennies: z.number().int().min(0).max(1_000_000),
  friend_credit_percent: z.number().int().min(0).max(100),
  points_redemption_enabled: z.boolean().default(false),
  points_per_pound_redeem: z.number().int().min(1).max(10_000).default(20),
  earn_on_spend_enabled: z.boolean().default(false),
  points_per_pound_earn: z.number().min(0).max(1000).default(1),
  tiers_enabled: z.boolean().default(false),
  headline: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(600).nullable().optional(),
});

export const saveReferralSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof SaveSchema>) => SaveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("clinic_referral_settings")
      .upsert(
        {
          clinic_profile_id: userId,
          enabled: data.enabled,
          referrer_credit_kind: data.referrer_credit_kind,
          referrer_credit_pennies: data.referrer_credit_pennies,
          referrer_credit_percent: data.referrer_credit_percent,
          referrer_points: data.referrer_points,
          friend_credit_kind: data.friend_credit_kind,
          friend_credit_pennies: data.friend_credit_pennies,
          friend_credit_percent: data.friend_credit_percent,
          points_redemption_enabled: data.points_redemption_enabled,
          points_per_pound_redeem: data.points_per_pound_redeem,
          earn_on_spend_enabled: data.earn_on_spend_enabled,
          points_per_pound_earn: data.points_per_pound_earn,
          tiers_enabled: data.tiers_enabled,
          trigger_event: "completed_paid",
          max_rewarded_per_year: null,
          headline: data.headline ?? null,
          description: data.description ?? null,
        } as never,
        { onConflict: "clinic_profile_id" },
      );
    if (error) throw error;
    return { ok: true };
  });

// -------------------- Practitioner: reward tiers CRUD --------------------

export type RewardTier = {
  id: string;
  label: string;
  points_cost: number;
  reward_kind: "credit_pennies" | "free_addon" | "custom";
  reward_value: number;
  description: string | null;
  enabled: boolean;
  sort_order: number;
};

export const listMyRewardTiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("clinic_reward_tiers")
      .select("*")
      .eq("clinic_profile_id", userId)
      .order("sort_order", { ascending: true })
      .order("points_cost", { ascending: true });
    if (error) throw error;
    return (data ?? []) as RewardTier[];
  });

const TierSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(80),
  points_cost: z.number().int().min(1).max(1_000_000),
  reward_kind: z.enum(["credit_pennies", "free_addon", "custom"]),
  reward_value: z.number().int().min(0).max(1_000_000),
  description: z.string().trim().max(240).nullable().optional(),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const upsertRewardTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof TierSchema>) => TierSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      ...(data.id ? { id: data.id } : {}),
      clinic_profile_id: userId,
      label: data.label,
      points_cost: data.points_cost,
      reward_kind: data.reward_kind,
      reward_value: data.reward_value,
      description: data.description ?? null,
      enabled: data.enabled,
      sort_order: data.sort_order,
    };
    const { error } = await (supabase as any)
      .from("clinic_reward_tiers")
      .upsert(row);
    if (error) throw error;
    return { ok: true };
  });

export const deleteRewardTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("clinic_reward_tiers")
      .delete()
      .eq("id", data.id)
      .eq("clinic_profile_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// -------------------- Practitioner: recent referrals --------------------

export const getMyClinicReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("patient_referrals")
      .select(
        "id, code, status, reward_credit_pennies, reward_points, friend_credit_pennies, rewarded_at, created_at, referred_email, referrer_user_id",
      )
      .eq("clinic_profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

// -------------------- Patient: link a referral code to a booking --------------------

const LinkSchema = z.object({
  appointmentId: z.string().uuid(),
  code: z.string().trim().min(3).max(32),
});

/**
 * Called from the booking success handler when the friend arrived via a
 * share link (sessionStorage `mb_ref_code`). Creates a pending
 * patient_referrals row so the auto-payout trigger can settle it once the
 * appointment is completed and paid. Idempotent per appointment.
 */
export const linkReferralToAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof LinkSchema>) => LinkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.toUpperCase();

    // Resolve code -> referrer + clinic
    const { data: codeRow } = await supabase
      .from("patient_referral_codes")
      .select("patient_user_id, clinic_profile_id")
      .eq("code", code)
      .maybeSingle();
    if (!codeRow) return { ok: false, reason: "unknown_code" };
    if (codeRow.patient_user_id === userId) return { ok: false, reason: "self_referral" };

    // Load appointment for reward context
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, profile_id, patient_email, patient_user_id")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appt) return { ok: false, reason: "no_appointment" };

    // Get clinic settings snapshot for rewards
    const { data: settings } = await supabase
      .from("clinic_referral_settings")
      .select("enabled, referrer_credit_pennies, referrer_points, friend_credit_pennies")
      .eq("clinic_profile_id", codeRow.clinic_profile_id)
      .maybeSingle();
    if (!settings?.enabled) return { ok: false, reason: "program_off" };

    // Idempotent: skip if this appointment already has a referral row
    const { data: existing } = await supabase
      .from("patient_referrals")
      .select("id")
      .eq("referred_appointment_id", data.appointmentId)
      .maybeSingle();
    if (existing) return { ok: true, referralId: existing.id, deduped: true };

    const { data: inserted, error: insErr } = await supabase
      .from("patient_referrals")
      .insert({
        referrer_user_id: codeRow.patient_user_id,
        clinic_profile_id: codeRow.clinic_profile_id,
        code,
        referred_appointment_id: data.appointmentId,
        referred_email: appt.patient_email ?? null,
        status: "booked",
        reward_credit_pennies: settings.referrer_credit_pennies ?? 0,
        reward_points: settings.referrer_points ?? 0,
        friend_credit_pennies: settings.friend_credit_pennies ?? 0,
      })
      .select("id")
      .maybeSingle();
    if (insErr) throw insErr;
    return { ok: true, referralId: inserted?.id };
  });

// -------------------- Patient: my rewards at a clinic --------------------

const SlugSchema = z.object({ slug: z.string().trim().min(1).max(120) });

/**
 * Returns the patient's rewards view for a given clinic slug:
 * clinic settings, patient's referral code (creating one if needed),
 * credit + points balances, and referral history.
 */
export const getMyRewardsForClinic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof SlugSchema>) => SlugSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, clinic_name, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (profErr) throw profErr;
    if (!profile) throw new Error("Clinic not found");
    const clinicProfileId = profile.user_id as string;

    const { data: settings } = await supabase
      .from("clinic_referral_settings")
      .select("*")
      .eq("clinic_profile_id", clinicProfileId)
      .maybeSingle();

    // Ensure a code exists for this patient at this clinic.
    let { data: codeRow } = await supabase
      .from("patient_referral_codes")
      .select("code")
      .eq("patient_user_id", userId)
      .eq("clinic_profile_id", clinicProfileId)
      .maybeSingle();

    if (!codeRow) {
      // 6-char base32-ish code; retry on collision.
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = Array.from({ length: 6 }, () =>
          alphabet.charAt(Math.floor(Math.random() * alphabet.length)),
        ).join("");
        const { data: inserted, error: insErr } = await supabase
          .from("patient_referral_codes")
          .insert({
            patient_user_id: userId,
            clinic_profile_id: clinicProfileId,
            code,
          })
          .select("code")
          .maybeSingle();
        if (!insErr && inserted) {
          codeRow = inserted;
          break;
        }
      }
    }

    const [{ data: creditRows }, { data: pointsRows }, { data: referrals }] =
      await Promise.all([
        supabase
          .from("patient_credit_ledger")
          .select("delta_pennies")
          .eq("patient_user_id", userId)
          .eq("clinic_profile_id", clinicProfileId),
        supabase
          .from("patient_points_ledger")
          .select("delta")
          .eq("patient_user_id", userId)
          .eq("clinic_profile_id", clinicProfileId),
        supabase
          .from("patient_referrals")
          .select(
            "id, code, status, reward_credit_pennies, reward_points, friend_credit_pennies, rewarded_at, created_at",
          )
          .eq("referrer_user_id", userId)
          .eq("clinic_profile_id", clinicProfileId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    const creditPennies = (creditRows ?? []).reduce(
      (sum, r) => sum + (r.delta_pennies ?? 0),
      0,
    );
    const points = (pointsRows ?? []).reduce((sum, r) => sum + (r.delta ?? 0), 0);

    return {
      clinic: {
        slug: profile.slug,
        name: profile.clinic_name ?? profile.full_name ?? "Clinic",
      },
      settings: settings ?? null,
      code: codeRow?.code ?? null,
      creditPennies,
      points,
      referrals: referrals ?? [],
    };
  });

// -------------------- Public: resolve a share code --------------------

/**
 * Anonymous lookup — resolves a share code to the clinic slug so the
 * public /r/$code page can redirect. Uses the anon SELECT policy on
 * patient_referral_codes.
 */
export const resolveReferralCode = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) =>
    z.object({ code: z.string().trim().min(3).max(32) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabasePublic = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: row, error } = await supabasePublic
      .from("patient_referral_codes")
      .select("clinic_profile_id")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!row) return { slug: null, friendCreditPennies: 0, headline: null };

    const [{ data: prof }, { data: settings }] = await Promise.all([
      supabasePublic
        .from("profiles")
        .select("slug, clinic_name, full_name")
        .eq("user_id", row.clinic_profile_id)
        .maybeSingle(),
      supabasePublic
        .from("clinic_referral_settings")
        .select("enabled, friend_credit_pennies, headline")
        .eq("clinic_profile_id", row.clinic_profile_id)
        .maybeSingle(),
    ]);

    if (!prof?.slug || !settings?.enabled) {
      return { slug: null, friendCreditPennies: 0, headline: null };
    }
    return {
      slug: prof.slug,
      clinicName: prof.clinic_name ?? prof.full_name ?? "Clinic",
      friendCreditPennies: settings.friend_credit_pennies ?? 0,
      headline: settings.headline ?? null,
    };
  });
