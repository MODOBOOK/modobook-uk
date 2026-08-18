ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coming_soon_label text;

ALTER TABLE public.availability_rules
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;