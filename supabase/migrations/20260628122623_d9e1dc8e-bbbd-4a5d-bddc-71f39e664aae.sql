DROP POLICY IF EXISTS "Public can create appointment consents on insert" ON public.appointment_consents;
CREATE POLICY "Public can create appointment consents on insert" ON public.appointment_consents
  FOR INSERT WITH CHECK (
    is_active_profile(profile_id)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_consents.appointment_id
        AND a.profile_id = appointment_consents.profile_id
    )
  );