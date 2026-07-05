ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cash_only_balance boolean NOT NULL DEFAULT false;