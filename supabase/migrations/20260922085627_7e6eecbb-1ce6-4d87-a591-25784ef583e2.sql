DROP POLICY IF EXISTS "Public can view active gift cards" ON public.gift_cards;
CREATE POLICY "Public can view active gift cards" ON public.gift_cards
FOR SELECT TO anon, authenticated
USING (active = true AND public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Anyone can view active training courses" ON public.training_courses;
CREATE POLICY "Anyone can view active training courses" ON public.training_courses
FOR SELECT TO anon, authenticated
USING (active = true AND public.is_active_profile(profile_id));

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND (pg_get_function_result(p.oid) = 'trigger'
           OR p.proname IN ('_profile_id_for_user','_user_id_for_profile'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon, authenticated;', r.nspname, r.proname, r.args);
  END LOOP;
END $$;