ALTER TABLE public.treatment_plans
  ADD COLUMN IF NOT EXISTS discount_cents integer,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2);

ALTER TABLE public.treatment_plan_sessions
  ADD COLUMN IF NOT EXISTS price_cents_override integer;