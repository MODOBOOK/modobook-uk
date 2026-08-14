ALTER TABLE public.practitioner_subscriptions
  ADD COLUMN IF NOT EXISTS waive_associates_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_associates integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount_cents integer NOT NULL DEFAULT 0;