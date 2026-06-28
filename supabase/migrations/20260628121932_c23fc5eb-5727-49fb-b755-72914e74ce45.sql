DROP POLICY IF EXISTS "Public can view themes of active profiles" ON public.clinic_theme;
CREATE POLICY "Public can view themes of active profiles"
ON public.clinic_theme
FOR SELECT
TO anon, authenticated
USING (public.is_active_profile(profile_id));