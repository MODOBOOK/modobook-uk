
CREATE OR REPLACE FUNCTION public.claim_appointments_by_email(p_slug text, p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile uuid;
  v_email text := lower(trim(p_email));
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'Email required'; END IF;

  SELECT id INTO v_profile FROM public.profiles WHERE slug = p_slug AND active = true;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Practitioner not found'; END IF;

  -- Ensure a patient_account row exists for this user + profile so RLS allows reads
  INSERT INTO public.patient_accounts (user_id, profile_id, email)
  VALUES (auth.uid(), v_profile, COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), v_email))
  ON CONFLICT (user_id, profile_id) DO NOTHING;

  UPDATE public.appointments
     SET patient_user_id = auth.uid()
   WHERE profile_id = v_profile
     AND lower(patient_email) = v_email
     AND (patient_user_id IS NULL OR patient_user_id <> auth.uid());
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_appointments_by_email(text, text) TO authenticated;
