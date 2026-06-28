CREATE OR REPLACE FUNCTION public.create_appointment_consents(
  p_appointment_id uuid,
  p_template_ids uuid[]
)
RETURNS TABLE(token text, consent_template_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid;
BEGIN
  SELECT a.profile_id INTO v_profile FROM public.appointments a WHERE a.id = p_appointment_id;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF NOT public.is_active_profile(v_profile) THEN
    RAISE EXCEPTION 'Profile not active';
  END IF;

  RETURN QUERY
  INSERT INTO public.appointment_consents (appointment_id, consent_template_id, profile_id)
  SELECT p_appointment_id, t, v_profile
  FROM unnest(p_template_ids) AS t
  RETURNING appointment_consents.token, appointment_consents.consent_template_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment_consents(uuid, uuid[]) TO anon, authenticated, service_role;