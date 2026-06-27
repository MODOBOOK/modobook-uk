import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getServerSupabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

export const getPublicClinic = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: profile, error: profileError } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (profileError) throw profileError;
    if (!profile) throw new Error("Clinic not found");

    const { data: treatments, error: treatmentError } = await supabase
      .from("treatments")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (treatmentError) throw treatmentError;

    const { data: packages, error: packageError } = await supabase
      .from("packages")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (packageError) throw packageError;

    const { data: gallery, error: galleryError } = await supabase
      .from("clinic_gallery")
      .select("*")
      .eq("profile_id", profile.id)
      .order("display_order", { ascending: true });
    if (galleryError) throw galleryError;

    const { data: testimonials, error: testimonialError } = await supabase
      .from("clinic_testimonials")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });
    if (testimonialError) throw testimonialError;

    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("id, profile_id, name, address_line1, address_line2, city, postcode, country, is_primary, display_order, active, created_at, updated_at, image_url")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });
    if (locationsError) throw locationsError;

    const { data: categories } = await supabase
      .from("treatment_categories")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const treatmentIds = (treatments ?? []).map((t) => t.id);
    const { data: pricing } = treatmentIds.length
      ? await supabase
          .from("treatment_location_pricing")
          .select("*")
          .in("treatment_id", treatmentIds)
          .eq("available", true)
      : { data: [] as never[] };

    const { data: theme } = await supabase
      .from("clinic_theme")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    return {
      profile,
      treatments: treatments ?? [],
      packages: packages ?? [],
      gallery: gallery ?? [],
      testimonials: testimonials ?? [],
      locations: locations ?? [],
      categories: categories ?? [],
      pricing: pricing ?? [],
      theme: theme ?? null,
    };
  });
