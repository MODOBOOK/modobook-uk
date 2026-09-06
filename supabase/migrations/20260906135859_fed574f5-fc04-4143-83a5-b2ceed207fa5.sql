ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS dashboard_follow_brand boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dashboard_palette text,
  ADD COLUMN IF NOT EXISTS dashboard_heading_font text,
  ADD COLUMN IF NOT EXISTS dashboard_body_font text;