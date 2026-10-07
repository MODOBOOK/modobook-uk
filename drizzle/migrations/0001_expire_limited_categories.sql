CREATE OR REPLACE FUNCTION public.purge_expired_limited_categories()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  WITH RECURSIVE expired AS (
    SELECT id FROM public.treatment_categories
     WHERE is_limited IS TRUE AND limited_ends_at IS NOT NULL AND limited_ends_at < now()
    UNION
    SELECT c.id FROM public.treatment_categories c JOIN expired e ON c.parent_id = e.id
  ), del_t AS (
    DELETE FROM public.treatments t USING expired e WHERE t.category_id = e.id RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del_t;
  DELETE FROM public.treatment_categories
   WHERE is_limited IS TRUE AND limited_ends_at IS NOT NULL AND limited_ends_at < now();
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.purge_expired_limited_categories() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-expired-limited-categories';
SELECT cron.schedule('purge-expired-limited-categories', '0 * * * *', 'SELECT public.purge_expired_limited_categories();');