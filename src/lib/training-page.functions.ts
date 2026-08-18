import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrainingHighlight = { title: string; body: string };

export type TrainingPageInput = {
  eyebrow?: string | null;
  headline?: string | null;
  intro?: string | null;
  hero_image_url?: string | null;
  courses_heading?: string | null;
  highlights?: TrainingHighlight[];
  body_heading?: string | null;
  body_html?: string | null;
  show_highlights?: boolean;
  show_cta?: boolean;
  cta_heading?: string | null;
  cta_body?: string | null;
  cta_button_label?: string | null;
  cta_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

async function profileIdFor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

export const getMyTrainingPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await profileIdFor(supabase, userId);
    if (!profileId) return null;
    const { data, error } = await supabase
      .from("training_pages")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  });

export const saveMyTrainingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TrainingPageInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await profileIdFor(supabase, userId);
    if (!profileId) throw new Error("Profile not found");

    const highlights = (data.highlights ?? [])
      .map((h) => ({ title: (h.title ?? "").trim(), body: (h.body ?? "").trim() }))
      .filter((h) => h.title || h.body)
      .slice(0, 8);

    const payload = {
      profile_id: profileId,
      eyebrow: data.eyebrow || null,
      headline: data.headline || null,
      intro: data.intro || null,
      hero_image_url: data.hero_image_url || null,
      courses_heading: data.courses_heading || null,
      highlights,
      body_heading: data.body_heading || null,
      body_html: data.body_html || null,
      show_highlights: data.show_highlights ?? true,
      show_cta: data.show_cta ?? true,
      cta_heading: data.cta_heading || null,
      cta_body: data.cta_body || null,
      cta_button_label: data.cta_button_label || null,
      cta_url: data.cta_url || null,
      seo_title: data.seo_title || null,
      seo_description: data.seo_description || null,
    };

    const { data: row, error } = await supabase
      .from("training_pages")
      .upsert(payload as never, { onConflict: "profile_id" })
      .select()
      .single();
    if (error) throw error;
    return row;
  });
