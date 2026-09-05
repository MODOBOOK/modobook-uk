select cron.schedule(
  'compliance-reminders-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url:='https://project--ad2db8dc-b519-4cbc-b7c4-dc1d5eed30c6.lovable.app/api/public/hooks/compliance-reminders',
    headers:=(select headers from cron.job where jobname = 'send-rebook-reminders-daily' limit 1),
    body:='{}'::jsonb
  ) as request_id;
  $$
);