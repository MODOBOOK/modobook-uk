ALTER TABLE public.prescriber_clinic_visits
  ALTER COLUMN prescriber_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS prescriber_label text;

CREATE OR REPLACE FUNCTION public.list_clinic_visits_for_slug(p_slug text, p_treatment_ids uuid[])
RETURNS TABLE (
  visit_id uuid,
  treatment_id uuid,
  prescriber_user_id uuid,
  prescriber_name text,
  location_id uuid,
  location_name text,
  visit_date date,
  start_time time,
  end_time time,
  remaining_capacity int,
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
  )
  SELECT
    v.id,
    tr.treatment_id,
    v.prescriber_user_id,
    COALESCE(pp.full_name, v.prescriber_label, 'Prescriber')::text,
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
  JOIN treats tr ON (
    v.prescriber_user_id IS NULL
    OR tr.prescriber_user_id IS NULL
    OR tr.prescriber_user_id = v.prescriber_user_id
  )
  LEFT JOIN public.locations l ON l.id = v.location_id
  LEFT JOIN public.prescriber_profiles pp ON pp.user_id = v.prescriber_user_id
  WHERE v.status = 'scheduled'
    AND v.visit_date >= current_date
  ORDER BY v.visit_date, v.start_time;
$$;