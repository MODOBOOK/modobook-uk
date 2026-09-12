ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_sending_paused boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET email_sending_paused = true
WHERE id = '43426d5e-2f8f-4d30-bbeb-2048be67ddfc';