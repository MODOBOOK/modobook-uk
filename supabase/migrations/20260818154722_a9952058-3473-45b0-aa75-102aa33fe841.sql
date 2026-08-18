
-- Restrict the public review read policy to anonymous readers only; owners and
-- patients keep their own dedicated policies.
DROP POLICY IF EXISTS "Public reads approved reviews for active profiles" ON public.patient_reviews;
CREATE POLICY "Public reads approved reviews for active profiles"
ON public.patient_reviews FOR SELECT TO anon
USING (approved = true AND is_active_profile(profile_id));

-- Column-level grants: anon can never read reviewer_email.
REVOKE SELECT ON public.patient_reviews FROM anon;
GRANT SELECT (id, profile_id, patient_id, appointment_id, rating, title, body, approved, created_at, updated_at, reviewer_name)
  ON public.patient_reviews TO anon;
GRANT INSERT ON public.patient_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_reviews TO authenticated;
GRANT ALL ON public.patient_reviews TO service_role;
