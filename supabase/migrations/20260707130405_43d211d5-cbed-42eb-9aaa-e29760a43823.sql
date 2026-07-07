DROP FUNCTION IF EXISTS public.get_consent_by_token(text);

CREATE FUNCTION public.get_consent_by_token(p_token text)
RETURNS TABLE(
  consent_id uuid,
  appointment_id uuid,
  status text,
  template_name text,
  template_body text,
  template_sections jsonb,
  template_summary text,
  requires_signature boolean,
  patient_name text,
  scheduled_date date,
  start_time time without time zone,
  treatment_name text,
  clinic_name text,
  slug text,
  signature_name text,
  signature_data text,
  signed_at timestamptz,
  signed_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ac.id,
         ac.appointment_id,
         ac.status,
         ct.name,
         ct.body_markdown,
         ct.sections,
         ct.summary,
         ct.requires_signature,
         COALESCE(a.patient_name, pr.patient_name, cc.full_name)::text,
         a.scheduled_date,
         a.start_time,
         COALESCE(t.name, 'Walk-in consultation')::text,
         p.clinic_name,
         p.slug,
         ac.signature_name,
         ac.signature_data,
         ac.signed_at,
         ac.signed_url
  FROM public.appointment_consents ac
  JOIN public.consent_templates ct ON ct.id = ac.consent_template_id
  LEFT JOIN public.appointments a ON a.id = ac.appointment_id
  LEFT JOIN public.treatments t ON t.id = a.treatment_id
  LEFT JOIN public.prescriber_referrals pr ON pr.id = ac.referral_id
  LEFT JOIN public.clinic_clients cc ON cc.id = ac.client_id
  JOIN public.profiles p ON p.id = ac.profile_id
  WHERE ac.token = p_token;
$$;

REVOKE EXECUTE ON FUNCTION public.get_consent_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_consent_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_consent_to_client(
  p_client_id uuid,
  p_template_id uuid
) RETURNS TABLE(id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_new_id uuid;
  v_token text;
BEGIN
  SELECT cc.profile_id INTO v_profile_id
  FROM public.clinic_clients cc
  WHERE cc.id = p_client_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  IF NOT public.is_profile_owner(v_profile_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  PERFORM 1
  FROM public.consent_templates ct
  WHERE ct.id = p_template_id
    AND (ct.is_system = true OR ct.profile_id = v_profile_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not accessible';
  END IF;

  INSERT INTO public.appointment_consents (profile_id, consent_template_id, client_id, status)
  VALUES (v_profile_id, p_template_id, p_client_id, 'pending')
  RETURNING appointment_consents.id, appointment_consents.token
  INTO v_new_id, v_token;

  RETURN QUERY SELECT v_new_id, v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_consent_to_client(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_consent_to_client(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_consents_for_client(p_client_id uuid)
RETURNS TABLE(
  id uuid,
  token text,
  status text,
  signed_at timestamptz,
  signature_name text,
  created_at timestamptz,
  appointment_id uuid,
  template_id uuid,
  template_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ac.id,
    ac.token,
    ac.status,
    ac.signed_at,
    ac.signature_name,
    ac.created_at,
    ac.appointment_id,
    ac.consent_template_id,
    ct.name
  FROM public.appointment_consents ac
  JOIN public.consent_templates ct ON ct.id = ac.consent_template_id
  WHERE EXISTS (
      SELECT 1
      FROM public.clinic_clients owner_client
      WHERE owner_client.id = p_client_id
        AND public.is_profile_owner(owner_client.profile_id)
    )
    AND (
      ac.client_id = p_client_id
      OR ac.appointment_id IN (
        SELECT a.id
        FROM public.appointments a
        JOIN public.clinic_clients cc ON cc.profile_id = a.profile_id
          AND lower(cc.email) = lower(a.patient_email)
        WHERE cc.id = p_client_id
      )
    )
  ORDER BY ac.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_consents_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_consents_for_client(uuid) TO authenticated;