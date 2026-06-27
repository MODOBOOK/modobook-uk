
-- 1. Extend profiles for bio page
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}';

-- 2. Patients table (separate from practitioner profiles)
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  date_of_birth date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own record"
  ON public.patients FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Patient–practitioner link (so practitioner can see their patients)
CREATE TABLE IF NOT EXISTS public.patient_practitioner_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_practitioner_links TO authenticated;
GRANT ALL ON public.patient_practitioner_links TO service_role;
ALTER TABLE public.patient_practitioner_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient sees own links"
  ON public.patient_practitioner_links FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "Practitioner sees own links"
  ON public.patient_practitioner_links FOR SELECT
  USING (public.is_profile_owner(profile_id));
CREATE POLICY "Patient creates link"
  ON public.patient_practitioner_links FOR INSERT
  WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

-- 4. Patient reviews (verified, tied to a patient account)
CREATE TABLE IF NOT EXISTS public.patient_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL,
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_reviews TO authenticated;
GRANT SELECT ON public.patient_reviews TO anon;
GRANT ALL ON public.patient_reviews TO service_role;
ALTER TABLE public.patient_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads approved reviews for active profiles"
  ON public.patient_reviews FOR SELECT
  USING (approved = true AND profile_id IN (SELECT id FROM public.profiles WHERE active = true));
CREATE POLICY "Patient writes own review"
  ON public.patient_reviews FOR INSERT
  WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "Patient updates own review"
  ON public.patient_reviews FOR UPDATE
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "Patient deletes own review"
  ON public.patient_reviews FOR DELETE
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "Practitioner moderates reviews"
  ON public.patient_reviews FOR UPDATE
  USING (public.is_profile_owner(profile_id));
CREATE TRIGGER trg_patient_reviews_updated_at
  BEFORE UPDATE ON public.patient_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Public read of profiles for bio page (slug-based lookup)
DROP POLICY IF EXISTS "Public reads active profiles" ON public.profiles;
CREATE POLICY "Public reads active profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (active = true);
GRANT SELECT ON public.profiles TO anon;
