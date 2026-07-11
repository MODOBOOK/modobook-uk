
-- 1. Remove overly permissive public SELECT policies (opt-in policies remain)
DROP POLICY IF EXISTS "Anyone can view referral settings" ON public.clinic_referral_settings;
DROP POLICY IF EXISTS "Anyone can view reward tiers" ON public.clinic_reward_tiers;

-- 2. Replace anon-wide code lookup with a SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Anon can look up code for booking" ON public.patient_referral_codes;

CREATE OR REPLACE FUNCTION public.resolve_referral_code(_code text)
RETURNS TABLE (
  slug text,
  clinic_name text,
  full_name text,
  friend_credit_pennies integer,
  headline text,
  enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.slug,
         p.clinic_name,
         p.full_name,
         COALESCE(s.friend_credit_pennies, 0)::int AS friend_credit_pennies,
         s.headline,
         COALESCE(s.enabled, false) AS enabled
  FROM public.patient_referral_codes c
  JOIN public.profiles p ON p.user_id = c.clinic_profile_id
  LEFT JOIN public.clinic_referral_settings s ON s.clinic_profile_id = c.clinic_profile_id
  WHERE c.code = upper(_code)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_referral_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated, service_role;

-- 3. Harden search_path on trigger helper
ALTER FUNCTION public.tg_staff_members_updated_at() SET search_path = public;
