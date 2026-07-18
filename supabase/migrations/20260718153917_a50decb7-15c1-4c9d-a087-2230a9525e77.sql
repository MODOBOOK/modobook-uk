
-- 1. subscription_plans: add kind + default_trial_days
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS default_trial_days integer NOT NULL DEFAULT 30;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_kind_check') THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_kind_check
      CHECK (kind IN ('base','addon_location','addon_practitioner'));
  END IF;
END $$;

-- 2. platform_discount_codes
CREATE TABLE IF NOT EXISTS public.platform_discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  percent_off integer,
  amount_off_cents integer,
  currency text NOT NULL DEFAULT 'gbp',
  duration text NOT NULL DEFAULT 'once',
  duration_in_months integer,
  max_redemptions integer,
  redemptions integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  stripe_coupon_id text,
  stripe_promo_code_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (duration IN ('once','forever','repeating')),
  CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  CHECK (percent_off IS NOT NULL OR amount_off_cents IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_discount_codes TO authenticated;
GRANT ALL ON public.platform_discount_codes TO service_role;

ALTER TABLE public.platform_discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage discount codes" ON public.platform_discount_codes;
CREATE POLICY "Admins manage discount codes" ON public.platform_discount_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Practitioners can look up an active code by name via a security-definer fn (not raw SELECT).
CREATE OR REPLACE FUNCTION public.lookup_active_discount_code(_code text)
RETURNS TABLE (id uuid, code text, description text, percent_off int, amount_off_cents int, currency text, duration text, duration_in_months int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, code, description, percent_off, amount_off_cents, currency, duration, duration_in_months
  FROM public.platform_discount_codes
  WHERE lower(code) = lower(_code)
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_redemptions IS NULL OR redemptions < max_redemptions)
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.lookup_active_discount_code(text) TO authenticated;

CREATE TRIGGER trg_platform_discount_codes_updated_at
BEFORE UPDATE ON public.platform_discount_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. practitioner_subscriptions: extra columns
ALTER TABLE public.practitioner_subscriptions
  ADD COLUMN IF NOT EXISTS trial_end timestamptz,
  ADD COLUMN IF NOT EXISTS custom_price_cents integer,
  ADD COLUMN IF NOT EXISTS extra_locations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_practitioners integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_code_id uuid REFERENCES public.platform_discount_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_addon_items jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Access-check helper
CREATE OR REPLACE FUNCTION public.practitioner_has_platform_access(_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN ps.suspended_at IS NOT NULL THEN false
          WHEN ps.comped THEN true
          WHEN ps.status IN ('active','trialing') THEN true
          WHEN ps.trial_end IS NOT NULL AND ps.trial_end > now() THEN true
          ELSE false
        END
      FROM public.practitioner_subscriptions ps
      WHERE ps.profile_id = _profile_id
      LIMIT 1
    ),
    -- No row yet: fall back to a 30-day grace from profile creation.
    (
      SELECT (p.created_at + interval '30 days') > now()
      FROM public.profiles p
      WHERE p.id = _profile_id
    ),
    false
  )
$$;
GRANT EXECUTE ON FUNCTION public.practitioner_has_platform_access(uuid) TO authenticated, anon;

-- 5. Auto-create trialing subscription when a new practitioner profile is inserted
CREATE OR REPLACE FUNCTION public.auto_start_platform_trial()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.practitioner_subscriptions (profile_id, status, trial_end)
  VALUES (NEW.id, 'trialing', now() + interval '30 days')
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_start_trial ON public.profiles;
CREATE TRIGGER on_profile_created_start_trial
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_start_platform_trial();

-- 6. Backfill trialing rows for existing profiles that have none
INSERT INTO public.practitioner_subscriptions (profile_id, status, trial_end)
SELECT p.id, 'trialing', now() + interval '30 days'
FROM public.profiles p
LEFT JOIN public.practitioner_subscriptions ps ON ps.profile_id = p.id
WHERE ps.id IS NULL;
