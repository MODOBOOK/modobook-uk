DROP POLICY IF EXISTS "Public reads approved reviews for active profiles" ON public.patient_reviews;

CREATE OR REPLACE FUNCTION public.get_public_patient_reviews(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  rating integer,
  title text,
  body text,
  created_at timestamptz,
  reviewer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.rating, r.title, r.body, r.created_at, r.reviewer_name
  FROM public.patient_reviews r
  WHERE r.profile_id = p_profile_id
    AND r.approved = true
    AND public.is_active_profile(r.profile_id)
  ORDER BY r.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_public_patient_reviews(uuid) TO anon, authenticated;