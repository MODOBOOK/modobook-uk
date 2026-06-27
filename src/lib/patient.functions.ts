import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Ensure the signed-in user has a patient row; optionally link to a practitioner by slug. */
export const ensurePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; phone?: string; linkSlug?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? null;

    let { data: patient, error } = await supabase
      .from("patients")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    if (!patient) {
      const { data: created, error: insErr } = await supabase
        .from("patients")
        .insert({ user_id: userId, full_name: data.fullName, email, phone: data.phone ?? null })
        .select("*")
        .single();
      if (insErr) throw insErr;
      patient = created;
    }

    if (data.linkSlug) {
      const anon = publicClient();
      const { data: prof } = await anon
        .rpc("get_public_profile_by_slug", { p_slug: data.linkSlug.toLowerCase() })
        .maybeSingle();
      if (prof) {
        await supabase
          .from("patient_practitioner_links")
          .insert({ patient_id: patient.id, profile_id: prof.id })
          .select()
          .maybeSingle();
        // ignore unique-violation errors silently
      }
    }
    return { patient };
  });

export const getMyPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patients")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return { patient: data };
  });

export const getMyPatientLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: patient } = await context.supabase
      .from("patients")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!patient) return { links: [] };

    const { data, error } = await context.supabase
      .from("patient_practitioner_links")
      .select("profile_id, created_at, profiles:profile_id (id, slug, clinic_name, full_name, avatar_url, brand_color)")
      .eq("patient_id", patient.id);
    if (error) throw error;
    return { links: data ?? [] };
  });

export const submitPatientReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { profileSlug: string; rating: number; title?: string; body: string }) => input,
  )
  .handler(async ({ data, context }) => {
    if (data.rating < 1 || data.rating > 5) throw new Error("Rating must be 1–5");
    if (!data.body.trim()) throw new Error("Review body required");

    const anon = publicClient();
    const { data: prof, error: pErr } = await anon
      .from("profiles")
      .select("id")
      .eq("slug", data.profileSlug.toLowerCase())
      .eq("active", true)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prof) throw new Error("Practitioner not found");

    const { data: patient } = await context.supabase
      .from("patients")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!patient) throw new Error("Create a patient account first");

    const { data: review, error } = await context.supabase
      .from("patient_reviews")
      .insert({
        profile_id: prof.id,
        patient_id: patient.id,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { review };
  });

/** Practitioner moderation list */
export const listMyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return { reviews: [] };
    const { data, error } = await context.supabase
      .from("patient_reviews")
      .select("*, patients:patient_id (full_name)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { reviews: data ?? [] };
  });

export const setReviewApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reviewId: string; approved: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("patient_reviews")
      .update({ approved: data.approved })
      .eq("id", data.reviewId);
    if (error) throw error;
    return { ok: true };
  });

export const updatePractitionerBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      bio?: string;
      avatar_url?: string;
      specialties?: string[];
      qualifications?: { label: string; year?: string }[];
      timeline?: { year: string; label: string }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    if (data.specialties !== undefined) patch.specialties = data.specialties;
    if (data.qualifications !== undefined) patch.qualifications = data.qualifications;
    if (data.timeline !== undefined) patch.timeline = data.timeline;

    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update(patch as never)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw error;
    return { profile: updated };
  });
