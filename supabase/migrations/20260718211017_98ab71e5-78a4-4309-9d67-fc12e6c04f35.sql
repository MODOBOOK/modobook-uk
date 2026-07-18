DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT c.relname AS table_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r'
           AND n.nspname = 'public'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.table_name);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
    END LOOP;
END;
$$;

-- Anon SELECT for tables with permissive public-read policies
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.treatments TO anon;
GRANT SELECT ON public.treatment_categories TO anon;
GRANT SELECT ON public.treatment_location_pricing TO anon;
GRANT SELECT ON public.treatment_addons TO anon;
GRANT SELECT ON public.addons TO anon;
GRANT SELECT ON public.addon_links TO anon;
GRANT SELECT ON public.locations TO anon;
GRANT SELECT ON public.location_practitioners TO anon;
GRANT SELECT ON public.staff_members TO anon;
GRANT SELECT ON public.availability_rules TO anon;
GRANT SELECT ON public.availability_overrides TO anon;
GRANT SELECT ON public.blocked_dates TO anon;
GRANT SELECT ON public.blocked_times TO anon;
GRANT SELECT ON public.clinic_theme TO anon;
GRANT SELECT ON public.clinic_gallery TO anon;
GRANT SELECT ON public.clinic_testimonials TO anon;
GRANT SELECT ON public.clinic_reward_tiers TO anon;
GRANT SELECT ON public.clinic_referral_settings TO anon;
GRANT SELECT ON public.concerns TO anon;
GRANT SELECT ON public.concern_areas TO anon;
GRANT SELECT ON public.concern_treatments TO anon;
GRANT SELECT ON public.packages TO anon;
GRANT SELECT ON public.model_slots TO anon;
GRANT SELECT ON public.training_courses TO anon;
GRANT SELECT ON public.training_course_locations TO anon;
GRANT SELECT ON public.training_course_sessions TO anon;
GRANT INSERT ON public.appointments TO anon;
GRANT INSERT ON public.training_bookings TO anon;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.platform_terms TO anon;
GRANT SELECT ON public.hub_codes TO anon;
GRANT SELECT ON public.prescriber_profiles TO anon;
GRANT SELECT ON public.aftercare_templates TO anon;
GRANT SELECT ON public.consent_templates TO anon;
GRANT SELECT ON public.medical_form_templates TO anon;
GRANT SELECT ON public.medical_form_categories TO anon;
GRANT SELECT ON public.pretreatment_templates TO anon;