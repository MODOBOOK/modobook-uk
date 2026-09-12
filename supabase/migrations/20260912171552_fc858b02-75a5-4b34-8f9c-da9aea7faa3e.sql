select cron.unschedule(jobid)
from cron.job
where jobname = 'release-held-emails';

do $$
declare
  moved integer;
  pass integer := 0;
begin
  loop
    select public.hold_bulk_marketing_emails() into moved;
    pass := pass + 1;
    exit when moved = 0 or pass >= 10;
  end loop;
end $$;