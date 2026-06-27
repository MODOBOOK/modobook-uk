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
      .from("profiles")
      .select("*")
      .eq("slug", data.slug.toLowerCase())
      .eq("active", true)
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
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });
    if (locationsError) throw locationsError;

    return {
      profile,
      treatments: treatments ?? [],
      packages: packages ?? [],
      gallery: gallery ?? [],
      testimonials: testimonials ?? [],
      locations: locations ?? [],
    };
  });
