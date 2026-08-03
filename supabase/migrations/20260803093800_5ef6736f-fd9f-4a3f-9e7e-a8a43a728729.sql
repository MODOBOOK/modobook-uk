DROP POLICY IF EXISTS "Public reads approved reviews for active profiles" ON public.patient_reviews;
CREATE POLICY "Public reads approved reviews for active profiles"
ON public.patient_reviews FOR SELECT
USING (approved = true AND public.is_active_profile(profile_id));
GRANT SELECT ON public.patient_reviews TO anon;