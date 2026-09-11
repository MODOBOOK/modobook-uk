-- lovable-cron-fallback-reviewed: 288 runs/day; bounded queue of pending aftercare rows that must fire at a specific future time (appointment end + 2h) when no manual checkout occurs. Event-driven enqueue alone cannot delay delivery, so a low-frequency sweeper is used.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_checked_out_at ON public.appointments(checked_out_at);

SELECT cron.schedule(
  'aftercare-dispatch-every-5-min',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://project--ad2db8dc-b519-4cbc-b7c4-dc1d5eed30c6.lovable.app/api/public/hooks/aftercare-dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmYmtidHN4dWZ2eGticG95ampuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDY3NTIsImV4cCI6MjA5ODEyMjc1Mn0.CWWAbXiD83hHLwg79e4fxUR61q2Vgr9wSmNTtPzCUkA'),
      body := '{}'::jsonb
    )
  $$
);