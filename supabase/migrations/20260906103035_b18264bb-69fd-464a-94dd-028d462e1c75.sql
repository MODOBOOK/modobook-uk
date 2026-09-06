CREATE POLICY "Owners manage own email_customizations" ON public.email_customizations
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));