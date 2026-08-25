REVOKE EXECUTE ON FUNCTION public.ensure_patient_referral_code(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_patient_referral_code(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_patient_referral_code_on_account() FROM PUBLIC, anon, authenticated;