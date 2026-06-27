
ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS menu_card_bg text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS menu_card_border_color text DEFAULT '#e5e7eb',
  ADD COLUMN IF NOT EXISTS menu_category_bg text DEFAULT '#111827',
  ADD COLUMN IF NOT EXISTS menu_category_text text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS menu_treatment_name_color text,
  ADD COLUMN IF NOT EXISTS menu_price_color text,
  ADD COLUMN IF NOT EXISTS menu_treatment_size text DEFAULT 'sm',
  ADD COLUMN IF NOT EXISTS menu_treatment_bold boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS menu_category_bold boolean DEFAULT true;
