CREATE OR REPLACE FUNCTION public.increment_package_claim(p_package_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.packages
     SET limited_claimed = COALESCE(limited_claimed, 0) + 1
   WHERE id = p_package_id AND is_limited = true;
$$;

REVOKE ALL ON FUNCTION public.increment_package_claim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_package_claim(uuid) TO service_role;