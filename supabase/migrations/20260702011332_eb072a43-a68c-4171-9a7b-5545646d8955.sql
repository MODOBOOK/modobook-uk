
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_fee_card_percent numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS stripe_fee_card_fixed_cents integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS stripe_fee_bnpl_percent numeric NOT NULL DEFAULT 5.4,
  ADD COLUMN IF NOT EXISTS stripe_fee_bnpl_fixed_cents integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS stripe_fee_pass_to_patient boolean NOT NULL DEFAULT false;
