
ALTER TABLE public.clinic_theme
  -- Header
  ADD COLUMN IF NOT EXISTS header_sticky boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS header_logo_size text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS header_show_name boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS header_show_tagline boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS header_button_label text NOT NULL DEFAULT 'Book',
  -- Hero
  ADD COLUMN IF NOT EXISTS hero_height text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS hero_overlay_opacity numeric NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS hero_overlay_color text NOT NULL DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS hero_text_alignment text NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS hero_show_text boolean NOT NULL DEFAULT true,
  -- Buttons
  ADD COLUMN IF NOT EXISTS button_color text,
  ADD COLUMN IF NOT EXISTS button_text_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS button_radius text NOT NULL DEFAULT 'rounded-xl',
  ADD COLUMN IF NOT EXISTS button_size text NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS button_uppercase boolean NOT NULL DEFAULT false,
  -- Spacing & density
  ADD COLUMN IF NOT EXISTS page_density text NOT NULL DEFAULT 'cozy',
  ADD COLUMN IF NOT EXISTS section_gap text NOT NULL DEFAULT 'md',
  -- Contact tiles
  ADD COLUMN IF NOT EXISTS contact_tile_layout text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS contact_tile_icon_size text NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS contact_tile_bg_color text,
  ADD COLUMN IF NOT EXISTS contact_tile_border_color text;
