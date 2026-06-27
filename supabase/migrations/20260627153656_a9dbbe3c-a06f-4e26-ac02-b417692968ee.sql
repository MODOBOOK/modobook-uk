REVOKE EXECUTE ON FUNCTION public.get_appointment_by_manage_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_manage_token(text) TO anon, authenticated;