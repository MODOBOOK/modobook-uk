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
  referrer_credit_pennies: z.number().int().min(0).max(1_000_000),
  referrer_points: z.number().int().min(0).max(100_000),
  friend_credit_pennies: z.number().int().min(0).max(1_000_000),
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
          referrer_credit_pennies: data.referrer_credit_pennies,
          referrer_points: data.referrer_points,
          friend_credit_pennies: data.friend_credit_pennies,
          trigger_event: "completed_paid",
          max_rewarded_per_year: null,
          headline: data.headline ?? null,
          description: data.description ?? null,
        },
        { onConflict: "clinic_profile_id" },
      );
    if (error) throw error;
    return { ok: true };
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
