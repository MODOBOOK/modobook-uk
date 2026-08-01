CREATE OR REPLACE FUNCTION public.is_active_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _profile_id AND p.active = true)
$$;

REVOKE ALL ON FUNCTION public.is_active_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_profile(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anon writes public review pending moderation" ON public.patient_reviews;
CREATE POLICY "Anon writes public review pending moderation"
ON public.patient_reviews FOR INSERT TO anon, authenticated
WITH CHECK (
  patient_id IS NULL
  AND approved = false
  AND reviewer_name IS NOT NULL
  AND length(btrim(reviewer_name)) BETWEEN 1 AND 100
  AND length(btrim(body)) BETWEEN 1 AND 2000
  AND rating BETWEEN 1 AND 5
  AND public.is_active_profile(profile_id)
);

GRANT INSERT ON public.patient_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_reviews TO authenticated;
GRANT SELECT ON public.patient_reviews TO anon;
GRANT ALL ON public.patient_reviews TO service_role;