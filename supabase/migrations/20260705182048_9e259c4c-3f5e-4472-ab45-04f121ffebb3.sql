
ALTER TABLE public.availability_rules
  ADD COLUMN IF NOT EXISTS cycle_length smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS weeks_mask smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS practitioner_id uuid NULL REFERENCES public.practitioners(id) ON DELETE SET NULL;

-- Sanity: cycle_length must be 1, 2, or 4; weeks_mask must be > 0 and fit in cycle
ALTER TABLE public.availability_rules
  DROP CONSTRAINT IF EXISTS availability_rules_cycle_length_check,
  DROP CONSTRAINT IF EXISTS availability_rules_weeks_mask_check;

ALTER TABLE public.availability_rules
  ADD CONSTRAINT availability_rules_cycle_length_check
    CHECK (cycle_length IN (1, 2, 4)),
  ADD CONSTRAINT availability_rules_weeks_mask_check
    CHECK (weeks_mask > 0 AND weeks_mask < (1 << cycle_length));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rota_anchor_date date NULL;
