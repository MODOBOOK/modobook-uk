ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS packages_countdown_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS packages_countdown_label text;