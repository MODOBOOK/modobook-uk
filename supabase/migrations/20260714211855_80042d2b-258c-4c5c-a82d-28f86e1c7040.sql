-- Enum: training course mode
DO $$ BEGIN
  CREATE TYPE public.training_mode AS ENUM ('one_to_one', 'group', 'multi_day');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum: training booking status
DO $$ BEGIN
  CREATE TYPE public.training_booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ training_courses ============
CREATE TABLE public.training_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  mode public.training_mode NOT NULL DEFAULT 'one_to_one',
  duration_min INTEGER NOT NULL DEFAULT 120,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(10,2),
  payment_mode public.payment_mode NOT NULL DEFAULT 'full',
  allow_split_payment BOOLEAN NOT NULL DEFAULT false,
  capacity INTEGER,
  prerequisites TEXT,
  require_prereq_confirm BOOLEAN NOT NULL DEFAULT false,
  cpd_hours NUMERIC(5,2),
  certificate_template_url TEXT,
  materials_html TEXT,
  kit_list TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_courses TO authenticated;
GRANT ALL ON public.training_courses TO service_role;

ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active training courses"
  ON public.training_courses FOR SELECT
  USING (active = true);

CREATE POLICY "Practitioners manage own training courses"
  ON public.training_courses FOR ALL
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_training_courses_profile ON public.training_courses(profile_id);
CREATE INDEX idx_training_courses_active ON public.training_courses(profile_id, active);

-- ============ training_course_sessions ============
CREATE TABLE public.training_course_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_course_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_course_sessions TO authenticated;
GRANT ALL ON public.training_course_sessions TO service_role;

ALTER TABLE public.training_course_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sessions for active courses"
  ON public.training_course_sessions FOR SELECT
  USING (course_id IN (SELECT id FROM public.training_courses WHERE active = true));

CREATE POLICY "Practitioners manage own course sessions"
  ON public.training_course_sessions FOR ALL
  USING (course_id IN (
    SELECT c.id FROM public.training_courses c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.user_id = auth.uid()
  ))
  WITH CHECK (course_id IN (
    SELECT c.id FROM public.training_courses c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.user_id = auth.uid()
  ));

CREATE INDEX idx_training_sessions_course ON public.training_course_sessions(course_id, session_date);

-- ============ training_bookings ============
CREATE TABLE public.training_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.training_course_sessions(id) ON DELETE SET NULL,
  trainee_name TEXT NOT NULL,
  trainee_email TEXT NOT NULL,
  trainee_phone TEXT,
  prereq_confirmed BOOLEAN NOT NULL DEFAULT false,
  status public.training_booking_status NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  amount_paid NUMERIC(10,2),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  appointment_date DATE,
  appointment_start TIME,
  appointment_end TIME,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.training_bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_bookings TO authenticated;
GRANT ALL ON public.training_bookings TO service_role;

ALTER TABLE public.training_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a training booking"
  ON public.training_bookings FOR INSERT
  WITH CHECK (course_id IN (SELECT id FROM public.training_courses WHERE active = true));

CREATE POLICY "Practitioners view own training bookings"
  ON public.training_bookings FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Practitioners update own training bookings"
  ON public.training_bookings FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Practitioners delete own training bookings"
  ON public.training_bookings FOR DELETE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_training_bookings_profile ON public.training_bookings(profile_id, status);
CREATE INDEX idx_training_bookings_course ON public.training_bookings(course_id);
CREATE INDEX idx_training_bookings_session ON public.training_bookings(session_id);

-- updated_at triggers (function public.update_updated_at_column already exists in this project)
CREATE TRIGGER trg_training_courses_updated
  BEFORE UPDATE ON public.training_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_training_sessions_updated
  BEFORE UPDATE ON public.training_course_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_training_bookings_updated
  BEFORE UPDATE ON public.training_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();