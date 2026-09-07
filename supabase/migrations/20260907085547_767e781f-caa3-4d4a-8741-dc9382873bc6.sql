ALTER TABLE public.blocked_times ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES public.practitioners(id) ON DELETE CASCADE;
ALTER TABLE public.blocked_dates ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES public.practitioners(id) ON DELETE CASCADE;
ALTER TABLE public.availability_overrides ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES public.practitioners(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS blocked_times_practitioner_idx ON public.blocked_times(practitioner_id);
CREATE INDEX IF NOT EXISTS blocked_dates_practitioner_idx ON public.blocked_dates(practitioner_id);
CREATE INDEX IF NOT EXISTS availability_overrides_practitioner_idx ON public.availability_overrides(practitioner_id);