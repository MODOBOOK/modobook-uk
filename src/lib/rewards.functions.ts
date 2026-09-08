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
          show_on_public_page: data.show_on_public_page,
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

    // A referral code only works at the clinic the referrer is registered with.
    const { data: apptClinic } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", appt.profile_id)
      .maybeSingle();
    if (!apptClinic || apptClinic.user_id !== codeRow.clinic_profile_id) {
      return { ok: false, reason: "wrong_clinic" };
    }

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
        supabase.rpc("get_my_referrals", {
          p_clinic_profile_id: clinicProfileId,
        }),

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

// -------------------- Patient: redeem points via own code at booking --------------------

const PointsPreviewSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  code: z.string().trim().min(3).max(32),
  totalPennies: z.number().int().min(0).max(10_000_000),
});

/**
 * Signed-in patient enters their own referral code at checkout to redeem
 * their points balance as £ off. Returns the pennies discount plus the
 * points that would be spent — the caller applies them like a fixed
 * discount and calls consumePointsRedemption after the appointment is
 * created.
 */
export const previewPointsRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof PointsPreviewSchema>) => PointsPreviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.toUpperCase();

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) return { ok: false as const, reason: "clinic_not_found" };
    const clinicProfileId = profile.user_id as string;

    const { data: codeRow } = await supabase
      .from("patient_referral_codes")
      .select("patient_user_id, clinic_profile_id")
      .eq("code", code)
      .maybeSingle();
    if (!codeRow) return { ok: false as const, reason: "unknown_code" };
    if (codeRow.clinic_profile_id !== clinicProfileId)
      return { ok: false as const, reason: "wrong_clinic" };
    if (codeRow.patient_user_id !== userId)
      return { ok: false as const, reason: "not_your_code" };

    const { data: settings } = await supabase
      .from("clinic_referral_settings")
      .select("enabled, points_redemption_enabled, points_per_pound_redeem")
      .eq("clinic_profile_id", clinicProfileId)
      .maybeSingle();
    if (!settings?.enabled) return { ok: false as const, reason: "program_off" };
    if (!settings.points_redemption_enabled)
      return { ok: false as const, reason: "redemption_off" };
    const ppp = Number(settings.points_per_pound_redeem ?? 0);
    if (!ppp || ppp <= 0) return { ok: false as const, reason: "redemption_off" };

    const { data: pointsRows } = await supabase
      .from("patient_points_ledger")
      .select("delta")
      .eq("patient_user_id", userId)
      .eq("clinic_profile_id", clinicProfileId);
    const balance = (pointsRows ?? []).reduce((s, r) => s + (r.delta ?? 0), 0);
    if (balance <= 0) return { ok: false as const, reason: "no_points" };

    // Cap the redemption to the current cart total.
    const maxPoundsFromPoints = Math.floor(balance / ppp);
    const maxPenniesFromPoints = maxPoundsFromPoints * 100;
    const pennies = Math.max(0, Math.min(maxPenniesFromPoints, data.totalPennies));
    if (pennies <= 0) return { ok: false as const, reason: "no_points" };
    const pointsToUse = Math.ceil(pennies / 100) * ppp;

    return {
      ok: true as const,
      code,
      pennies,
      pointsToUse,
      pointsBalance: balance,
      pointsPerPound: ppp,
    };
  });

const PointsConsumeSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  code: z.string().trim().min(3).max(32),
  appointmentId: z.string().uuid(),
  pointsToUse: z.number().int().min(1).max(10_000_000),
});

/**
 * Deducts the redeemed points from the patient's ledger after the
 * appointment row exists. Idempotent per appointment.
 */
