ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS treatments_profile_sort_idx ON public.treatments (profile_id, sort_order);