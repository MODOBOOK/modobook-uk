
CREATE TABLE IF NOT EXISTS public.health_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  profile_id uuid,
  title text NOT NULL,
  detail text,
  affected_count integer NOT NULL DEFAULT 0,
  sample jsonb,
  status text NOT NULL DEFAULT 'open',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS health_findings_key_uniq
  ON public.health_findings (check_key, coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.health_findings TO authenticated;
GRANT ALL ON public.health_findings TO service_role;

ALTER TABLE public.health_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view health findings" ON public.health_findings;
CREATE POLICY "Admins can view health findings"
  ON public.health_findings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.run_health_checks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r record;
  seen text[] := ARRAY[]::text[];
  total integer := 0;
BEGIN
  FOR r IN
    WITH checks AS (
      SELECT 'payment_paid_but_short'::text AS key, 'critical'::text AS sev,
             'Bookings marked paid but underpaid'::text AS title,
             count(*)::int AS n,
             jsonb_agg(jsonb_build_object('appointment_id', a.id, 'date', a.scheduled_date) ORDER BY a.scheduled_date DESC) FILTER (WHERE true) AS sample
      FROM public.appointments a
      WHERE a.payment_status = 'paid'
        AND coalesce(a.total_amount,0) > 0
        AND coalesce(a.amount_paid_cents,0) < round(a.total_amount * 100)
      HAVING count(*) > 0

      UNION ALL
      SELECT 'payment_covered_not_marked', 'warning',
             'Bookings fully paid but still showing as unpaid',
             count(*)::int,
             jsonb_agg(jsonb_build_object('appointment_id', a.id, 'date', a.scheduled_date))
      FROM public.appointments a
      WHERE coalesce(a.payment_status,'pending') <> 'paid'
        AND coalesce(a.total_amount,0) > 0
        AND coalesce(a.amount_paid_cents,0) >= round(a.total_amount * 100)
      HAVING count(*) > 0

      UNION ALL
      SELECT 'payment_missing_ledger', 'critical',
             'Payments taken with no entry in the payment ledger',
             count(*)::int,
             jsonb_agg(jsonb_build_object('appointment_id', a.id, 'date', a.scheduled_date))
      FROM public.appointments a
      WHERE coalesce(a.amount_paid_cents,0) > 0
        AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.appointment_id = a.id)
      HAVING count(*) > 0

      UNION ALL
      SELECT 'payment_duplicate_ledger', 'warning',
             'Duplicate payment entries for the same card charge',
             count(*)::int,
             jsonb_agg(jsonb_build_object('appointment_id', d.appointment_id, 'charge', d.stripe_payment_intent_id))
      FROM (
        SELECT p.appointment_id, p.stripe_payment_intent_id
        FROM public.payments p
        WHERE p.stripe_payment_intent_id IS NOT NULL AND p.appointment_id IS NOT NULL
        GROUP BY 1,2 HAVING count(*) > 1
      ) d
      HAVING count(*) > 0

      UNION ALL
      SELECT 'email_failed_24h', 'critical',
             'Emails that failed after all retries in the last day',
             count(*)::int,
             jsonb_agg(jsonb_build_object('template', l.template_name, 'error', left(coalesce(l.error_message,''), 160)))
      FROM public.email_send_log l
      WHERE l.status IN ('dlq','failed')
        AND l.created_at > now() - interval '1 day'
      HAVING count(*) > 0

      UNION ALL
      SELECT 'email_stuck_pending', 'warning',
             'Emails stuck waiting to send for over two hours',
             count(*)::int,
             jsonb_agg(jsonb_build_object('template', l.template_name, 'queued_at', l.created_at))
      FROM public.email_send_log l
      WHERE l.status = 'pending'
        AND l.created_at BETWEEN now() - interval '2 days' AND now() - interval '2 hours'
        AND NOT EXISTS (
          SELECT 1 FROM public.email_send_log l2
          WHERE l2.message_id = l.message_id AND l2.created_at > l.created_at
        )
      HAVING count(*) > 0

      UNION ALL
      SELECT 'appointment_no_price', 'info',
             'Upcoming confirmed bookings with no price set',
             count(*)::int,
             jsonb_agg(jsonb_build_object('appointment_id', a.id, 'date', a.scheduled_date))
      FROM public.appointments a
      WHERE a.scheduled_date >= current_date
        AND a.status IN ('confirmed','pending')
        AND coalesce(a.total_amount,0) = 0
      HAVING count(*) > 0

      UNION ALL
      SELECT 'appointment_overlap', 'warning',
             'Overlapping upcoming bookings for the same practitioner',
             count(*)::int,
             jsonb_agg(jsonb_build_object('appointment_id', o.id, 'date', o.scheduled_date))
      FROM (
        SELECT a.id, a.scheduled_date
        FROM public.appointments a
        JOIN public.appointments b
          ON b.id <> a.id
         AND b.profile_id = a.profile_id
         AND b.scheduled_date = a.scheduled_date
         AND coalesce(b.practitioner_id, a.profile_id) = coalesce(a.practitioner_id, a.profile_id)
         AND b.status IN ('confirmed','pending')
         AND b.start_time < a.end_time
         AND b.end_time > a.start_time
        WHERE a.scheduled_date >= current_date
          AND a.status IN ('confirmed','pending')
        GROUP BY a.id, a.scheduled_date
      ) o
      HAVING count(*) > 0
    )
    SELECT * FROM checks
  LOOP
    seen := seen || r.key;
    total := total + 1;
    INSERT INTO public.health_findings (check_key, severity, title, detail, affected_count, sample, status, last_seen_at, resolved_at, updated_at)
    VALUES (r.key, r.sev, r.title, NULL, r.n,
            (SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(coalesce(r.sample,'[]'::jsonb)) x LIMIT 10) s),
            'open', now(), NULL, now())
    ON CONFLICT (check_key, coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET severity = EXCLUDED.severity,
                  title = EXCLUDED.title,
                  affected_count = EXCLUDED.affected_count,
                  sample = EXCLUDED.sample,
                  status = 'open',
                  resolved_at = NULL,
                  last_seen_at = now(),
                  updated_at = now();
  END LOOP;

  UPDATE public.health_findings
     SET status = 'resolved', resolved_at = coalesce(resolved_at, now()), affected_count = 0, updated_at = now()
   WHERE status = 'open'
     AND NOT (check_key = ANY (seen));

  RETURN total;
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_health_checks() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_health_checks() TO service_role;

SELECT cron.unschedule('daily-health-checks') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-health-checks');
SELECT cron.schedule('daily-health-checks', '0 5 * * *', $$SELECT public.run_health_checks();$$);
