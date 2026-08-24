ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_timings jsonb NOT NULL DEFAULT '{}'::jsonb;