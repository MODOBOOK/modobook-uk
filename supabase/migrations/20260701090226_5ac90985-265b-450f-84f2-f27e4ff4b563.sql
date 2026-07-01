CREATE POLICY "Linked party can read prescriber profile"
ON public.prescriber_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hub_links hl
    WHERE hl.status = 'accepted'
      AND (
        (hl.requester_user_id = auth.uid() AND hl.recipient_user_id = prescriber_profiles.user_id)
        OR (hl.recipient_user_id = auth.uid() AND hl.requester_user_id = prescriber_profiles.user_id)
      )
  )
);