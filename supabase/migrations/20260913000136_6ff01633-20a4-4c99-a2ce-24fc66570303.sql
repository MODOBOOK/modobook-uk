DROP POLICY IF EXISTS "Patients view active plans" ON public.membership_plans;
CREATE POLICY "Patients view active plans" ON public.membership_plans
FOR SELECT TO authenticated
USING (active = true AND public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Public can view training categories" ON public.treatment_categories;
CREATE POLICY "Public can view training categories" ON public.treatment_categories
FOR SELECT TO anon, authenticated
USING (kind = 'training' AND public.is_active_profile(profile_id));