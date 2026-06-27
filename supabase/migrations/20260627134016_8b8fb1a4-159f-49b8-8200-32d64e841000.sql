
CREATE TABLE IF NOT EXISTS public.availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_interval int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.availability_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_overrides TO authenticated;
GRANT ALL ON public.availability_overrides TO service_role;

ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view overrides for active profiles"
  ON public.availability_overrides FOR SELECT
  USING (public.is_active_profile(profile_id));

CREATE POLICY "Owners manage overrides"
  ON public.availability_overrides FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER update_availability_overrides_updated_at
  BEFORE UPDATE ON public.availability_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS availability_overrides_profile_date_idx
  ON public.availability_overrides(profile_id, date);
