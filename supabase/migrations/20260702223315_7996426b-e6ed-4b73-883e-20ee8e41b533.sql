
ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS erasure_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS erasure_reason text;

CREATE OR REPLACE FUNCTION public.patient_request_erasure(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid;
  v_client uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_profile FROM public.profiles WHERE slug = p_slug AND active = true;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Clinic not found'; END IF;

  IF NOT public.is_patient_of_profile(v_profile) THEN
    RAISE EXCEPTION 'No patient account with this clinic';
  END IF;

  v_client := public.current_patient_client_id(v_profile);

  -- Pseudonymise personal identifiers, KEEP clinical records for statutory retention
  -- (UK: 8y adult medical, 10y prescriptions, 7y financial records).
  IF v_client IS NOT NULL THEN
    UPDATE public.clinic_clients
       SET full_name = 'Erased patient',
           email = NULL, phone = NULL, dob = NULL,
           address = NULL, address_line1 = NULL, address_line2 = NULL,
           city = NULL, postcode = NULL, country = NULL,
           emergency_contact_name = NULL, emergency_contact_phone = NULL,
           gp_name = NULL, gp_address = NULL,
           allergies = NULL, medical_form_data = NULL,
           erasure_requested_at = now(),
           updated_at = now()
     WHERE id = v_client AND profile_id = v_profile;

    -- Scrub PII on appointment snapshots for this patient at this clinic
    UPDATE public.appointments
       SET patient_name = 'Erased patient',
           patient_email = NULL, patient_phone = NULL,
           patient_dob = NULL, patient_address = NULL,
           patient_user_id = NULL
     WHERE profile_id = v_profile
       AND patient_user_id = auth.uid();
  END IF;

  -- Revoke practitioner-facing patient account link
  DELETE FROM public.patient_accounts
   WHERE user_id = auth.uid() AND profile_id = v_profile;

  RETURN jsonb_build_object('ok', true, 'client_id', v_client);
END;
$$;

REVOKE ALL ON FUNCTION public.patient_request_erasure(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_request_erasure(text) TO authenticated;
