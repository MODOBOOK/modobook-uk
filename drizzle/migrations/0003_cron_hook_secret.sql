CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.cron_secret (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), secret text NOT NULL);
REVOKE ALL ON private.cron_secret FROM PUBLIC, anon, authenticated;
INSERT INTO private.cron_secret (id, secret)
  VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT p_secret IS NOT NULL AND length(p_secret) > 0
     AND EXISTS (SELECT 1 FROM private.cron_secret WHERE secret = p_secret)
$$;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

DO $$
DECLARE
  base text := 'https://project--ad2db8dc-b519-4cbc-b7c4-dc1d5eed30c6.lovable.app/api/public/hooks/';
  j record;
BEGIN
  FOR j IN SELECT * FROM (VALUES
    ('send-review-emails-hourly','15 * * * *','review-emails'),
    ('appointment-reminders','*/5 * * * *','appointment-reminders'),
    ('daily-schedule-digest','0 18 * * *','daily-schedule-digest'),
    ('send-rebook-reminders-daily','15 9 * * *','rebook-reminders'),
    ('marketing-dispatch-scheduled','*/5 * * * *','marketing-dispatch'),
    ('marketing-automations-hourly','0 * * * *','marketing-automations'),
    ('demo-reset-nightly','0 3 * * *','demo-reset'),
    ('billing-reconcile-hourly','20 * * * *','billing-reconcile'),
    ('compliance-reminders-daily','0 8 * * *','compliance-reminders'),
    ('aftercare-dispatch-every-5-min','*/5 * * * *','aftercare-dispatch'),
    ('health-digest','15 5 * * *','health-digest')
  ) AS t(name, sched, hook)
  LOOP
    PERFORM cron.schedule(j.name, j.sched, format(
      $c$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(SELECT secret FROM private.cron_secret WHERE id = 1)), body := '{}'::jsonb)$c$,
      base || j.hook));
  END LOOP;
END $$;