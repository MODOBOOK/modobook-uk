REVOKE EXECUTE ON FUNCTION public.claim_email_slots(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_slots(integer) TO service_role;