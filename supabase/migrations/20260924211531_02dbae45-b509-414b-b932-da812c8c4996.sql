ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS page_preset text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS carousel_height text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS carousel_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS section_visibility jsonb,
  ADD COLUMN IF NOT EXISTS section_order jsonb;