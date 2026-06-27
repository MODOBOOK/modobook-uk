
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chooser_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chooser_show_know boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chooser_show_unsure boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chooser_show_consultation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chooser_consultation_treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chooser_intro_text text;

CREATE TABLE IF NOT EXISTS public.concern_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.concern_areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concern_areas TO authenticated;
GRANT ALL ON public.concern_areas TO service_role;
ALTER TABLE public.concern_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concern_areas_public_read" ON public.concern_areas FOR SELECT USING (public.is_active_profile(profile_id));
CREATE POLICY "concern_areas_owner_all" ON public.concern_areas FOR ALL USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));
CREATE TRIGGER trg_concern_areas_updated BEFORE UPDATE ON public.concern_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.concern_areas(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.concerns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concerns TO authenticated;
GRANT ALL ON public.concerns TO service_role;
ALTER TABLE public.concerns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concerns_public_read" ON public.concerns FOR SELECT USING (public.is_active_profile(profile_id));
CREATE POLICY "concerns_owner_all" ON public.concerns FOR ALL USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));
CREATE TRIGGER trg_concerns_updated BEFORE UPDATE ON public.concerns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.concern_treatments (
  concern_id uuid NOT NULL REFERENCES public.concerns(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (concern_id, treatment_id)
);
GRANT SELECT ON public.concern_treatments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concern_treatments TO authenticated;
GRANT ALL ON public.concern_treatments TO service_role;
ALTER TABLE public.concern_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concern_treatments_public_read" ON public.concern_treatments FOR SELECT USING (public.is_active_profile(profile_id));
CREATE POLICY "concern_treatments_owner_all" ON public.concern_treatments FOR ALL USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));

DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);
CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(p_slug text)
 RETURNS TABLE(id uuid, slug text, full_name text, clinic_name text, tagline text, about text, bio text, avatar_url text, hero_url text, brand_color text, address jsonb, social_links jsonb, specialties text[], qualifications jsonb, timeline jsonb, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, welcome_intro_html text, deposit_amount_cents integer, deposit_policy_text text, cancellation_rules jsonb, chooser_enabled boolean, chooser_show_know boolean, chooser_show_unsure boolean, chooser_show_consultation boolean, chooser_consultation_treatment_id uuid, chooser_intro_text text)
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
         chooser_intro_text
  FROM public.profiles WHERE slug = p_slug AND active = true;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated;
