
DROP TRIGGER IF EXISTS trg_create_appointment_medical_forms ON public.appointments;
DROP TRIGGER IF EXISTS trg_schedule_aftercare ON public.appointments;

-- Deduplicate: keep the row with the smallest id per (appointment_id, template_id)
DELETE FROM public.appointment_medical_forms a
USING public.appointment_medical_forms b
WHERE a.appointment_id = b.appointment_id
  AND a.template_id = b.template_id
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS appt_medforms_unique_appt_template
  ON public.appointment_medical_forms (appointment_id, template_id);

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
  SELECT profile_id INTO v_profile_id FROM public.clinic_clients WHERE clinic_clients.id = p_client_id;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  PERFORM 1 FROM public.consent_templates ct
   WHERE ct.id = p_template_id AND (ct.is_system = true OR ct.profile_id = v_profile_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not accessible'; END IF;

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
  WHERE ac.client_id = p_client_id
     OR ac.appointment_id IN (
       SELECT a.id FROM public.appointments a
       JOIN public.clinic_clients cc ON cc.profile_id = a.profile_id
         AND lower(cc.email) = lower(a.patient_email)
       WHERE cc.id = p_client_id
     )
  ORDER BY ac.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_consents_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_consents_for_client(uuid) TO authenticated;
