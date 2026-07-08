
ALTER TABLE public.clinic_referral_settings
  ADD COLUMN IF NOT EXISTS referrer_credit_kind text NOT NULL DEFAULT 'pennies' CHECK (referrer_credit_kind IN ('pennies','percent')),
  ADD COLUMN IF NOT EXISTS referrer_credit_percent integer NOT NULL DEFAULT 10 CHECK (referrer_credit_percent >= 0 AND referrer_credit_percent <= 100),
  ADD COLUMN IF NOT EXISTS friend_credit_kind text NOT NULL DEFAULT 'pennies' CHECK (friend_credit_kind IN ('pennies','percent')),
  ADD COLUMN IF NOT EXISTS friend_credit_percent integer NOT NULL DEFAULT 10 CHECK (friend_credit_percent >= 0 AND friend_credit_percent <= 100),
  ADD COLUMN IF NOT EXISTS points_redemption_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_per_pound_redeem integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS earn_on_spend_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_per_pound_earn numeric(6,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS tiers_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.clinic_reward_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  points_cost integer NOT NULL CHECK (points_cost > 0),
  reward_kind text NOT NULL DEFAULT 'credit_pennies' CHECK (reward_kind IN ('credit_pennies','free_addon','custom')),
  reward_value integer NOT NULL DEFAULT 0,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clinic_reward_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_reward_tiers TO authenticated;
GRANT ALL ON public.clinic_reward_tiers TO service_role;

ALTER TABLE public.clinic_reward_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reward tiers" ON public.clinic_reward_tiers;
CREATE POLICY "Anyone can view reward tiers"
  ON public.clinic_reward_tiers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Clinic manages own reward tiers" ON public.clinic_reward_tiers;
CREATE POLICY "Clinic manages own reward tiers"
  ON public.clinic_reward_tiers FOR ALL
  TO authenticated
  USING (auth.uid() = clinic_profile_id)
  WITH CHECK (auth.uid() = clinic_profile_id);

CREATE INDEX IF NOT EXISTS idx_clinic_reward_tiers_clinic ON public.clinic_reward_tiers(clinic_profile_id, sort_order);

DROP TRIGGER IF EXISTS trg_clinic_reward_tiers_updated_at ON public.clinic_reward_tiers;
CREATE TRIGGER trg_clinic_reward_tiers_updated_at
  BEFORE UPDATE ON public.clinic_reward_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
