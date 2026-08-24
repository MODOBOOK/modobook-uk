ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sms_channels jsonb NOT NULL DEFAULT '{}'::jsonb;