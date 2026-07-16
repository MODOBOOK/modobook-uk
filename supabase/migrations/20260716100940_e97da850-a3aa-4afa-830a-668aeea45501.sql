ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS hero_use_logo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hero_text_color text;