
-- Grant Data API access (missing on all public tables)
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END$$;

-- Public-facing booking surfaces need anon SELECT (RLS policies still apply).
-- Skip profiles (intentionally locked; reads go through get_public_profile_by_slug).
GRANT SELECT ON public.clinic_gallery TO anon;
GRANT SELECT ON public.clinic_testimonials TO anon;
GRANT SELECT ON public.clinic_theme TO anon;
GRANT SELECT ON public.locations TO anon;
GRANT SELECT ON public.treatments TO anon;
GRANT SELECT ON public.treatment_categories TO anon;
GRANT SELECT ON public.treatment_addons TO anon;
GRANT SELECT ON public.treatment_location_pricing TO anon;
GRANT SELECT ON public.packages TO anon;
GRANT SELECT ON public.patient_reviews TO anon;
GRANT SELECT ON public.availability_rules TO anon;
GRANT SELECT ON public.blocked_dates TO anon;
