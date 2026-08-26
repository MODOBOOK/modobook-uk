ALTER TABLE public.treatments
ADD COLUMN IF NOT EXISTS course_option_label text;

UPDATE public.treatments
SET course_option_label = CASE
  WHEN session_count = 1 THEN '1 ' || regexp_replace(COALESCE(NULLIF(BTRIM(course_unit_label), ''), 'session'), 's$', '', 'i')
  ELSE session_count::text || ' ' || COALESCE(NULLIF(BTRIM(course_unit_label), ''), 'sessions')
END
WHERE (course_group IS NOT NULL OR cardinality(COALESCE(course_groups, ARRAY[]::text[])) > 0)
  AND NULLIF(BTRIM(course_option_label), '') IS NULL;