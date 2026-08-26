-- training_pages: only active clinics publicly readable
DROP POLICY IF EXISTS "Training page content is public" ON public.training_pages;
CREATE POLICY "Training page content is public"
ON public.training_pages FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = training_pages.profile_id AND p.active = true));

-- treatment_medical_forms: scope to active treatments of active clinics
DROP POLICY IF EXISTS "Anyone can read treatment form links" ON public.treatment_medical_forms;
CREATE POLICY "Anyone can read treatment form links"
ON public.treatment_medical_forms FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.treatments t
  JOIN public.profiles p ON p.id = t.profile_id
  WHERE t.id = treatment_medical_forms.treatment_id AND t.active = true AND p.active = true
));

-- treatment_addons: allow authenticated patients same scoped read
DROP POLICY IF EXISTS "Public read active treatment add-ons" ON public.treatment_addons;
CREATE POLICY "Public read active treatment add-ons"
ON public.treatment_addons FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.treatments t
  JOIN public.profiles p ON p.id = t.profile_id
  WHERE t.id = treatment_addons.treatment_id AND t.active = true AND p.active = true
));

-- prescriber_referrals: ensure practitioner writes are ownership-scoped and prescriber assignment cannot be spoofed on insert
DROP POLICY IF EXISTS "practitioner manages own referrals" ON public.prescriber_referrals;
CREATE POLICY "practitioner manages own referrals"
ON public.prescriber_referrals FOR ALL TO authenticated
USING (public.is_profile_owner(practitioner_profile_id))
WITH CHECK (public.is_profile_owner(practitioner_profile_id));

GRANT SELECT ON public.training_pages TO anon, authenticated;
GRANT SELECT ON public.treatment_medical_forms TO anon, authenticated;
GRANT SELECT ON public.treatment_addons TO anon, authenticated;