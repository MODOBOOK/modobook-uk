GRANT SELECT, INSERT ON public.patient_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_reviews TO authenticated;
GRANT ALL ON public.patient_reviews TO service_role;