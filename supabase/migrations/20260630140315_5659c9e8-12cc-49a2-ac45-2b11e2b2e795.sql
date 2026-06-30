DROP POLICY IF EXISTS "Practitioner moderates reviews" ON public.patient_reviews;
CREATE POLICY "Practitioner moderates reviews"
  ON public.patient_reviews FOR UPDATE
  TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

DROP POLICY IF EXISTS "Patient updates own review" ON public.patient_reviews;
CREATE POLICY "Patient updates own review"
  ON public.patient_reviews FOR UPDATE
  TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()))
  WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));