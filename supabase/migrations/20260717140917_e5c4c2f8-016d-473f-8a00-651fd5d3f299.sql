-- Add scheduling_mode to training_courses
DO $$ BEGIN
  CREATE TYPE public.training_scheduling_mode AS ENUM ('fixed','availability');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.training_courses
  ADD COLUMN IF NOT EXISTS scheduling_mode public.training_scheduling_mode NOT NULL DEFAULT 'fixed';
