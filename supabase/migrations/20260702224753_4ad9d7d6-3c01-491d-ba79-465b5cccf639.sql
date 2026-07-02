DROP POLICY IF EXISTS "Public can view active practitioners" ON public.practitioners;

CREATE POLICY "Public can view active practitioners"
  ON public.practitioners
  FOR SELECT
  TO anon, authenticated
  USING (active = true AND public.is_active_profile(profile_id));