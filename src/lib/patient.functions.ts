import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Ensure the signed-in user has a patient row; optionally link to a practitioner by slug.
 *  Also merges any prior bookings/records created for this email by a practitioner
 *  (e.g. walk-ins or manually-added clients) into this new patient account. */
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

    // Records are scoped per clinic: only ever link/merge for the clinic the
    // patient is actually signing up with. Having history at clinic A must
    // never surface that patient inside clinic B's portal.
    let linkProfileId: string | null = null;
    if (data.linkSlug) {
      const anon = publicClient();
      const { data: prof } = await anon
        .rpc("get_public_profile_by_slug", { p_slug: data.linkSlug.toLowerCase() })
        .maybeSingle();
      linkProfileId = prof?.id ?? null;
      if (linkProfileId) {
        const { isDemoProfileId } = await import("./demo-guard.server");
        const demoEmail = (email ?? "").toLowerCase().endsWith("@modo.demo");
        if (!demoEmail && (await isDemoProfileId(linkProfileId))) {
          throw new Error(
            "The MODO demo clinic doesn't accept new patient accounts — use the demo patient login at modobook.uk/demo.",
          );
        }
      }
    }

    if (linkProfileId && email) {
      // Backfill patient_user_id on prior bookings this clinic made under this
      // email (walk-ins / manually added clients). Admin client because
      // appointments RLS scopes updates to the owning practitioner.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: appts } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .eq("profile_id", linkProfileId)
        .ilike("patient_email", email)
        .is("patient_user_id", null);
      if (appts && appts.length > 0) {
        await supabaseAdmin
          .from("appointments")
          .update({ patient_user_id: userId })
          .in("id", appts.map((a) => a.id));
      }
    }

    if (linkProfileId) {
      await supabase
        .from("patient_practitioner_links")
        .upsert(
          [{ patient_id: patient.id, profile_id: linkProfileId }],
          { onConflict: "patient_id,profile_id", ignoreDuplicates: true },
        );
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

/** Save patient's own contact/address details so future bookings can prefill. */
export const updateMyPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      full_name?: string;
      email?: string;
      phone?: string;
      date_of_birth?: string | null;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      postcode?: string;
      country?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? null;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && v !== "") patch[k] = v;
    }
    const { data: existing } = await supabase
      .from("patients").select("id").eq("user_id", userId).maybeSingle();
    if (!existing) {
      const { data: created, error } = await supabase
        .from("patients")
        .insert({
          user_id: userId,
          full_name: (patch.full_name as string) || email?.split("@")[0] || "Patient",
          email: (patch.email as string) || email,
          ...patch,
        })
        .select("*").single();
      if (error) throw error;
      return { patient: created };
    }
    const { data: updated, error } = await supabase
      .from("patients")
      .update(patch as never)
      .eq("user_id", userId)
      .select("*").single();
    if (error) throw error;
    return { patient: updated };
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

export const getMyAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("appointments")
      .select(
        "id, scheduled_date, start_time, end_time, status, payment_status, total_amount, notes, practitioner_notes, treatment:treatment_id (name, duration), location:location_id (name, address_line1, city), profile:profile_id (slug, clinic_name, full_name)"
      )
      .eq("patient_user_id", context.userId)
      .order("scheduled_date", { ascending: false })
      .order("start_time", { ascending: false });
    if (error) throw error;
    return { appointments: data ?? [] };
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
      .rpc("get_public_profile_by_slug", { p_slug: data.profileSlug.toLowerCase() })
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

/** Public review submission — no account required. Lands pending moderation. */
export const submitPublicReview = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { profileSlug: string; rating: number; title?: string; body: string; reviewerName: string; reviewerEmail?: string }) => input,
  )
  .handler(async ({ data }) => {
    const rating = Math.round(Number(data.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error("Rating must be 1–5");
    const body = (data.body ?? "").trim();
    const name = (data.reviewerName ?? "").trim();
    if (!body) throw new Error("Please write a review");
    if (body.length > 2000) throw new Error("Review is too long");
    if (!name) throw new Error("Please enter your name");
    if (name.length > 100) throw new Error("Name is too long");

    const anon = publicClient();
    const { data: prof, error: pErr } = await anon
      .rpc("get_public_profile_by_slug", { p_slug: data.profileSlug.toLowerCase() })
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prof) throw new Error("Practitioner not found");

    const { error } = await anon.from("patient_reviews").insert({
      profile_id: prof.id,
      patient_id: null,
      rating,
      title: data.title?.trim() || null,
      body,
      approved: false,
      reviewer_name: name,
      reviewer_email: data.reviewerEmail?.trim() || null,
    });
    if (error) throw error;
    return { ok: true };
  });

/** Practitioner moderation list */
export const listMyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(context.supabase, context.userId))
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

/** Count pending (unapproved) patient-submitted reviews for the signed-in practitioner. */
export const countPendingReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).maybeSingle();
    if (!profile) return { count: 0 };
    const { count, error } = await context.supabase
      .from("patient_reviews")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("approved", false);
    if (error) throw error;
    return { count: count ?? 0 };
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

export const deletePatientReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reviewId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const { error } = await context.supabase
      .from("patient_reviews")
      .delete()
      .eq("id", data.reviewId)
      .eq("profile_id", profile.id);
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
      about_page?: Record<string, unknown>;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    if (data.specialties !== undefined) patch.specialties = data.specialties;
    if (data.qualifications !== undefined) patch.qualifications = data.qualifications;
    if (data.timeline !== undefined) patch.timeline = data.timeline;
    if (data.about_page !== undefined) patch.about_page = data.about_page;

    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", await __activeProfileId(context.supabase, context.userId))
      .select("*")
      .single();
    if (error) throw error;
    return { profile: updated };
  });

/** Practitioner-managed testimonials (manual reviews seeded by the practitioner) */
export const listMyTestimonials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).maybeSingle();
    if (!profile) return { testimonials: [] };
    const { data, error } = await context.supabase
      .from("clinic_testimonials")
      .select("*")
      .eq("profile_id", profile.id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { testimonials: data ?? [] };
  });

export const upsertTestimonial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; author_name: string; quote: string; rating?: number | null; display_order?: number }) => input)
  .handler(async ({ data, context }) => {
    if (!data.author_name.trim()) throw new Error("Patient first name is required");
    if (!data.quote.trim()) throw new Error("Review text is required");
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const payload = {
      profile_id: profile.id,
      author_name: data.author_name.trim(),
      quote: data.quote.trim(),
      rating: data.rating ?? null,
      display_order: data.display_order ?? 0,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("clinic_testimonials").update(payload).eq("id", data.id).eq("profile_id", profile.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    } else {
      const { data: row, error } = await context.supabase
        .from("clinic_testimonials").insert(payload).select("id").single();
      if (error) throw error;
      return { ok: true, id: row.id };
    }
  });

export const deleteTestimonial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const { error } = await context.supabase
      .from("clinic_testimonials").delete().eq("id", data.id).eq("profile_id", profile.id);
    if (error) throw error;
    return { ok: true };
  });

