ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS payout_mode text NOT NULL DEFAULT 'clinic',
  ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_account_status text,
  ADD COLUMN IF NOT EXISTS stripe_oauth_state text,
  ADD COLUMN IF NOT EXISTS stripe_oauth_state_expires_at timestamptz;

ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_payout_mode_check;
ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_payout_mode_check
  CHECK (payout_mode IN ('clinic', 'own_account'));

ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_commission_percent_check;
ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_commission_percent_check
  CHECK (commission_percent >= 0 AND commission_percent <= 100);

CREATE UNIQUE INDEX IF NOT EXISTS staff_members_stripe_oauth_state_idx
  ON public.staff_members (stripe_oauth_state)
  WHERE stripe_oauth_state IS NOT NULL;