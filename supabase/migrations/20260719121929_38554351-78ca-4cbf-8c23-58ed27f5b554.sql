ALTER TABLE public.practitioner_waitlist
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_text TEXT;