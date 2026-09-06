DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);

CREATE FUNCTION public.get_public_profile_by_slug(p_slug text)
 RETURNS TABLE(id uuid, slug text, full_name text, clinic_name text, tagline text, about text, bio text, avatar_url text, hero_url text, brand_color text, address jsonb, social_links jsonb, specialties text[], qualifications jsonb, timeline jsonb, welcome_intro_html text, deposit_amount_cents integer, deposit_policy_text text, cancellation_rules jsonb, terms_html text, terms_required boolean, membership_hero_title text, membership_hero_subtitle text, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, display_name_mode text, contact_sms_number text, contact_whatsapp_number text, deposit_type text, deposit_percent numeric, no_refund_policy_enabled boolean, no_refund_policy_text text, payment_pass_fees_to_customer boolean, chooser_enabled boolean, chooser_show_know boolean, chooser_show_unsure boolean, chooser_show_consultation boolean, chooser_consultation_treatment_id uuid, chooser_consultation_treatment_ids uuid[], chooser_intro_text text, model_slots_position text, practitioner_selection_mode text, favourite_treatment_ids uuid[], favourites_enabled boolean, favourites_custom_title text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, slug, full_name, clinic_name, tagline, about, bio, avatar_url, hero_url,
    brand_color, address, social_links, specialties, qualifications, timeline,
    welcome_intro_html, deposit_amount_cents, deposit_policy_text, cancellation_rules,
    terms_html, terms_required, membership_hero_title, membership_hero_subtitle,
    active, created_at, updated_at,
    display_name_mode, contact_sms_number, contact_whatsapp_number,
    deposit_type, deposit_percent, no_refund_policy_enabled, no_refund_policy_text,
    payment_pass_fees_to_customer, chooser_enabled, chooser_show_know,
    chooser_show_unsure, chooser_show_consultation, chooser_consultation_treatment_id,
    chooser_consultation_treatment_ids, chooser_intro_text, model_slots_position,
    practitioner_selection_mode, favourite_treatment_ids, favourites_enabled,
    favourites_custom_title
  FROM public.profiles
  WHERE slug = p_slug AND active = true;
$function$;