ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS limited_book_by_only boolean NOT NULL DEFAULT true;

ALTER TABLE public.treatment_categories
  ADD COLUMN IF NOT EXISTS is_limited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limited_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS limited_ends_at timestamptz;