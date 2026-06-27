
CREATE OR REPLACE FUNCTION public.is_active_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _profile_id AND active = true);
$$;
GRANT EXECUTE ON FUNCTION public.is_active_profile(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public read active treatments" ON public.treatments;
CREATE POLICY "Public read active treatments" ON public.treatments FOR SELECT TO anon, authenticated USING (active = true AND public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Public read active packages" ON public.packages;
CREATE POLICY "Public read active packages" ON public.packages FOR SELECT TO anon, authenticated USING (active = true AND public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Public read active clinic gallery" ON public.clinic_gallery;
CREATE POLICY "Public read active clinic gallery" ON public.clinic_gallery FOR SELECT TO anon, authenticated USING (public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Public read active clinic testimonials" ON public.clinic_testimonials;
CREATE POLICY "Public read active clinic testimonials" ON public.clinic_testimonials FOR SELECT TO anon, authenticated USING (public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Public can view active locations of active profiles" ON public.locations;
CREATE POLICY "Public can view active locations of active profiles" ON public.locations FOR SELECT TO anon, authenticated USING (active = true AND public.is_active_profile(profile_id));
