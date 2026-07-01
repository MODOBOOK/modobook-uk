
REVOKE EXECUTE ON FUNCTION public.create_walk_in_referral(UUID, TEXT, TEXT, TEXT, DATE, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_walk_in_to_practitioner(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_walk_in_as_practitioner(UUID, TEXT) FROM PUBLIC, anon;
