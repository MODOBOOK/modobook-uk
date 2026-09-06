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
  hero_use_logo?: boolean;
  hero_text_color?: string | null;
  custom_css?: string | null;
  // Booking menu styling
  menu_card_bg?: string | null;
  menu_card_border_color?: string | null;
  menu_category_bg?: string | null;
  menu_category_text?: string | null;
  menu_treatment_name_color?: string | null;
  menu_price_color?: string | null;
  menu_treatment_size?: string | null;
  menu_treatment_bold?: boolean | null;
  menu_category_bold?: boolean | null;
  // Style preset, booking layout, and hero carousel
  preset_key?: string | null;
  layout_key?: string | null;
  hero_carousel_enabled?: boolean | null;
  hero_carousel_urls?: string[] | null;
  // Welcome card show/hide and shape
  welcome_card_show_logo?: boolean;
  welcome_card_show_name?: boolean;
  welcome_card_show_tagline?: boolean;
  welcome_card_show_rating?: boolean;
  welcome_card_show_actions?: boolean;
  welcome_card_show_contact?: boolean;
  welcome_card_show_sms?: boolean;
  welcome_card_show_whatsapp?: boolean;
  welcome_card_show_instagram?: boolean;
  welcome_card_show_facebook?: boolean;
  welcome_card_size?: string;
  welcome_card_mobile_size?: string;
  welcome_card_position?: string;
  welcome_card_background_type?: string;
  welcome_card_bg_color?: string | null;
  welcome_card_gradient_from?: string | null;
  welcome_card_gradient_to?: string | null;
  welcome_card_border_color?: string | null;
  welcome_card_border_radius?: string | null;
  welcome_card_border_width?: string | null;
  welcome_card_padding?: string | null;
  welcome_card_shadow?: string | null;
  welcome_card_opacity?: number;
  welcome_card_blur?: number;
  // Header
  header_sticky?: boolean;
  header_logo_size?: string;
  header_show_name?: boolean;
  header_show_tagline?: boolean;
  header_button_label?: string;
  // Hero
  hero_height?: string;
  hero_fit?: string;
  hero_overlay_opacity?: number;
  hero_overlay_color?: string;
  hero_text_alignment?: string;
  hero_show_text?: boolean;
  // Buttons
  button_color?: string | null;
  button_text_color?: string;
  button_radius?: string;
  button_size?: string;
  button_uppercase?: boolean;
  // Density
  page_density?: string;
  section_gap?: string;
  // Custom link button (e.g. skincare store)
  link_button_enabled?: boolean;
  link_button_label?: string | null;
  link_button_subtitle?: string | null;
  link_button_url?: string | null;
  // Contact tiles
  contact_tile_layout?: string;
  contact_tile_icon_size?: string;
  contact_tile_bg_color?: string | null;
  contact_tile_border_color?: string | null;
  // Practitioner workspace only (never rendered on the patient booking page)
  dashboard_follow_brand?: boolean;
  dashboard_palette?: string | null;
  dashboard_heading_font?: string | null;
  dashboard_body_font?: string | null;
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

    // Sanitize practitioner-controlled fields that end up rendered inside a
    // <style> element on the public /m/:slug page.
    const sanitized: ClinicThemeInput = { ...data };
    if (typeof sanitized.heading_font === "string") {
      sanitized.heading_font = sanitized.heading_font
        .replace(/[^a-zA-Z0-9\s\-_,'"]/g, "")
        .slice(0, 80);
    }
    if (typeof sanitized.custom_css === "string") {
      sanitized.custom_css = sanitized.custom_css
        .replace(/<\/?\s*style\b[^>]*>/gi, "")
        .replace(/<\/?\s*script\b[^>]*>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .slice(0, 20000);
    }

    if (typeof sanitized.link_button_url === "string") {
      const raw = sanitized.link_button_url.trim();
      if (!raw) sanitized.link_button_url = null;
      else if (/^https?:\/\//i.test(raw)) sanitized.link_button_url = raw.slice(0, 500);
      else sanitized.link_button_url = `https://${raw.replace(/^\/+/, "")}`.slice(0, 500);
    }
    if (typeof sanitized.link_button_label === "string") sanitized.link_button_label = sanitized.link_button_label.slice(0, 60);
    if (typeof sanitized.link_button_subtitle === "string") sanitized.link_button_subtitle = sanitized.link_button_subtitle.slice(0, 120);

    const { data: row, error } = await context.supabase
      .from("clinic_theme")
      .upsert({ profile_id: profileId, ...sanitized }, { onConflict: "profile_id" })
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

// ---------------------------------------------------------------------------
// Draft design studio: practitioners edit a private copy of their branding and
// only push it to the live booking page when they hit Publish.
// ---------------------------------------------------------------------------

function sanitizeTheme(data: ClinicThemeInput): ClinicThemeInput {
  const sanitized: ClinicThemeInput = { ...data };
  if (typeof sanitized.heading_font === "string") {
    sanitized.heading_font = sanitized.heading_font.replace(/[^a-zA-Z0-9\s\-_,'"]/g, "").slice(0, 80);
  }
  if (typeof sanitized.body_font === "string") {
    sanitized.body_font = sanitized.body_font.replace(/[^a-zA-Z0-9\s\-_,'"]/g, "").slice(0, 80);
  }
  if (typeof sanitized.custom_css === "string") {
    sanitized.custom_css = sanitized.custom_css
      .replace(/<\/?\s*style\b[^>]*>/gi, "")
      .replace(/<\/?\s*script\b[^>]*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .slice(0, 20000);
  }
  if (typeof sanitized.link_button_url === "string") {
    const raw = sanitized.link_button_url.trim();
    if (!raw) sanitized.link_button_url = null;
    else if (/^https?:\/\//i.test(raw)) sanitized.link_button_url = raw.slice(0, 500);
    else sanitized.link_button_url = `https://${raw.replace(/^\/+/, "")}`.slice(0, 500);
  }
  return sanitized;
}

/** Save the in-progress design without touching the public booking page. */
export const saveThemeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ClinicThemeInput) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await context.supabase
      .from("clinic_theme")
      .upsert(
        {
          profile_id: profileId,
          draft: sanitizeTheme(data) as unknown as never,
          draft_updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

/** Push the saved draft onto the live booking page and clear it. */
export const publishThemeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: existing } = await context.supabase
      .from("clinic_theme")
      .select("draft")
      .eq("profile_id", profileId)
      .maybeSingle();
    const draft = (existing?.draft ?? null) as ClinicThemeInput | null;
    if (!draft) throw new Error("Nothing to publish yet");

    const sanitized = sanitizeTheme(draft);
    const { data: row, error } = await context.supabase
      .from("clinic_theme")
      .upsert(
        { profile_id: profileId, ...sanitized, draft: null, draft_updated_at: null },
        { onConflict: "profile_id" },
      )
      .select()
      .single();
    if (error) throw error;

    const profileUpdate: { brand_color?: string | null; hero_url?: string | null } = {};
    if (sanitized.primary_color !== undefined) profileUpdate.brand_color = sanitized.primary_color;
    if (sanitized.hero_image_url !== undefined) profileUpdate.hero_url = sanitized.hero_image_url;
    if (Object.keys(profileUpdate).length > 0) {
      await context.supabase.from("profiles").update(profileUpdate).eq("id", profileId);
    }
    return row;
  });

/** Throw the draft away and go back to whatever is live. */
export const discardThemeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await context.supabase
      .from("clinic_theme")
      .update({ draft: null, draft_updated_at: null })
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });
