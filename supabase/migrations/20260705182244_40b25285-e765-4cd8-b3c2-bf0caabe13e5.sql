
CREATE OR REPLACE FUNCTION public.get_rota_anchor(p_profile_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rota_anchor_date FROM public.profiles WHERE id = p_profile_id
$$;

REVOKE ALL ON FUNCTION public.get_rota_anchor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rota_anchor(uuid) TO anon, authenticated, service_role;
