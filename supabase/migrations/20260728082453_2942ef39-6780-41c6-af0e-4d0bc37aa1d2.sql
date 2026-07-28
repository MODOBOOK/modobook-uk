CREATE OR REPLACE FUNCTION public.get_public_rewards_by_slug(p_slug text)
RETURNS TABLE (clinic_profile_id uuid, slug text, clinic_name text, settings jsonb, tiers jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.slug,
    COALESCE(p.clinic_name, p.full_name, 'Clinic'),
    to_jsonb(s.*),
    COALESCE((
      SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.sort_order, t.points_cost)
      FROM public.clinic_reward_tiers t
      WHERE t.clinic_profile_id = p.user_id AND t.enabled = true
    ), '[]'::jsonb)
  FROM public.profiles p
  JOIN public.clinic_referral_settings s ON s.clinic_profile_id = p.user_id
  WHERE lower(p.slug) = lower(p_slug) AND s.enabled = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_rewards_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_rewards_by_slug(text) TO anon, authenticated, service_role;