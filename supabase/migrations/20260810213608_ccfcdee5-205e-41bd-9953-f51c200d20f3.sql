ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS limited_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS limited_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS limited_quantity integer,
  ADD COLUMN IF NOT EXISTS limited_claimed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_limited boolean NOT NULL DEFAULT false;