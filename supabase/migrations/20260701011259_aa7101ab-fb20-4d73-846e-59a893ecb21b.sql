
-- Walk-in: reuse existing patient by email, and enrich full-record view for walk-ins

CREATE OR REPLACE FUNCTION public.create_walk_in_referral(
  p_practitioner_profile_id uuid,
  p_patient_name text,
  p_patient_email text DEFAULT NULL,
  p_patient_phone text DEFAULT NULL,
  p_patient_dob date DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_practitioner_user UUID;
  v_id UUID;
  v_client UUID := p_client_id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT user_id INTO v_practitioner_user FROM public.profiles WHERE id = p_practitioner_profile_id;
  IF v_practitioner_user IS NULL THEN RAISE EXCEPTION 'Practitioner not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.hub_links
     WHERE status = 'accepted'
       AND ((requester_user_id = auth.uid() AND recipient_user_id = v_practitioner_user)
         OR (recipient_user_id = auth.uid() AND requester_user_id = v_practitioner_user))
  ) THEN
    RAISE EXCEPTION 'You are not linked to this practitioner';
  END IF;

  -- Match existing client on this practitioner's books by email
  IF v_client IS NULL AND p_patient_email IS NOT NULL AND length(trim(p_patient_email)) > 0 THEN
    SELECT id INTO v_client FROM public.clinic_clients
      WHERE profile_id = p_practitioner_profile_id
        AND lower(email) = lower(trim(p_patient_email))
      LIMIT 1;
  END IF;

  -- Only fill blank fields on the existing client — never overwrite practitioner data
  IF v_client IS NOT NULL THEN
    UPDATE public.clinic_clients SET
      full_name = COALESCE(NULLIF(full_name,''), p_patient_name),
      phone = COALESCE(NULLIF(phone,''), p_patient_phone),
      dob = COALESCE(dob, p_patient_dob),
      updated_at = now()
    WHERE id = v_client AND profile_id = p_practitioner_profile_id;
  END IF;

  INSERT INTO public.prescriber_referrals(
    practitioner_profile_id, prescriber_user_id, treatment_id, appointment_id, client_id,
    patient_name, patient_email, patient_phone, patient_dob,
    routing, status, is_walk_in, walk_in_note, awaiting_practitioner_close,
    consent_given_at, accepted_at
  ) VALUES (
    p_practitioner_profile_id, auth.uid(), NULL, NULL, v_client,
    p_patient_name, p_patient_email, p_patient_phone, p_patient_dob,
    'walk_in', 'accepted', true, p_note, false,
    now(), now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- Enrich the referral full view: for walk-ins (no appointment), pull the linked
-- client's medical forms across all their appointments and their stored medical_form_data.
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
  ELSIF v_ref.appointment_id IS NOT NULL AND v_ref.patient_email IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_client FROM public.clinic_clients c
      WHERE c.profile_id = v_ref.practitioner_profile_id AND lower(c.email) = lower(v_ref.patient_email) LIMIT 1;
  ELSIF v_ref.patient_email IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_client FROM public.clinic_clients c
      WHERE c.profile_id = v_ref.practitioner_profile_id AND lower(c.email) = lower(v_ref.patient_email) LIMIT 1;
  END IF;

  -- Medical forms: prefer the appointment; otherwise pull all forms for this client
  IF v_ref.appointment_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', amf.id, 'template_name', mft.name, 'response', amf.response,
      'submitted_at', amf.submitted_at, 'status', amf.status
    )), '[]'::jsonb)
      INTO v_forms
      FROM public.appointment_medical_forms amf
      JOIN public.medical_form_templates mft ON mft.id = amf.template_id
      WHERE amf.appointment_id = v_ref.appointment_id;
  ELSIF v_client IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', amf.id, 'template_name', mft.name, 'response', amf.response,
      'submitted_at', amf.submitted_at, 'status', amf.status
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

  -- Consents: pull for this client's appointments on this practitioner
  IF v_client IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', ac.id, 'template_name', ct.name, 'status', ac.status,
      'signed_at', ac.signed_at, 'signature_name', ac.signature_name
    ) ORDER BY ac.signed_at DESC NULLS LAST, ac.created_at DESC), '[]'::jsonb)
      INTO v_consents
      FROM public.appointment_consents ac
      JOIN public.consent_templates ct ON ct.id = ac.consent_template_id
      JOIN public.appointments a ON a.id = ac.appointment_id
      WHERE ac.profile_id = v_ref.practitioner_profile_id
        AND (
          (v_ref.patient_email IS NOT NULL AND lower(COALESCE(a.patient_email,'')) = lower(v_ref.patient_email))
          OR lower(COALESCE(a.patient_name,'')) = lower(v_ref.patient_name)
        );
  END IF;

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
