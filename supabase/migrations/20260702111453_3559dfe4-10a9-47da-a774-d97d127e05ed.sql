
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_oauth_state text,
  ADD COLUMN IF NOT EXISTS stripe_oauth_state_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_connect_type text;

CREATE INDEX IF NOT EXISTS profiles_stripe_oauth_state_idx
  ON public.profiles (stripe_oauth_state)
  WHERE stripe_oauth_state IS NOT NULL;
