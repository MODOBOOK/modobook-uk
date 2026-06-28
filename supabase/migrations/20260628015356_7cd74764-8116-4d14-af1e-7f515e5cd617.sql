
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS practitioner_selection_mode text NOT NULL DEFAULT 'optional';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_practitioner_selection_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_practitioner_selection_mode_check
  CHECK (practitioner_selection_mode IN ('required','optional','first_available'));

DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(p_slug text)
 RETURNS TABLE(id uuid, slug text, full_name text, clinic_name text, tagline text, about text, bio text, avatar_url text, hero_url text, brand_color text, address jsonb, social_links jsonb, specialties text[], qualifications jsonb, timeline jsonb, welcome_intro_html text, deposit_amount_cents integer, deposit_policy_text text, cancellation_rules jsonb, terms_html text, terms_required boolean, discount_stack_mode text, contact_sms_number text, contact_whatsapp_number text, chooser_enabled boolean, chooser_show_know boolean, chooser_show_unsure boolean, chooser_show_consultation boolean, chooser_consultation_treatment_id uuid, chooser_consultation_treatment_ids uuid[], chooser_intro_text text, chooser_extra_enabled boolean, chooser_extra_title text, chooser_extra_body text, chooser_extra_treatment_ids uuid[], model_slots_position text, practitioner_selection_mode text, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, slug, full_name, clinic_name, tagline, about, bio, avatar_url, hero_url,
    brand_color, address, social_links, specialties, qualifications, timeline,
    welcome_intro_html, deposit_amount_cents, deposit_policy_text, cancellation_rules,
    terms_html, terms_required, discount_stack_mode,
    contact_sms_number, contact_whatsapp_number,
    chooser_enabled, chooser_show_know, chooser_show_unsure,
    chooser_show_consultation, chooser_consultation_treatment_id,
    chooser_consultation_treatment_ids, chooser_intro_text,
    chooser_extra_enabled, chooser_extra_title, chooser_extra_body,
    chooser_extra_treatment_ids,
    model_slots_position,
    practitioner_selection_mode,
    active, created_at, updated_at
  FROM public.profiles
  WHERE slug = p_slug AND active = true;
$function$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES public.practitioners(id) ON DELETE SET NULL;
