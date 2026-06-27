GRANT EXECUTE ON FUNCTION public.is_profile_owner(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_slug_available(text, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_object_owner(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_profile_path(text) TO authenticated, anon, service_role;