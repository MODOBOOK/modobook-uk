ALTER TABLE public.rental_rooms
  ALTER COLUMN min_hours TYPE numeric(4,2) USING min_hours::numeric,
  ALTER COLUMN min_hours SET DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;