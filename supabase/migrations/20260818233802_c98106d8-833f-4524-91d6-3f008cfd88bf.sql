ALTER TABLE public.training_courses
  ADD COLUMN IF NOT EXISTS day_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS days_consecutive boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS day_duration_min integer;

UPDATE public.training_courses
SET day_duration_min = duration_min
WHERE day_duration_min IS NULL;