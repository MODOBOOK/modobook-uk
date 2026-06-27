
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_intro_html text,
  ADD COLUMN IF NOT EXISTS deposit_amount_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_policy_text text,
  ADD COLUMN IF NOT EXISTS cancellation_rules jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS manage_token text UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  ADD COLUMN IF NOT EXISTS created_by_practitioner boolean DEFAULT false;

UPDATE public.appointments SET manage_token = encode(gen_random_bytes(18), 'hex') WHERE manage_token IS NULL;

-- Lookup by manage token (public, security definer)
CREATE OR REPLACE FUNCTION public.get_appointment_by_manage_token(p_token text)
RETURNS TABLE(
  id uuid, scheduled_date date, start_time time, end_time time,
  patient_name text, patient_email text, patient_phone text, status text,
  treatment_name text, location_name text, clinic_name text, slug text,
  cancellation_rules jsonb, deposit_policy_text text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.scheduled_date, a.start_time, a.end_time,
         a.patient_name, a.patient_email, a.patient_phone, a.status,
         t.name, l.name, p.clinic_name, p.slug,
         p.cancellation_rules, p.deposit_policy_text
  FROM public.appointments a
  JOIN public.treatments t ON t.id = a.treatment_id
  JOIN public.profiles p ON p.id = a.profile_id
  LEFT JOIN public.locations l ON l.id = a.location_id
  WHERE a.manage_token = p_token
$$;

REVOKE EXECUTE ON FUNCTION public.get_appointment_by_manage_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_manage_token(text) TO anon, authenticated;

-- Cancel by manage token
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.appointments
   WHERE manage_token = p_token AND status NOT IN ('cancelled','completed');
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.appointments SET status = 'cancelled' WHERE id = v_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(text) TO anon, authenticated;

-- Update get_public_profile_by_slug to include new fields
DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);
CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(p_slug text)
RETURNS TABLE(
  id uuid, slug text, full_name text, clinic_name text, tagline text,
  about text, bio text, avatar_url text, hero_url text, brand_color text,
  address jsonb, social_links jsonb, specialties text[], qualifications jsonb,
  timeline jsonb, active boolean, created_at timestamptz, updated_at timestamptz,
  welcome_intro_html text, deposit_amount_cents integer,
  deposit_policy_text text, cancellation_rules jsonb
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, slug, full_name, clinic_name, tagline, about, bio, avatar_url,
         hero_url, brand_color, address, social_links, specialties,
         qualifications, timeline, active, created_at, updated_at,
         welcome_intro_html, COALESCE(deposit_amount_cents, 0),
         deposit_policy_text, COALESCE(cancellation_rules, '[]'::jsonb)
  FROM public.profiles WHERE slug = p_slug AND active = true;
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated;
