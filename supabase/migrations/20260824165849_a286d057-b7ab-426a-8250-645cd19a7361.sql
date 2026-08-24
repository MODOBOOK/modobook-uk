-- 1) location_practitioners: only expose links for active/public locations of active profiles
DROP POLICY IF EXISTS "Public can view location practitioners" ON public.location_practitioners;
CREATE POLICY "Public can view active location practitioners"
ON public.location_practitioners
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    JOIN public.profiles p ON p.id = l.profile_id
    WHERE l.id = location_practitioners.location_id
      AND COALESCE(l.active, true)
      AND COALESCE(l.is_public, true)
      AND COALESCE(p.active, true)
  )
);

-- 2) training_course_locations: only expose links for live, active courses
DROP POLICY IF EXISTS "public reads course locations" ON public.training_course_locations;
CREATE POLICY "public reads live course locations"
ON public.training_course_locations
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_courses tc
    WHERE tc.id = training_course_locations.course_id
      AND COALESCE(tc.active, true)
      AND tc.visibility = 'live'
  )
);

-- 3) quiz_responses: validate anonymous submissions
ALTER TABLE public.quiz_responses
  ADD CONSTRAINT quiz_responses_patient_email_valid
    CHECK (patient_email IS NULL OR (length(patient_email) <= 254 AND patient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')) NOT VALID,
  ADD CONSTRAINT quiz_responses_patient_name_len
    CHECK (patient_name IS NULL OR length(patient_name) <= 120) NOT VALID;

-- 4) patient_referrals: referrers no longer read third-party contact details directly
DROP POLICY IF EXISTS "Referrer or clinic reads referrals" ON public.patient_referrals;
CREATE POLICY "Clinic reads referrals"
ON public.patient_referrals
FOR SELECT
TO authenticated
USING (auth.uid() = clinic_profile_id);

CREATE OR REPLACE FUNCTION public.get_my_referrals(p_clinic_profile_id uuid)
RETURNS TABLE (
  id uuid,
  code text,
  status text,
  reward_credit_pennies integer,
  reward_points integer,
  friend_credit_pennies integer,
  rewarded_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.code, r.status, r.reward_credit_pennies, r.reward_points,
         r.friend_credit_pennies, r.rewarded_at, r.created_at
  FROM public.patient_referrals r
  WHERE r.referrer_user_id = auth.uid()
    AND r.clinic_profile_id = p_clinic_profile_id
  ORDER BY r.created_at DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.get_my_referrals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referrals(uuid) TO authenticated;