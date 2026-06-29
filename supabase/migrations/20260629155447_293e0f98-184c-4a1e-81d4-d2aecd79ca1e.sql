
CREATE OR REPLACE FUNCTION public.get_quiz_config_by_slug(p_slug text)
RETURNS TABLE (
  profile_id uuid,
  quiz_enabled boolean,
  quiz_intro text,
  quiz_outro text,
  chooser_consultation_treatment_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    COALESCE(quiz_enabled, false),
    quiz_intro,
    quiz_outro,
    chooser_consultation_treatment_id
  FROM public.profiles
  WHERE lower(slug) = lower(p_slug)
    AND active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_config_by_slug(text) TO anon, authenticated;
