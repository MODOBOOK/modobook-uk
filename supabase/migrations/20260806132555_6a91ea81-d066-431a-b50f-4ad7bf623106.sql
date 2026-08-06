ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS room_rental_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.rental_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  hourly_rate numeric,
  half_day_rate numeric,
  full_day_rate numeric,
  half_day_hours integer NOT NULL DEFAULT 4,
  min_hours integer NOT NULL DEFAULT 1,
  booking_mode text NOT NULL DEFAULT 'enquiry',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_rooms_booking_mode_chk CHECK (booking_mode IN ('enquiry','pay_online','pay_in_clinic'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_rooms TO authenticated;
GRANT ALL ON public.rental_rooms TO service_role;
ALTER TABLE public.rental_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their rental rooms" ON public.rental_rooms
  FOR ALL TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE TABLE public.rental_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rental_rooms(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_hours TO authenticated;
GRANT ALL ON public.rental_hours TO service_role;
ALTER TABLE public.rental_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their rental hours" ON public.rental_hours
  FOR ALL TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE TABLE public.rental_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rental_rooms(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  block_date date NOT NULL,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_blocks TO authenticated;
GRANT ALL ON public.rental_blocks TO service_role;
ALTER TABLE public.rental_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their rental blocks" ON public.rental_blocks
  FOR ALL TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE TABLE public.rental_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rental_rooms(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  unit text NOT NULL DEFAULT 'hour',
  hours numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_status text NOT NULL DEFAULT 'unpaid',
  payment_mode text NOT NULL DEFAULT 'enquiry',
  renter_name text NOT NULL,
  renter_email text NOT NULL,
  renter_phone text,
  renter_business text,
  notes text,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_bookings_unit_chk CHECK (unit IN ('hour','half_day','full_day')),
  CONSTRAINT rental_bookings_status_chk CHECK (status IN ('pending','confirmed','cancelled')),
  CONSTRAINT rental_bookings_payment_status_chk CHECK (payment_status IN ('unpaid','paid','refunded'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_bookings TO authenticated;
GRANT ALL ON public.rental_bookings TO service_role;
ALTER TABLE public.rental_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their rental bookings" ON public.rental_bookings
  FOR ALL TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE INDEX idx_rental_rooms_profile ON public.rental_rooms(profile_id);
CREATE INDEX idx_rental_hours_room ON public.rental_hours(room_id);
CREATE INDEX idx_rental_blocks_room_date ON public.rental_blocks(room_id, block_date);
CREATE INDEX idx_rental_bookings_room_date ON public.rental_bookings(room_id, booking_date);

CREATE TRIGGER update_rental_rooms_updated_at BEFORE UPDATE ON public.rental_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rental_hours_updated_at BEFORE UPDATE ON public.rental_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rental_blocks_updated_at BEFORE UPDATE ON public.rental_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rental_bookings_updated_at BEFORE UPDATE ON public.rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();