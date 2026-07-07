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
  SELECT *
  FROM (
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
      ac.consent_template_id AS template_id,
      ct.name AS template_name
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
           OR (
             a.patient_name IS NOT NULL
             AND lower(c.full_name) = lower(a.patient_name)
             AND (
               c.email IS NULL
               OR a.patient_email IS NULL
               OR lower(c.email) = lower(a.patient_email)
             )
           )
         )
       )
    ORDER BY ac.id, ac.created_at DESC
  ) matched
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_consents_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_consents_for_client(uuid) TO authenticated;