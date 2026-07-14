ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS deposit_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_deposit_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_deposit_type_check CHECK (deposit_type IN ('fixed','percent'));