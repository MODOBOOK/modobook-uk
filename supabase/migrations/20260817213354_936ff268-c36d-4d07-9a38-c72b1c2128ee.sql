ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS link_button_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_button_label text,
  ADD COLUMN IF NOT EXISTS link_button_subtitle text,
  ADD COLUMN IF NOT EXISTS link_button_url text;