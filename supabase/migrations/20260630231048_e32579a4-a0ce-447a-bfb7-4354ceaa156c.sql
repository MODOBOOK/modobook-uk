
-- Clinic visit days where a prescriber attends a practitioner's clinic
CREATE TABLE public.prescriber_clinic_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prescriber_user_id uuid NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 8,
  notes text,
  status text NOT NULL DEFAULT 'scheduled',
  created_by text NOT NULL DEFAULT 'practitioner',
  confirmed_by_prescriber boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prescriber_clinic_visits_practitioner_date
  ON public.prescriber_clinic_visits (practitioner_profile_id, visit_date);
CREATE INDEX idx_prescriber_clinic_visits_prescriber_date
  ON public.prescriber_clinic_visits (prescriber_user_id, visit_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_clinic_visits TO authenticated;
GRANT ALL ON public.prescriber_clinic_visits TO service_role;

ALTER TABLE public.prescriber_clinic_visits ENABLE ROW LEVEL SECURITY;

-- Practitioner owns their schedule
CREATE POLICY "Practitioner manages own clinic visits"
  ON public.prescriber_clinic_visits FOR ALL
  USING (public.is_profile_owner(practitioner_profile_id))
  WITH CHECK (public.is_profile_owner(practitioner_profile_id));

-- Prescriber can see visits assigned to them
CREATE POLICY "Prescriber views own visits"
  ON public.prescriber_clinic_visits FOR SELECT
  USING (prescriber_user_id = auth.uid());

-- Prescriber can update confirmation/status on their own visits
CREATE POLICY "Prescriber updates own visit confirmation"
  ON public.prescriber_clinic_visits FOR UPDATE
  USING (prescriber_user_id = auth.uid())
  WITH CHECK (prescriber_user_id = auth.uid());

CREATE TRIGGER trg_prescriber_clinic_visits_updated_at
  BEFORE UPDATE ON public.prescriber_clinic_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link referral to a chosen clinic visit
ALTER TABLE public.prescriber_referrals
  ADD COLUMN IF NOT EXISTS clinic_visit_id uuid REFERENCES public.prescriber_clinic_visits(id) ON DELETE SET NULL;

-- Migrate legacy in_person_consult routing to clinic_visit
UPDATE public.treatments SET prescriber_routing = 'clinic_visit'
  WHERE prescriber_routing = 'in_person_consult';
UPDATE public.prescriber_referrals SET routing = 'clinic_visit'
  WHERE routing = 'in_person_consult';

-- Public RPC: list upcoming clinic visits for a practitioner slug + given treatments
CREATE OR REPLACE FUNCTION public.list_clinic_visits_for_slug(
  p_slug text,
  p_treatment_ids uuid[]
)
RETURNS TABLE(
  visit_id uuid,
  treatment_id uuid,
  prescriber_user_id uuid,
  prescriber_name text,
  location_id uuid,
  location_name text,
  visit_date date,
  start_time time,
  end_time time,
  remaining_capacity integer,
  notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT id FROM public.profiles WHERE slug = p_slug AND active = true
  ),
  treats AS (
    SELECT t.id AS treatment_id, t.prescriber_user_id
    FROM public.treatments t, p
    WHERE t.id = ANY(p_treatment_ids)
      AND t.profile_id = p.id
      AND t.requires_prescriber = true
      AND t.prescriber_routing = 'clinic_visit'
      AND t.prescriber_user_id IS NOT NULL
  )
  SELECT
    v.id,
    tr.treatment_id,
    v.prescriber_user_id,
    COALESCE(pp.full_name, 'Prescriber')::text,
    v.location_id,
    l.name,
    v.visit_date,
    v.start_time,
    v.end_time,
    GREATEST(v.capacity - COALESCE((
      SELECT count(*)::int FROM public.prescriber_referrals r
      WHERE r.clinic_visit_id = v.id AND r.status <> 'declined'
    ), 0), 0)::int,
    v.notes
  FROM public.prescriber_clinic_visits v
  JOIN p ON p.id = v.practitioner_profile_id
  JOIN treats tr ON tr.prescriber_user_id = v.prescriber_user_id
  LEFT JOIN public.locations l ON l.id = v.location_id
  LEFT JOIN public.prescriber_profiles pp ON pp.user_id = v.prescriber_user_id
  WHERE v.status = 'scheduled'
    AND v.visit_date >= current_date
  ORDER BY v.visit_date, v.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.list_clinic_visits_for_slug(text, uuid[]) TO anon, authenticated;

-- Prescriber RPC: list my upcoming visits with booked patients
CREATE OR REPLACE FUNCTION public.list_my_prescriber_visits()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.visit_date, x.start_time), '[]'::jsonb)
  INTO v
  FROM (
    SELECT
      cv.id AS visit_id,
      cv.visit_date,
      cv.start_time,
      cv.end_time,
      cv.capacity,
      cv.notes,
      cv.status,
      cv.confirmed_by_prescriber,
      p.clinic_name,
      p.id AS practitioner_profile_id,
      l.name AS location_name,
      l.address_line1, l.city, l.postcode,
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'referral_id', r.id,
          'patient_name', r.patient_name,
          'treatment_id', r.treatment_id,
          'status', r.status
        )), '[]'::jsonb)
        FROM public.prescriber_referrals r
        WHERE r.clinic_visit_id = cv.id
      ) AS bookings
    FROM public.prescriber_clinic_visits cv
    JOIN public.profiles p ON p.id = cv.practitioner_profile_id
    LEFT JOIN public.locations l ON l.id = cv.location_id
    WHERE cv.prescriber_user_id = auth.uid()
      AND cv.visit_date >= current_date - interval '1 day'
  ) x;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_prescriber_visits() TO authenticated;
