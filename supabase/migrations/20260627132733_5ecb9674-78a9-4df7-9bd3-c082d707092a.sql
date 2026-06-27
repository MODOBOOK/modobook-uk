GRANT SELECT ON public.treatment_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_categories TO authenticated;
GRANT ALL ON public.treatment_categories TO service_role;