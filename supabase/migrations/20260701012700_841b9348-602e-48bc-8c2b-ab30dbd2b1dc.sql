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

  IF v_ref.appointment_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', amf.id, 'template_name', mft.name, 'response', amf.response,
      'submitted_at', amf.submitted_at, 'status', amf.status,
      'sections', mft.sections
    )), '[]'::jsonb)
      INTO v_forms
      FROM public.appointment_medical_forms amf
      JOIN public.medical_form_templates mft ON mft.id = amf.template_id
      WHERE amf.appointment_id = v_ref.appointment_id;
  ELSIF v_client IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', amf.id, 'template_name', mft.name, 'response', amf.response,
      'submitted_at', amf.submitted_at, 'status', amf.status,
      'sections', mft.sections
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

  IF v_client IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', ac.id, 'template_name', ct.name, 'status', ac.status,
      'signed_at', ac.signed_at, 'signature_name', ac.signature_name,
      'signature_data', ac.signature_data,
      'signed_url', ac.signed_url,
      'body_markdown', ct.body_markdown,
      'summary', ct.summary,
      'treatment_type', ct.treatment_type
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