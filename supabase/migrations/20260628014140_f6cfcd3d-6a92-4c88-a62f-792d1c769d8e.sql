CREATE OR REPLACE FUNCTION public.is_practitioner_owner(_practitioner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.practitioners p
    WHERE p.id = _practitioner_id
      AND public.is_profile_owner(p.profile_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_practitioner_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS "Owners manage their practitioners" ON public.practitioners;
CREATE POLICY "Owners manage their practitioners"
ON public.practitioners
FOR ALL
TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

DROP POLICY IF EXISTS "Owners manage location practitioners" ON public.location_practitioners;
CREATE POLICY "Owners manage location practitioners"
ON public.location_practitioners
FOR ALL
TO authenticated
USING (public.is_practitioner_owner(practitioner_id))
WITH CHECK (public.is_practitioner_owner(practitioner_id));