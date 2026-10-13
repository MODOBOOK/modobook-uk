DO $$
DECLARE
  base text := 'https://project--ad2db8dc-b519-4cbc-b7c4-dc1d5eed30c6.lovable.app/api/public/hooks/';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmYmtidHN4dWZ2eGticG95ampuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDY3NTIsImV4cCI6MjA5ODEyMjc1Mn0.CWWAbXiD83hHLwg79e4fxUR61q2Vgr9wSmNTtPzCUkA';
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
      $c$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'x-cron-secret',(SELECT secret FROM private.cron_secret WHERE id = 1)), body := '{}'::jsonb)$c$,
      base || j.hook, anon));
  END LOOP;
END $$;