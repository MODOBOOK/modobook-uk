DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(p_slug text)
RETURNS TABLE(
  id uuid,
  slug text,
  full_name text,
  clinic_name text,
  tagline text,
  about text,
  bio text,
  avatar_url text,
  hero_url text,
  brand_color text,
  address jsonb,
  social_links jsonb,
  specialties text[],
  qualifications jsonb,
  timeline jsonb,
  welcome_intro_html text,
  deposit_amount_cents integer,
  deposit_policy_text text,
  cancellation_rules jsonb,
  terms_html text,
  terms_required boolean,
  membership_hero_title text,
  membership_hero_subtitle text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, slug, full_name, clinic_name, tagline, about, bio, avatar_url, hero_url,
    brand_color, address, social_links, specialties, qualifications, timeline,
    welcome_intro_html, deposit_amount_cents, deposit_policy_text, cancellation_rules,
    terms_html, terms_required, membership_hero_title, membership_hero_subtitle,
    active, created_at, updated_at
  FROM public.profiles
  WHERE slug = p_slug AND active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated, service_role;