export const consumePointsRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof PointsConsumeSchema>) => PointsConsumeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) return { ok: false, reason: "clinic_not_found" as const };
    const clinicProfileId = profile.user_id as string;

    const { data: codeRow } = await supabase
      .from("patient_referral_codes")
      .select("patient_user_id, clinic_profile_id")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!codeRow || codeRow.patient_user_id !== userId || codeRow.clinic_profile_id !== clinicProfileId) {
      return { ok: false, reason: "not_your_code" as const };
    }

    // Idempotency: skip if we've already recorded a redeem for this appointment.
    const { data: existing } = await supabase
      .from("patient_points_ledger")
      .select("id")
      .eq("patient_user_id", userId)
      .eq("clinic_profile_id", clinicProfileId)
      .eq("ref_type", "appointment")
      .eq("ref_id", data.appointmentId)
      .eq("reason", "redeem")
      .maybeSingle();
    if (existing) return { ok: true, deduped: true };

    const { error } = await supabase.from("patient_points_ledger").insert({
      patient_user_id: userId,
      clinic_profile_id: clinicProfileId,
      delta: -Math.abs(data.pointsToUse),
      reason: "redeem",
      ref_type: "appointment",
      ref_id: data.appointmentId,
      note: `Redeemed with code ${data.code.toUpperCase()}`,
    });
    if (error) throw error;
    return { ok: true };
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
    const { data: rows, error } = await (supabasePublic as any).rpc("resolve_referral_code", {
      _code: data.code.toUpperCase(),
    });
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.slug || !row.enabled) {
      return { slug: null, friendCreditPennies: 0, headline: null };
    }
    return {
      slug: row.slug as string,
      clinicName: (row.clinic_name ?? row.full_name ?? "Clinic") as string,
      friendCreditPennies: (row.friend_credit_pennies ?? 0) as number,
      headline: (row.headline ?? null) as string | null,
    };
  });


// -------------------- Public: rewards overview for a clinic's public page --------------------

/**
 * Anonymous read used by the public /m/$slug page and the /m/$slug/rewards
 * marketing view. Returns settings + reward tiers ONLY when the practitioner
 * has both enabled the programme AND opted to show it publicly.
 */
export const getPublicRewardsOverview = createServerFn({ method: "GET" })
  .inputValidator((data: z.infer<typeof SlugSchema>) => SlugSchema.parse(data))
  .handler(async ({ data }) => {
    const supabasePublic = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: rows } = await (supabasePublic as any).rpc("get_public_rewards_by_slug", {
      p_slug: data.slug,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.settings) return { visible: false as const };

    return {
      visible: true as const,
      clinic: {
        slug: row.slug as string,
        name: (row.clinic_name ?? "Clinic") as string,
      },
      settings: row.settings,
      tiers: ((row.tiers ?? []) as RewardTier[]),
    };
  });



// -------------------- Practitioner: manage a patient's points balance --------------------

const ClientIdSchema = z.object({ clientId: z.string().uuid() });

/**
 * Resolves the linked patient account user id for one of the clinic's
 * client records, plus the current points balance and recent ledger.
 */
export const getClientPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof ClientIdSchema>) => ClientIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: account } = await supabase
      .from("patient_accounts")
      .select("user_id")
      .eq("client_id", data.clientId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from("clinic_referral_settings")
      .select("enabled, points_redemption_enabled, points_per_pound_redeem, points_per_pound_earn, earn_on_spend_enabled")
      .eq("clinic_profile_id", userId)
      .maybeSingle();

    if (!account?.user_id) {
      return { linked: false as const, balance: 0, entries: [], settings: settings ?? null };
    }

    const { data: rows } = await supabase
      .from("patient_points_ledger")
      .select("id, delta, reason, note, created_at")
      .eq("patient_user_id", account.user_id)
      .eq("clinic_profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: allRows } = await supabase
      .from("patient_points_ledger")
      .select("delta")
      .eq("patient_user_id", account.user_id)
      .eq("clinic_profile_id", userId);

    return {
      linked: true as const,
      balance: (allRows ?? []).reduce((s, r) => s + (r.delta ?? 0), 0),
      entries: rows ?? [],
      settings: settings ?? null,
    };
  });

const AdjustPointsSchema = z.object({
  clientId: z.string().uuid(),
  delta: z.number().int().min(-1_000_000).max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

/** Manually add or remove loyalty points for one of the clinic's patients. */
export const adjustClientPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof AdjustPointsSchema>) => AdjustPointsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.delta === 0) return { ok: false as const, reason: "zero" };

    const { data: account } = await supabase
      .from("patient_accounts")
      .select("user_id")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!account?.user_id) return { ok: false as const, reason: "not_linked" };

    const { error } = await supabase.from("patient_points_ledger").insert({
      patient_user_id: account.user_id,
      clinic_profile_id: userId,
      delta: data.delta,
      reason: "manual",
      note: data.note || (data.delta > 0 ? "Added by clinic" : "Removed by clinic"),
    });
    if (error) throw error;
    return { ok: true as const };
  });
