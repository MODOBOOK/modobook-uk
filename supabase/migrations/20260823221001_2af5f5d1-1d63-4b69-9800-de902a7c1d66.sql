ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_card_capture_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_capture_policy_text text;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS card_capture_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_capture_policy_text text,
  ADD COLUMN IF NOT EXISTS card_captured_at timestamptz;