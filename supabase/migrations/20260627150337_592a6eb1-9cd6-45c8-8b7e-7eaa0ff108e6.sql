
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS treatment_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS image_url text;
