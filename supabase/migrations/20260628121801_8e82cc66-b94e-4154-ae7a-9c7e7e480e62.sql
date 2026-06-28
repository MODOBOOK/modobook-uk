GRANT SELECT ON public.clinic_theme TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_theme TO authenticated;
GRANT ALL ON public.clinic_theme TO service_role;