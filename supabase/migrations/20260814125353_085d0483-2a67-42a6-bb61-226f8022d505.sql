CREATE OR REPLACE FUNCTION public.is_clinic_client_for_user(_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_clients cc
    JOIN auth.users u ON u.id = auth.uid()
    WHERE cc.id = _client_id
      AND cc.email IS NOT NULL
      AND u.email IS NOT NULL
      AND lower(cc.email) = lower(u.email)
  )
  OR EXISTS (
    SELECT 1
    FROM public.patient_accounts pa
    WHERE pa.client_id = _client_id
      AND pa.user_id = auth.uid()
  );
$function$;