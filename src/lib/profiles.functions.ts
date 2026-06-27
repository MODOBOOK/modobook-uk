import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

function getServerSupabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ?? null;
  });

export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      full_name: string;
      clinic_name: string;
      slug: string;
      tagline?: string;
      about?: string;
      bio?: string;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
      brand_color?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        full_name: data.full_name,
        clinic_name: data.clinic_name,
        slug,
        tagline: data.tagline,
        about: data.about,
        bio: data.bio,
        phone: data.phone,
        email: data.email ?? (context.claims.email as string | undefined),
        address: data.address,
        brand_color: data.brand_color,
        active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return profile;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      full_name?: string;
      clinic_name?: string;
      slug?: string;
      tagline?: string;
      about?: string;
      bio?: string;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
      hero_url?: string;
      brand_color?: string;
      social_links?: Record<string, string>;
      active?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const update: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (data.full_name !== undefined) update.full_name = data.full_name;
    if (data.clinic_name !== undefined) update.clinic_name = data.clinic_name;
    if (data.slug !== undefined) update.slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (data.tagline !== undefined) update.tagline = data.tagline;
    if (data.about !== undefined) update.about = data.about;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.email !== undefined) update.email = data.email;
    if (data.address !== undefined) update.address = data.address as Json;
    if (data.hero_url !== undefined) update.hero_url = data.hero_url;
    if (data.brand_color !== undefined) update.brand_color = data.brand_color;
    if (data.social_links !== undefined) update.social_links = data.social_links as Json;
    if (data.active !== undefined) update.active = data.active;

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return profile;
  });

export const getProfileBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: profile, error } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (error) throw error;
    return profile;
  });

export const checkSlugAvailable = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; excludeOwn?: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: available, error } = await supabase.rpc("is_slug_available", {
      p_slug: data.slug.toLowerCase(),
      p_exclude_id: data.excludeOwn,
    });
    if (error) throw error;
    return { available: !!available };
  });

export const updateStripeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { accountId: string; status?: string; chargesEnabled?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        stripe_connect_account_id: data.accountId,
        stripe_connect_onboarding_status: data.status ?? "pending",
      })
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return profile;
  });
