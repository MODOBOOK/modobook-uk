-- 1. Hide locations.phone from anonymous (public) Data API reads
REVOKE SELECT (phone) ON public.locations FROM anon;

-- 2. Restrict treatment_consents public read to active practitioner profiles
DROP POLICY IF EXISTS "Public read treatment consents" ON public.treatment_consents;
CREATE POLICY "Public read treatment consents for active profiles"
  ON public.treatment_consents
  FOR SELECT
  USING (public.is_active_profile(profile_id));

-- 3. Lock down SECURITY DEFINER function execution — revoke broad PUBLIC
--    grants then re-grant only to the roles that actually need them.

-- Trigger-only helper: no role needs direct EXECUTE
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Slug availability check is only used by signed-in practitioners
REVOKE EXECUTE ON FUNCTION public.is_slug_available(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_slug_available(text, uuid) TO authenticated;

-- RLS / storage helpers: revoke PUBLIC, keep explicit grants for anon + authenticated
-- (they are evaluated inside RLS policies so both calling roles need EXECUTE)
REVOKE EXECUTE ON FUNCTION public.is_profile_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profile_owner(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_profile(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_profile_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_profile_path(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_object_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_object_owner(text) TO anon, authenticated;

-- Public-facing RPCs: explicit anon + authenticated grants
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_consent_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_consent_by_token(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_consent(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_consent(text, text, text) TO anon, authenticated;