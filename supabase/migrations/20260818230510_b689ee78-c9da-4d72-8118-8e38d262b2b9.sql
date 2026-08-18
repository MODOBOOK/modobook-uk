ALTER TABLE public.training_courses
  ADD COLUMN IF NOT EXISTS handout_url text,
  ADD COLUMN IF NOT EXISTS handout_name text;