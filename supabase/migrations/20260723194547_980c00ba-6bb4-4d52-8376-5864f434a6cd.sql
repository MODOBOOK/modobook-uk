
ALTER TABLE public.patient_reviews ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE public.patient_reviews ADD COLUMN IF NOT EXISTS reviewer_name text;
ALTER TABLE public.patient_reviews ADD COLUMN IF NOT EXISTS reviewer_email text;
ALTER TABLE public.patient_reviews ADD CONSTRAINT patient_reviews_author_check
  CHECK (patient_id IS NOT NULL OR reviewer_name IS NOT NULL);

GRANT INSERT ON public.patient_reviews TO anon;

CREATE POLICY "Anon writes public review pending moderation"
  ON public.patient_reviews FOR INSERT
  TO anon
  WITH CHECK (
    patient_id IS NULL
    AND approved = false
    AND reviewer_name IS NOT NULL
    AND length(btrim(reviewer_name)) BETWEEN 1 AND 100
    AND length(btrim(body)) BETWEEN 1 AND 2000
    AND rating BETWEEN 1 AND 5
    AND profile_id IN (SELECT id FROM public.profiles WHERE active = true)
  );
