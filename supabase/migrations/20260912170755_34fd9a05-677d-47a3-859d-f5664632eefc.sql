select cron.unschedule(jobid)
from cron.job
where jobname = 'marketing-dispatch';