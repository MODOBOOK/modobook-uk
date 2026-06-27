import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getPractitionerBio = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: profile, error } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .maybeSingle();
    if (error) throw error;
    if (!profile) throw new Error("Practitioner not found");
    return { profile };
  });

export const getPractitionerReviews = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, slug, clinic_name, full_name, brand_color, active")
      .eq("slug", data.slug.toLowerCase())
      .eq("active", true)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) throw new Error("Practitioner not found");

    const { data: patientReviews } = await supabase
      .from("patient_reviews")
      .select("id, rating, title, body, created_at, patient_id")
      .eq("profile_id", profile.id)
      .eq("approved", true)
      .order("created_at", { ascending: false });

    const { data: testimonials } = await supabase
      .from("clinic_testimonials")
      .select("id, author_name, quote, rating, created_at")
      .eq("profile_id", profile.id)
      .order("display_order", { ascending: true });

    return {
      profile,
      patientReviews: patientReviews ?? [],
      testimonials: testimonials ?? [],
    };
  });
