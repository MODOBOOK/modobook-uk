CREATE OR REPLACE FUNCTION public.get_clinic_slug_for_form_token(p_token text)
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.slug FROM public.appointment_medical_forms amf
  JOIN public.profiles p ON p.id = amf.profile_id
  WHERE amf.token = p_token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_clinic_slug_for_form_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_clinic_slug_for_consent_token(p_token text)
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.slug FROM public.appointment_consents ac
  JOIN public.profiles p ON p.id = ac.profile_id
  WHERE ac.token = p_token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_clinic_slug_for_consent_token(text) TO anon, authenticated;