ALTER TABLE public.clinic_referral_settings
  ADD COLUMN IF NOT EXISTS show_on_public_page boolean NOT NULL DEFAULT false;

-- Public read of enabled programme + tiers for the clinic's public /m/$slug page.
-- Anon is only allowed to read rows where the practitioner has opted in.
DROP POLICY IF EXISTS "Public can read enabled rewards on opt-in" ON public.clinic_referral_settings;
CREATE POLICY "Public can read enabled rewards on opt-in"
  ON public.clinic_referral_settings
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true AND show_on_public_page = true);

DROP POLICY IF EXISTS "Public can read reward tiers on opt-in" ON public.clinic_reward_tiers;
CREATE POLICY "Public can read reward tiers on opt-in"
  ON public.clinic_reward_tiers
  FOR SELECT
  TO anon, authenticated
  USING (
    enabled = true
    AND EXISTS (
      SELECT 1 FROM public.clinic_referral_settings s
      WHERE s.clinic_profile_id = clinic_reward_tiers.clinic_profile_id
        AND s.enabled = true
        AND s.show_on_public_page = true
    )
  );

GRANT SELECT ON public.clinic_referral_settings TO anon;
GRANT SELECT ON public.clinic_reward_tiers TO anon;