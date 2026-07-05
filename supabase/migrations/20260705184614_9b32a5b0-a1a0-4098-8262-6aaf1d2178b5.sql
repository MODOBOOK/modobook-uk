
REVOKE EXECUTE ON FUNCTION public.is_clinic_owner(UUID) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_clinic_staff(UUID) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_clinic_member(UUID) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_clinic_role(UUID, public.staff_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_clinic_profile_id() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_clinic_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_clinic_role(UUID, public.staff_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_clinic_profile_id() TO authenticated;
