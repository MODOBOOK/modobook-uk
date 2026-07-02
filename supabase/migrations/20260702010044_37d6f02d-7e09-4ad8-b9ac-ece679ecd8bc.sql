
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_surcharge_card_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_surcharge_card_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_surcharge_bnpl_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_surcharge_bnpl_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_surcharge_deposit_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_surcharge_deposit_percent numeric(5,2) NOT NULL DEFAULT 0;
