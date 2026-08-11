ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS menu_category_id uuid REFERENCES public.treatment_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS menu_placement text NOT NULL DEFAULT 'top';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS packages_label text;