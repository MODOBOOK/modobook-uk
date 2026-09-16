update public.health_check_settings
set auto_fix_enabled = false, updated_at = now()
where id = 1;

create or replace function public.health_digest_recipients()
returns table (email text)
language sql
stable
security definer
set search_path = public
as $$
  select lower(u.email::text)
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  where ur.role = 'admin' and u.email is not null
$$;

revoke execute on function public.health_digest_recipients() from public;
revoke execute on function public.health_digest_recipients() from anon;
revoke execute on function public.health_digest_recipients() from authenticated;
grant execute on function public.health_digest_recipients() to service_role;

select cron.schedule(
  'health-digest',
  '15 5 * * *',
  $$
  select net.http_post(
    url:='https://project--ad2db8dc-b519-4cbc-b7c4-dc1d5eed30c6.lovable.app/api/public/hooks/health-digest',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmYmtidHN4dWZ2eGticG95ampuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDY3NTIsImV4cCI6MjA5ODEyMjc1Mn0.CWWAbXiD83hHLwg79e4fxUR61q2Vgr9wSmNTtPzCUkA"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);