ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS preset_key text,
  ADD COLUMN IF NOT EXISTS layout_key text DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS hero_carousel_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hero_carousel_enabled boolean DEFAULT false;