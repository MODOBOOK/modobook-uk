GRANT SELECT ON public.practitioners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practitioners TO authenticated;
GRANT ALL ON public.practitioners TO service_role;

GRANT SELECT ON public.location_practitioners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_practitioners TO authenticated;
GRANT ALL ON public.location_practitioners TO service_role;