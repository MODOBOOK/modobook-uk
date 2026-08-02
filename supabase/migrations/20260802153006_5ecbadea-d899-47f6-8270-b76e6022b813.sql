ALTER TABLE public.practitioner_subscriptions
  ADD COLUMN IF NOT EXISTS free_locations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_practitioners integer NOT NULL DEFAULT 0;