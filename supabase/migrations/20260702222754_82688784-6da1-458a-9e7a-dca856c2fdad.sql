
-- 1) Fix quiz_responses practitioner-scoped policies to use is_profile_owner()
DROP POLICY IF EXISTS "Practitioners read own quiz responses" ON public.quiz_responses;
DROP POLICY IF EXISTS "Practitioners delete own quiz responses" ON public.quiz_responses;

CREATE POLICY "Practitioners read own quiz responses"
  ON public.quiz_responses FOR SELECT
  TO authenticated
  USING (public.is_profile_owner(profile_id));

CREATE POLICY "Practitioners delete own quiz responses"
  ON public.quiz_responses FOR DELETE
  TO authenticated
  USING (public.is_profile_owner(profile_id));

-- 2) Allow patients to read their own signed consent uploads
DROP POLICY IF EXISTS "Patients read own signed consents" ON storage.objects;

CREATE POLICY "Patients read own signed consents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-uploads'
    AND EXISTS (
      SELECT 1
      FROM public.appointment_consents ac
      JOIN public.patient_accounts pa ON pa.client_id = ac.client_id
      WHERE pa.user_id = auth.uid()
        AND ac.signed_url IS NOT NULL
        AND ac.signed_url LIKE '%' || storage.objects.name || '%'
    )
  );
