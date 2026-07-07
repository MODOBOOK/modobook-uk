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
  WITH client AS (
    SELECT cc.*
    FROM public.clinic_clients cc
    WHERE cc.id = p_client_id
      AND public.is_profile_owner(cc.profile_id)
  )
  SELECT DISTINCT ON (ac.id)
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
  JOIN client c ON c.profile_id = ac.profile_id
  LEFT JOIN public.appointments a ON a.id = ac.appointment_id
  WHERE ac.client_id = c.id
     OR (
       ac.client_id IS NULL
       AND a.id IS NOT NULL
       AND a.profile_id = c.profile_id
       AND (
         (c.email IS NOT NULL AND a.patient_email IS NOT NULL AND lower(c.email) = lower(a.patient_email))
         OR (c.email IS NULL AND a.patient_name IS NOT NULL AND lower(c.full_name) = lower(a.patient_name))
       )
     )
  ORDER BY ac.id, ac.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_consents_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_consents_for_client(uuid) TO authenticated;

DROP POLICY IF EXISTS "Practitioners create client consent requests" ON public.appointment_consents;
CREATE POLICY "Practitioners create client consent requests"
ON public.appointment_consents
FOR INSERT
TO authenticated
WITH CHECK (
  appointment_id IS NULL
  AND referral_id IS NULL
  AND client_id IS NOT NULL
  AND public.is_profile_owner(profile_id)
  AND EXISTS (
    SELECT 1
    FROM public.clinic_clients cc
    WHERE cc.id = appointment_consents.client_id
      AND cc.profile_id = appointment_consents.profile_id
  )
);

DROP POLICY IF EXISTS "Users can insert communications for own clients" ON public.client_communications;
DROP POLICY IF EXISTS "Practitioners add communications for own clients" ON public.client_communications;
CREATE POLICY "Practitioners add communications for own clients"
ON public.client_communications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_profile_owner(profile_id)
  AND EXISTS (
    SELECT 1
    FROM public.clinic_clients cc
    WHERE cc.id = client_communications.client_id
      AND cc.profile_id = client_communications.profile_id
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_communications TO authenticated;
GRANT ALL ON public.appointment_consents TO service_role;
GRANT ALL ON public.client_communications TO service_role;