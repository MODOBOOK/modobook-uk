import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClinicThemeInput = {
  primary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  header_bg_color?: string;
  header_text_color?: string;
  footer_bg_color?: string;
  footer_text_color?: string;
  heading_font?: string;
  body_font?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  hero_image_url?: string | null;
  hero_heading?: string | null;
  hero_subheading?: string | null;
  custom_css?: string | null;
};

async function getProfileId(
  supabase: { from: (table: string) => any },
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export const getMyTheme = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return null;
    const { data } = await context.supabase
      .from("clinic_theme")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();
    return data;
  });

export const upsertMyTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ClinicThemeInput) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await context.supabase
      .from("clinic_theme")
      .upsert({ profile_id: profileId, ...data }, { onConflict: "profile_id" })
      .select()
      .single();
    if (error) throw error;

    // Mirror visible bits onto the public profile so the /m/:slug page reflects them.
    const profileUpdate: { brand_color?: string | null; hero_url?: string | null } = {};
    if (data.primary_color !== undefined) profileUpdate.brand_color = data.primary_color;
    if (data.hero_image_url !== undefined) profileUpdate.hero_url = data.hero_image_url;
    if (Object.keys(profileUpdate).length > 0) {
      await context.supabase.from("profiles").update(profileUpdate).eq("id", profileId);
    }
    return row;
  });
