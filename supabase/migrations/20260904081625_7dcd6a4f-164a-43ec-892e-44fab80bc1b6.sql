REVOKE EXECUTE ON FUNCTION public.ensure_practitioner_referral_code(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_practitioner_referral(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qualify_practitioner_referral(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_practitioner_referral_code(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_practitioner_referral(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.qualify_practitioner_referral(uuid) TO service_role;