ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favourite_treatment_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favourites_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS favourites_custom_title text;