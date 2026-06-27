ALTER TABLE public.model_slots ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS model_slots_position text NOT NULL DEFAULT 'top';

DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(p_slug text)
 RETURNS TABLE(id uuid, slug text, full_name text, clinic_name text, tagline text, about text, bio text, avatar_url text, hero_url text, brand_color text, address jsonb, social_links jsonb, specialties text[], qualifications jsonb, timeline jsonb, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, welcome_intro_html text, deposit_amount_cents integer, deposit_policy_text text, cancellation_rules jsonb, chooser_enabled boolean, chooser_show_know boolean, chooser_show_unsure boolean, chooser_show_consultation boolean, chooser_consultation_treatment_id uuid, chooser_intro_text text, chooser_consultation_treatment_ids uuid[], chooser_extra_enabled boolean, chooser_extra_title text, chooser_extra_body text, chooser_extra_treatment_ids uuid[], model_slots_position text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, slug, full_name, clinic_name, tagline, about, bio, avatar_url,
         hero_url, brand_color, address, social_links, specialties,
         qualifications, timeline, active, created_at, updated_at,
         welcome_intro_html, COALESCE(deposit_amount_cents, 0),
         deposit_policy_text, COALESCE(cancellation_rules, '[]'::jsonb),
         COALESCE(chooser_enabled, false),
         COALESCE(chooser_show_know, true),
         COALESCE(chooser_show_unsure, true),
         COALESCE(chooser_show_consultation, true),
         chooser_consultation_treatment_id,
         chooser_intro_text,
         COALESCE(chooser_consultation_treatment_ids, '{}'::uuid[]),
         COALESCE(chooser_extra_enabled, false),
         chooser_extra_title,
         chooser_extra_body,
         COALESCE(chooser_extra_treatment_ids, '{}'::uuid[]),
         COALESCE(model_slots_position, 'top')
  FROM public.profiles WHERE slug = p_slug AND active = true;
$function$;