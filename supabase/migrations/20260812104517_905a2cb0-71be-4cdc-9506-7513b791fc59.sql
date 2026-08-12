CREATE POLICY "Practitioners delete their appointment consents"
ON public.appointment_consents
FOR DELETE
TO authenticated
USING (public.is_profile_owner(profile_id));