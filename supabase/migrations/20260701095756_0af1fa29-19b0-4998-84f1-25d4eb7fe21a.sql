ALTER TABLE public.appointment_consents
  ALTER COLUMN appointment_id DROP NOT NULL;

ALTER TABLE public.appointment_consents
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.prescriber_referrals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appt_consents_referral ON public.appointment_consents(referral_id);
CREATE INDEX IF NOT EXISTS idx_appt_consents_client ON public.appointment_consents(client_id);

CREATE OR REPLACE FUNCTION public.list_linked_practitioner_consent_forms(p_practitioner_profile_id uuid)
RETURNS TABLE(id uuid, name text, treatment_type text, summary text, is_system boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_practitioner_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_practitioner_user
  FROM public.profiles
  WHERE profiles.id = p_practitioner_profile_id;

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

  RETURN QUERY
  SELECT ct.id, ct.name, ct.treatment_type, ct.summary, ct.is_system
  FROM public.consent_templates ct
  WHERE ct.is_system = true OR ct.profile_id = p_practitioner_profile_id
  ORDER BY ct.is_system DESC, ct.name ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_linked_practitioner_consent_forms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_linked_practitioner_consent_forms(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_walk_in_consent_forms(
  p_referral_id uuid,
  p_template_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref record;
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
    RAISE EXCEPTION 'Accept the case before adding consent forms';
  END IF;

  IF COALESCE(array_length(p_template_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  FOREACH v_template_id IN ARRAY p_template_ids LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.consent_templates ct
      WHERE ct.id = v_template_id
        AND (ct.is_system = true OR ct.profile_id = v_ref.practitioner_profile_id)
    ) THEN
      RAISE EXCEPTION 'Consent form is not available for this practitioner';
    END IF;
  END LOOP;

  INSERT INTO public.appointment_consents (
    appointment_id, referral_id, client_id, consent_template_id, profile_id
  )
  SELECT DISTINCT
    v_ref.appointment_id,
    v_ref.id,
    v_ref.client_id,
    template_id::uuid,
    v_ref.practitioner_profile_id
  FROM unnest(p_template_ids) AS template_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.appointment_consents existing
    WHERE existing.profile_id = v_ref.practitioner_profile_id
      AND existing.consent_template_id = template_id::uuid
      AND (
        existing.referral_id = v_ref.id
        OR (v_ref.appointment_id IS NOT NULL AND existing.appointment_id = v_ref.appointment_id)
      )
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_walk_in_consent_forms(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_walk_in_consent_forms(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_walk_in_referral(
  p_practitioner_profile_id uuid,
  p_patient_name text,
  p_patient_email text DEFAULT NULL,
  p_patient_phone text DEFAULT NULL,
  p_patient_dob date DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_medical_form_template_ids uuid[] DEFAULT '{}'::uuid[],
  p_consent_template_ids uuid[] DEFAULT '{}'::uuid[]
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
    ORDER BY created_at DESC
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
      NULL,
      template_id,
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
        AND existing.template_id = template_id
        AND existing.appointment_id IS NULL
    );
  END IF;

  IF COALESCE(array_length(p_consent_template_ids, 1), 0) > 0 THEN
    PERFORM public.add_walk_in_consent_forms(v_id, p_consent_template_ids);
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_walk_in_referral(uuid, text, text, text, date, text, uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_walk_in_referral(uuid, text, text, text, date, text, uuid, uuid[], uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.prescriber_get_referral_full(p_referral_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ref record;
  v_forms jsonb := '[]'::jsonb;
  v_consultations jsonb := '[]'::jsonb;
  v_appt jsonb;
  v_client jsonb;
  v_consents jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_ref FROM public.prescriber_referrals WHERE id = p_referral_id;
  IF v_ref.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_ref.prescriber_user_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_ref.status NOT IN ('accepted','completed') THEN RAISE EXCEPTION 'Accept the case to view the full record'; END IF;

  IF v_ref.appointment_id IS NOT NULL THEN
    SELECT to_jsonb(a) INTO v_appt FROM public.appointments a WHERE a.id = v_ref.appointment_id;
  END IF;

  IF v_ref.client_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_client FROM public.clinic_clients c WHERE c.id = v_ref.client_id;
  ELSIF v_ref.patient_email IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_client FROM public.clinic_clients c
      WHERE c.profile_id = v_ref.practitioner_profile_id AND lower(c.email) = lower(v_ref.patient_email) LIMIT 1;
  END IF;

  IF v_ref.appointment_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', amf.id,
      'template_id', mft.id,
      'template_name', mft.name,
      'description', mft.description,
      'response', amf.response,
      'submitted_at', amf.submitted_at,
      'status', amf.status,
      'schema', mft.schema,
      'token', amf.token
    ) ORDER BY amf.created_at DESC), '[]'::jsonb)
      INTO v_forms
      FROM public.appointment_medical_forms amf
      JOIN public.medical_form_templates mft ON mft.id = amf.template_id
      WHERE amf.appointment_id = v_ref.appointment_id;
  ELSIF v_client IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', amf.id,
      'template_id', mft.id,
      'template_name', mft.name,
      'description', mft.description,
      'response', amf.response,
      'submitted_at', amf.submitted_at,
      'status', amf.status,
      'schema', mft.schema,
      'token', amf.token
    ) ORDER BY amf.submitted_at DESC NULLS LAST, amf.created_at DESC), '[]'::jsonb)
      INTO v_forms
      FROM public.appointment_medical_forms amf
      JOIN public.medical_form_templates mft ON mft.id = amf.template_id
      LEFT JOIN public.appointments a ON a.id = amf.appointment_id
      WHERE amf.profile_id = v_ref.practitioner_profile_id
        AND (
          amf.client_id = (v_client->>'id')::uuid
          OR (v_ref.patient_email IS NOT NULL AND lower(COALESCE(a.patient_email, amf.recipient_email,'')) = lower(v_ref.patient_email))
        );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ac.id,
    'template_id', ct.id,
    'template_name', ct.name,
    'status', ac.status,
    'signed_at', ac.signed_at,
    'signature_name', ac.signature_name,
    'signature_data', ac.signature_data,
    'signed_url', ac.signed_url,
    'body_markdown', ct.body_markdown,
    'summary', ct.summary,
    'treatment_type', ct.treatment_type,
    'token', ac.token
  ) ORDER BY ac.signed_at DESC NULLS LAST, ac.created_at DESC), '[]'::jsonb)
    INTO v_consents
    FROM public.appointment_consents ac
    JOIN public.consent_templates ct ON ct.id = ac.consent_template_id
    LEFT JOIN public.appointments a ON a.id = ac.appointment_id
    WHERE ac.profile_id = v_ref.practitioner_profile_id
      AND (
        ac.referral_id = v_ref.id
        OR (v_ref.appointment_id IS NOT NULL AND ac.appointment_id = v_ref.appointment_id)
        OR (v_client IS NOT NULL AND ac.client_id = (v_client->>'id')::uuid)
        OR (v_ref.patient_email IS NOT NULL AND lower(COALESCE(a.patient_email,'')) = lower(v_ref.patient_email))
        OR lower(COALESCE(a.patient_name,'')) = lower(COALESCE(v_ref.patient_name,''))
      );

  IF v_ref.appointment_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(co)), '[]'::jsonb) INTO v_consultations
      FROM public.consultations co
      WHERE co.appointment_id = v_ref.appointment_id;
  END IF;

  RETURN jsonb_build_object(
    'referral', to_jsonb(v_ref),
    'appointment', v_appt,
    'client', v_client,
    'medical_forms', v_forms,
    'consents', v_consents,
    'consultations', v_consultations
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.get_consent_by_token(text);
CREATE FUNCTION public.get_consent_by_token(p_token text)
 RETURNS TABLE(consent_id uuid, appointment_id uuid, status text, template_name text, template_body text, template_sections jsonb, template_summary text, requires_signature boolean, patient_name text, scheduled_date date, start_time time without time zone, treatment_name text, clinic_name text, slug text)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT ac.id, ac.appointment_id, ac.status,
    ct.name, ct.body_markdown, ct.sections, ct.summary, ct.requires_signature,
    COALESCE(a.patient_name, pr.patient_name, cc.full_name)::text,
    a.scheduled_date,
    a.start_time,
    COALESCE(t.name, 'Walk-in consultation')::text,
    p.clinic_name,
    p.slug
  FROM public.appointment_consents ac
  JOIN public.consent_templates ct ON ct.id = ac.consent_template_id
  LEFT JOIN public.appointments a ON a.id = ac.appointment_id
  LEFT JOIN public.treatments t ON t.id = a.treatment_id
  LEFT JOIN public.prescriber_referrals pr ON pr.id = ac.referral_id
  LEFT JOIN public.clinic_clients cc ON cc.id = ac.client_id
  JOIN public.profiles p ON p.id = ac.profile_id
  WHERE ac.token = p_token
$$;

GRANT EXECUTE ON FUNCTION public.get_consent_by_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can create appointment consents on insert" ON public.appointment_consents;
CREATE POLICY "Public can create appointment consents on insert" ON public.appointment_consents
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_active_profile(profile_id)
    AND (
      (appointment_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = appointment_consents.appointment_id
          AND a.profile_id = appointment_consents.profile_id
      ))
      OR (appointment_id IS NULL AND referral_id IS NOT NULL)
    )
  );