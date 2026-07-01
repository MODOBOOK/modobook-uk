CREATE OR REPLACE FUNCTION public.is_linked_to_practitioner_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.hub_links hl
      ON hl.status = 'accepted'::public.hub_link_status
     AND (
       (hl.requester_user_id = auth.uid() AND hl.recipient_user_id = p.user_id)
       OR
       (hl.recipient_user_id = auth.uid() AND hl.requester_user_id = p.user_id)
     )
    WHERE p.id = _profile_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_linked_to_practitioner_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_linked_to_practitioner_profile(uuid) TO service_role;

DROP POLICY IF EXISTS "prescriber_request_visit_insert" ON public.prescriber_clinic_visits;

CREATE POLICY "prescriber_request_visit_insert"
ON public.prescriber_clinic_visits
FOR INSERT
TO authenticated
WITH CHECK (
  prescriber_user_id = auth.uid()
  AND created_by = 'prescriber'
  AND status = 'pending_approval'
  AND public.is_linked_to_practitioner_profile(practitioner_profile_id)
);