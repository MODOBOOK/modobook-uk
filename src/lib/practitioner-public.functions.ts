import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

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

    const [theme, aboutRpc, locations] = await Promise.all([
      supabase.from("clinic_theme").select("*").eq("profile_id", profile.id).maybeSingle(),
      supabase.rpc("get_about_page_by_slug", { p_slug: data.slug.toLowerCase() }),
      supabase
        .from("locations")
        .select("id, name, address_line1, address_line2, city, postcode, country, is_primary, display_order, image_url")
        .eq("profile_id", profile.id)
        .eq("active", true)
        .eq("is_public", true)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    return {
      profile,
      theme: theme.data ?? null,
      aboutPage: (aboutRpc.data as Json) ?? ({} as Json),
      locations: locations.data ?? [],
    };
  });

export const getPractitionerReviews = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) throw new Error("Practitioner not found");

    const { data: patientReviews } = await supabase
      .rpc("get_public_patient_reviews", { p_profile_id: profile.id });

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
