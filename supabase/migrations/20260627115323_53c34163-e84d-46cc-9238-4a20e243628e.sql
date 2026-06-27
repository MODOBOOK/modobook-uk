-- Locations table
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text,
  phone text,
  notes text,
  is_primary boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active locations of active profiles"
  ON public.locations FOR SELECT
  USING (active = true AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = locations.profile_id AND p.active = true
  ));

CREATE POLICY "Owners manage their locations"
  ON public.locations FOR ALL
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_locations_profile ON public.locations(profile_id);

-- Per-location pricing/duration overrides for treatments
CREATE TABLE public.treatment_location_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  price_cents int,
  duration_minutes int,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (treatment_id, location_id)
);

GRANT SELECT ON public.treatment_location_pricing TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_location_pricing TO authenticated;
GRANT ALL ON public.treatment_location_pricing TO service_role;

ALTER TABLE public.treatment_location_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view pricing for available treatments"
  ON public.treatment_location_pricing FOR SELECT
  USING (available = true AND EXISTS (
    SELECT 1 FROM public.treatments t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.id = treatment_location_pricing.treatment_id AND p.active = true
  ));

CREATE POLICY "Owners manage treatment pricing"
  ON public.treatment_location_pricing FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.treatments t
    WHERE t.id = treatment_location_pricing.treatment_id AND public.is_profile_owner(t.profile_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.treatments t
    WHERE t.id = treatment_location_pricing.treatment_id AND public.is_profile_owner(t.profile_id)
  ));

CREATE TRIGGER update_treatment_location_pricing_updated_at
  BEFORE UPDATE ON public.treatment_location_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tlp_treatment ON public.treatment_location_pricing(treatment_id);
CREATE INDEX idx_tlp_location ON public.treatment_location_pricing(location_id);

-- Tag location on availability rules, blocked dates, appointments
ALTER TABLE public.availability_rules ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.blocked_dates ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX idx_availability_rules_location ON public.availability_rules(location_id);
CREATE INDEX idx_blocked_dates_location ON public.blocked_dates(location_id);
CREATE INDEX idx_appointments_location ON public.appointments(location_id);