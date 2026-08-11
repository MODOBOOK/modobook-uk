ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS menu_group_name text,
  ADD COLUMN IF NOT EXISTS menu_group_ends_at timestamptz;