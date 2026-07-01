CREATE OR REPLACE FUNCTION public.add_walk_in_medical_forms(
  p_referral_id uuid,
  p_template_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref record;
  v_client uuid;
  v_template_id uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_ref
  FROM public.prescriber_referrals
  WHERE id = p_referral_id;

  IF v_ref.id IS NULL THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  IF v_ref.prescriber_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_ref.status NOT IN ('accepted', 'completed') THEN
    RAISE EXCEPTION 'Accept the case before adding medical forms';
  END IF;

  IF COALESCE(array_length(p_template_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  v_client := v_ref.client_id;

  IF v_client IS NULL AND v_ref.patient_email IS NOT NULL THEN
    SELECT id INTO v_client
    FROM public.clinic_clients
    WHERE profile_id = v_ref.practitioner_profile_id
      AND lower(email) = lower(v_ref.patient_email)
    LIMIT 1;
  END IF;

  IF v_client IS NULL THEN
    INSERT INTO public.clinic_clients (
      profile_id, full_name, email, phone, dob
    ) VALUES (
      v_ref.practitioner_profile_id,
      COALESCE(NULLIF(trim(v_ref.patient_name), ''), 'Walk-in patient'),
      NULLIF(trim(COALESCE(v_ref.patient_email, '')), ''),
      NULLIF(trim(COALESCE(v_ref.patient_phone, '')), ''),
      v_ref.patient_dob
    )
    RETURNING id INTO v_client;

    UPDATE public.prescriber_referrals
    SET client_id = v_client,
        updated_at = now()
    WHERE id = v_ref.id;
  END IF;

  FOREACH v_template_id IN ARRAY p_template_ids LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.medical_form_templates mft
      WHERE mft.id = v_template_id
        AND (mft.is_system = true OR mft.profile_id = v_ref.practitioner_profile_id)
    ) THEN
      RAISE EXCEPTION 'Medical form is not available for this practitioner';
    END IF;
  END LOOP;

  INSERT INTO public.appointment_medical_forms (
    appointment_id, template_id, profile_id, client_id, recipient_email, recipient_phone
  )
  SELECT DISTINCT
    NULL::uuid,
    template_id::uuid,
    v_ref.practitioner_profile_id,
    v_client,
    NULLIF(trim(COALESCE(v_ref.patient_email, '')), ''),
    NULLIF(trim(COALESCE(v_ref.patient_phone, '')), '')
  FROM unnest(p_template_ids) AS template_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.appointment_medical_forms existing
    WHERE existing.profile_id = v_ref.practitioner_profile_id
      AND existing.client_id = v_client
      AND existing.template_id = template_id::uuid
      AND existing.appointment_id IS NULL
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_walk_in_medical_forms(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_walk_in_medical_forms(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_walk_in_referral(
  p_practitioner_profile_id uuid,
  p_patient_name text,
  p_patient_email text DEFAULT NULL,
  p_patient_phone text DEFAULT NULL,
  p_patient_dob date DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_medical_form_template_ids uuid[] DEFAULT '{}'::uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_practitioner_user uuid;
  v_id uuid;
  v_client uuid := p_client_id;
  v_template_id uuid;
  v_normalized_email text := NULLIF(lower(trim(COALESCE(p_patient_email, ''))), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_practitioner_user
  FROM public.profiles
  WHERE id = p_practitioner_profile_id;

  IF v_practitioner_user IS NULL THEN
    RAISE EXCEPTION 'Practitioner not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.hub_links
    WHERE status = 'accepted'
      AND (
        (requester_user_id = auth.uid() AND recipient_user_id = v_practitioner_user)
        OR (recipient_user_id = auth.uid() AND requester_user_id = v_practitioner_user)
      )
  ) THEN
    RAISE EXCEPTION 'You are not linked to this practitioner';
  END IF;

  IF v_client IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clinic_clients
    WHERE id = v_client AND profile_id = p_practitioner_profile_id
  ) THEN
    RAISE EXCEPTION 'Patient does not belong to this practitioner';
  END IF;

  IF v_client IS NULL AND v_normalized_email IS NOT NULL THEN
    SELECT id INTO v_client
    FROM public.clinic_clients
    WHERE profile_id = p_practitioner_profile_id
      AND lower(email) = v_normalized_email
    LIMIT 1;
  END IF;

  IF v_client IS NULL THEN
    INSERT INTO public.clinic_clients (
      profile_id, full_name, email, phone, dob, notes
    ) VALUES (
      p_practitioner_profile_id,
      trim(p_patient_name),
      NULLIF(trim(COALESCE(p_patient_email, '')), ''),
      NULLIF(trim(COALESCE(p_patient_phone, '')), ''),
      p_patient_dob,
      CASE WHEN NULLIF(trim(COALESCE(p_note, '')), '') IS NULL THEN NULL ELSE 'Walk-in note: ' || trim(p_note) END
    )
    RETURNING id INTO v_client;
  ELSE
    UPDATE public.clinic_clients
    SET full_name = COALESCE(NULLIF(full_name, ''), trim(p_patient_name)),
        email = COALESCE(NULLIF(email, ''), NULLIF(trim(COALESCE(p_patient_email, '')), '')),
        phone = COALESCE(NULLIF(phone, ''), NULLIF(trim(COALESCE(p_patient_phone, '')), '')),
        dob = COALESCE(dob, p_patient_dob),
        updated_at = now()
    WHERE id = v_client
      AND profile_id = p_practitioner_profile_id;
  END IF;

  INSERT INTO public.prescriber_referrals(
    practitioner_profile_id, prescriber_user_id, treatment_id, appointment_id, client_id,
    patient_name, patient_email, patient_phone, patient_dob,
    routing, status, is_walk_in, walk_in_note, awaiting_practitioner_close,
    consent_given_at, accepted_at
  ) VALUES (
    p_practitioner_profile_id, auth.uid(), NULL, NULL, v_client,
    trim(p_patient_name), NULLIF(trim(COALESCE(p_patient_email, '')), ''), NULLIF(trim(COALESCE(p_patient_phone, '')), ''), p_patient_dob,
    'walk_in', 'accepted', true, p_note, false,
    now(), now()
  ) RETURNING id INTO v_id;

  IF COALESCE(array_length(p_medical_form_template_ids, 1), 0) > 0 THEN
    FOREACH v_template_id IN ARRAY p_medical_form_template_ids LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.medical_form_templates mft
        WHERE mft.id = v_template_id
          AND (mft.is_system = true OR mft.profile_id = p_practitioner_profile_id)
      ) THEN
        RAISE EXCEPTION 'Medical form is not available for this practitioner';
      END IF;
    END LOOP;

    INSERT INTO public.appointment_medical_forms (
      appointment_id, template_id, profile_id, client_id, recipient_email, recipient_phone
    )
    SELECT DISTINCT
      NULL::uuid,
      template_id::uuid,
      p_practitioner_profile_id,
      v_client,
      NULLIF(trim(COALESCE(p_patient_email, '')), ''),
      NULLIF(trim(COALESCE(p_patient_phone, '')), '')
    FROM unnest(p_medical_form_template_ids) AS template_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.appointment_medical_forms existing
      WHERE existing.profile_id = p_practitioner_profile_id
        AND existing.client_id = v_client
        AND existing.template_id = template_id::uuid
        AND existing.appointment_id IS NULL
    );
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_walk_in_referral(uuid, text, text, text, date, text, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_walk_in_referral(uuid, text, text, text, date, text, uuid, uuid[]) TO authenticated;