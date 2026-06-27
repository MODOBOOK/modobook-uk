
DROP POLICY IF EXISTS "Public can view categories of active clinics" ON public.treatment_categories;
CREATE POLICY "Public can view categories of active clinics" ON public.treatment_categories
  FOR SELECT TO anon, authenticated
  USING (public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Public can view pricing for available treatments" ON public.treatment_location_pricing;
CREATE POLICY "Public can view pricing for available treatments" ON public.treatment_location_pricing
  FOR SELECT TO anon, authenticated
  USING (
    available = true
    AND EXISTS (
      SELECT 1 FROM public.treatments t
      WHERE t.id = treatment_location_pricing.treatment_id
        AND public.is_active_profile(t.profile_id)
    )
  );

GRANT SELECT ON public.treatment_categories TO anon, authenticated;
GRANT SELECT ON public.treatment_location_pricing TO anon, authenticated;
