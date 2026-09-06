ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS treatment_frequency_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_commitment_months integer NOT NULL DEFAULT 0;