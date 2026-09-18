ALTER TABLE public.availability_overrides ADD COLUMN IF NOT EXISTS publish_at timestamptz;
COMMENT ON COLUMN public.availability_overrides.publish_at IS 'If set, the one-off window is hidden from clients until this moment; staff can still book it.';
CREATE INDEX IF NOT EXISTS availability_overrides_publish_at_idx ON public.availability_overrides (publish_at);