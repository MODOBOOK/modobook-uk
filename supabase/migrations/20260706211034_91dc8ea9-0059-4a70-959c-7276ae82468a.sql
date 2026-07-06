
CREATE OR REPLACE FUNCTION public.is_clinic_client_for_user(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_clients cc, auth.users u
    WHERE cc.id = _client_id
      AND u.id = auth.uid()
      AND (
        lower(cc.email) = lower(u.email)
        OR cc.phone = (u.raw_user_meta_data ->> 'phone')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_clinic_client_for_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "patient reads own plans" ON public.treatment_plans;
CREATE POLICY "patient reads own plans"
ON public.treatment_plans
FOR SELECT
TO authenticated
USING (public.is_clinic_client_for_user(client_id));

DROP POLICY IF EXISTS "patient reads own plan sessions" ON public.treatment_plan_sessions;
CREATE POLICY "patient reads own plan sessions"
ON public.treatment_plan_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans p
    WHERE p.id = treatment_plan_sessions.plan_id
      AND public.is_clinic_client_for_user(p.client_id)
  )
);
