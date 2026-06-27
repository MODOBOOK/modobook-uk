ALTER TABLE public.treatment_addons
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NULL;