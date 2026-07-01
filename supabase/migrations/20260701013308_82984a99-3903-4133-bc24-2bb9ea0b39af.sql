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
    NULL,
    template_id,
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
      AND existing.template_id = template_id
      AND existing.appointment_id IS NULL
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_walk_in_medical_forms(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_walk_in_medical_forms(uuid, uuid[]) TO authenticated;