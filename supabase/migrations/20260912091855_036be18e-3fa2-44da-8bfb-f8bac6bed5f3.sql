-- Move recently-failed emails from the dead-letter queues back into the live
-- queues so they get another chance to send. Capped at 2 automatic resends per
-- email, and only for messages that failed within the last 48 hours.

CREATE OR REPLACE FUNCTION public.retry_dlq_emails()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  pair RECORD;
  msg RECORD;
  moved integer := 0;
  attempts integer;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('transactional_emails_dlq', 'transactional_emails'),
      ('auth_emails_dlq', 'auth_emails')
    ) AS v(dlq_name, live_name)
  LOOP
    FOR msg IN
      SELECT r.msg_id, r.message, r.enqueued_at
      FROM pgmq.read(pair.dlq_name, 300, 200) r
    LOOP
      -- Skip anything older than 48 hours (stale marketing sends etc.)
      IF msg.enqueued_at < now() - interval '48 hours' THEN
        CONTINUE;
      END IF;

      attempts := COALESCE((msg.message->>'_resend_count')::integer, 0);
      IF attempts >= 2 THEN
        CONTINUE;
      END IF;

      PERFORM pgmq.send(
        pair.live_name,
        jsonb_set(msg.message, '{_resend_count}', to_jsonb(attempts + 1))
      );
      PERFORM pgmq.delete(pair.dlq_name, msg.msg_id);
      moved := moved + 1;
    END LOOP;
  END LOOP;

  RETURN moved;
END;
$$;

-- Hourly sweep: a low-frequency backstop so transient failures self-heal.
SELECT cron.schedule(
  'retry-dlq-emails',
  '17 * * * *',
  $$SELECT public.retry_dlq_emails();$$
);

-- Kick off an immediate pass so the currently-failed emails resend now.
SELECT public.retry_dlq_emails();