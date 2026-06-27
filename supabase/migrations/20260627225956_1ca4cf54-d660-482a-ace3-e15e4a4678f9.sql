
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS addon_mode text NOT NULL DEFAULT 'optional'
    CHECK (addon_mode IN ('off','optional')),
  ADD COLUMN IF NOT EXISTS discount_show_was_now boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS discount_label text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discount_stack_mode text NOT NULL DEFAULT 'best'
    CHECK (discount_stack_mode IN ('stack','best'));

DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);
CREATE FUNCTION public.get_public_profile_by_slug(p_slug text)
 RETURNS TABLE(id uuid, slug text, full_name text, clinic_name text, tagline text, about text, bio text, avatar_url text, hero_url text, brand_color text, address jsonb, social_links jsonb, specialties text[], qualifications jsonb, timeline jsonb, welcome_intro_html text, deposit_amount_cents integer, deposit_policy_text text, cancellation_rules jsonb, terms_html text, terms_required boolean, discount_stack_mode text, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, slug, full_name, clinic_name, tagline, about, bio, avatar_url, hero_url,
    brand_color, address, social_links, specialties, qualifications, timeline,
    welcome_intro_html, deposit_amount_cents, deposit_policy_text, cancellation_rules,
    terms_html, terms_required, discount_stack_mode,
    active, created_at, updated_at
  FROM public.profiles
  WHERE slug = p_slug AND active = true;
$function$;
