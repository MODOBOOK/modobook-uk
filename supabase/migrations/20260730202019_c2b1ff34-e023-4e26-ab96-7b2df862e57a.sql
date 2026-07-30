CREATE OR REPLACE FUNCTION public.create_appointment_medical_forms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_has_own boolean;
BEGIN
  IF NEW.patient_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM public.clinic_clients
    WHERE profile_id = NEW.profile_id
      AND lower(email) = lower(NEW.patient_email)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL AND (NEW.patient_name IS NOT NULL OR NEW.patient_email IS NOT NULL) THEN
    INSERT INTO public.clinic_clients (
      profile_id, full_name, email, phone, dob, address
    ) VALUES (
      NEW.profile_id,
      COALESCE(NULLIF(trim(NEW.patient_name), ''), COALESCE(NEW.patient_email, 'Patient')),
      NULLIF(trim(COALESCE(NEW.patient_email, '')), ''),
      NULLIF(trim(COALESCE(NEW.patient_phone, '')), ''),
      NEW.patient_dob,
      COALESCE(NEW.patient_address::text, NULL)
    )
    RETURNING id INTO v_client_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.treatment_medical_forms tmf
    JOIN public.medical_form_templates mft ON mft.id = tmf.template_id
    WHERE tmf.treatment_id = NEW.treatment_id
      AND COALESCE(mft.is_system, false) = false
  ) INTO v_has_own;

  INSERT INTO public.appointment_medical_forms (
    appointment_id, template_id, profile_id, client_id, recipient_email, recipient_phone
  )
  SELECT DISTINCT ON (tmf.template_id)
    NEW.id, tmf.template_id, NEW.profile_id, v_client_id,
    NULLIF(trim(COALESCE(NEW.patient_email, '')), ''),
    NULLIF(trim(COALESCE(NEW.patient_phone, '')), '')
  FROM public.treatment_medical_forms tmf
  JOIN public.medical_form_templates mft ON mft.id = tmf.template_id
  WHERE tmf.treatment_id = NEW.treatment_id
    AND (NOT v_has_own OR COALESCE(mft.is_system, false) = false)
    -- don't re-send a form the patient already has outstanding (or just completed)
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointment_medical_forms existing
      WHERE existing.profile_id = NEW.profile_id
        AND existing.template_id = tmf.template_id
        AND (
          (v_client_id IS NOT NULL AND existing.client_id = v_client_id)
          OR (
            v_client_id IS NULL
            AND NEW.patient_email IS NOT NULL
            AND lower(COALESCE(existing.recipient_email, '')) = lower(NEW.patient_email)
          )
        )
        AND (
          existing.submitted_at IS NULL
          OR existing.submitted_at > now() - interval '24 hours'
        )
    )
  ORDER BY tmf.template_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_appointment_consents(p_appointment_id uuid, p_template_ids uuid[])
RETURNS TABLE(token text, consent_template_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid;
  v_email text;
BEGIN
  SELECT a.profile_id, lower(NULLIF(trim(COALESCE(a.patient_email, '')), ''))
    INTO v_profile, v_email
  FROM public.appointments a WHERE a.id = p_appointment_id;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF NOT public.is_active_profile(v_profile) THEN
    RAISE EXCEPTION 'Profile not active';
  END IF;

  RETURN QUERY
  INSERT INTO public.appointment_consents (appointment_id, consent_template_id, profile_id)
  SELECT DISTINCT p_appointment_id, t, v_profile
  FROM unnest(p_template_ids) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.appointment_consents ex
    WHERE ex.profile_id = v_profile
      AND ex.consent_template_id = t
      AND (
        ex.appointment_id = p_appointment_id
        OR (
          v_email IS NOT NULL
          AND ex.signed_at IS NULL
          AND ex.created_at > now() - interval '24 hours'
          AND EXISTS (
            SELECT 1 FROM public.appointments a2
            WHERE a2.id = ex.appointment_id
              AND lower(NULLIF(trim(COALESCE(a2.patient_email, '')), '')) = v_email
          )
        )
      )
  )
  RETURNING appointment_consents.token, appointment_consents.consent_template_id;
END;
$$;