DROP POLICY IF EXISTS "Public can create appointment consents on insert" ON public.appointment_consents;

CREATE POLICY "Public can create appointment consents on insert" ON public.appointment_consents
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_active_profile(profile_id)
    AND appointment_id IS NOT NULL
    AND referral_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_consents.appointment_id
        AND a.profile_id = appointment_consents.profile_id
    )
  );