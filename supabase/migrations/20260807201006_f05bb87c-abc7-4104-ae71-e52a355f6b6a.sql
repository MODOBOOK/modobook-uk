
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS associates_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.clinic_associates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  associate_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_email text NOT NULL,
  invited_name text NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  invite_token text,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  oversight_records boolean NOT NULL DEFAULT true,
  oversight_appointments boolean NOT NULL DEFAULT true,
  oversight_incidents boolean NOT NULL DEFAULT true,
  room_allocation_enabled boolean NOT NULL DEFAULT false,
  room_id uuid REFERENCES public.rental_rooms(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  block_when_no_room boolean NOT NULL DEFAULT true,
  charge_room_rent boolean NOT NULL DEFAULT false,
  seat_sponsored boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_profile_id, invited_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_associates TO authenticated;
GRANT ALL ON public.clinic_associates TO service_role;
ALTER TABLE public.clinic_associates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic owner manages associates" ON public.clinic_associates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = clinic_associates.clinic_profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = clinic_associates.clinic_profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Associate can view own link" ON public.clinic_associates
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = clinic_associates.associate_profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Associate can accept own link" ON public.clinic_associates
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = clinic_associates.associate_profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = clinic_associates.associate_profile_id AND p.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.associate_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.clinic_associates(id) ON DELETE CASCADE,
  clinic_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  associate_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'minor',
  title text NOT NULL,
  description text,
  action_taken text,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.associate_incidents TO authenticated;
GRANT ALL ON public.associate_incidents TO service_role;
ALTER TABLE public.associate_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic owner manages incidents" ON public.associate_incidents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = associate_incidents.clinic_profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = associate_incidents.clinic_profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Associate manages own incidents" ON public.associate_incidents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = associate_incidents.associate_profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = associate_incidents.associate_profile_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_clinic_associates_clinic ON public.clinic_associates(clinic_profile_id);
CREATE INDEX IF NOT EXISTS idx_clinic_associates_associate ON public.clinic_associates(associate_profile_id);
CREATE INDEX IF NOT EXISTS idx_associate_incidents_clinic ON public.associate_incidents(clinic_profile_id);

ALTER TABLE public.rental_bookings ADD COLUMN IF NOT EXISTS associate_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rental_bookings ADD COLUMN IF NOT EXISTS associate_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rental_booking_appointment ON public.rental_bookings(associate_appointment_id) WHERE associate_appointment_id IS NOT NULL;

CREATE TRIGGER update_clinic_associates_updated_at BEFORE UPDATE ON public.clinic_associates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_associate_incidents_updated_at BEFORE UPDATE ON public.associate_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

UPDATE public.profiles SET associates_enabled = true WHERE slug IN ('aestheticsbynurseryan','aesthetiqbyjen');
