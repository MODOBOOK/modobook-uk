ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric;

ALTER TABLE public.addons
  DROP CONSTRAINT IF EXISTS addons_discount_percent_range,
  ADD CONSTRAINT addons_discount_percent_range CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));

ALTER TABLE public.addons
  DROP CONSTRAINT IF EXISTS addons_discount_amount_nonnegative,
  ADD CONSTRAINT addons_discount_amount_nonnegative CHECK (discount_amount IS NULL OR discount_amount >= 0);