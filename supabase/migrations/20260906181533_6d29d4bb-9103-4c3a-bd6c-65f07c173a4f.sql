GRANT SELECT ON public.membership_plans TO anon;

CREATE POLICY "Public can view active plans of active profiles"
ON public.membership_plans
FOR SELECT
TO anon
USING (
  active = true
  AND public.is_active_profile(profile_id)
);
