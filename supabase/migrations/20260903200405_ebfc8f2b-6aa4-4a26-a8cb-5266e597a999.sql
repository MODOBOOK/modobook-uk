ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS draft jsonb,
  ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz;