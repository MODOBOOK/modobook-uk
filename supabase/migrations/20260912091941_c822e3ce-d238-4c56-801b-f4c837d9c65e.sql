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
  new_payload jsonb;
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
      IF msg.enqueued_at < now() - interval '48 hours' THEN
        CONTINUE;
      END IF;

      attempts := COALESCE((msg.message->>'_resend_count')::integer, 0);
      IF attempts >= 2 THEN
        CONTINUE;
      END IF;

      new_payload := jsonb_set(msg.message, '{_resend_count}', to_jsonb(attempts + 1));
      -- Reset the queued timestamp so the resend gets a full fresh TTL window.
      IF new_payload ? 'queued_at' THEN
        new_payload := jsonb_set(new_payload, '{queued_at}', to_jsonb(now()));
      END IF;

      PERFORM pgmq.send(pair.live_name, new_payload);
      PERFORM pgmq.delete(pair.dlq_name, msg.msg_id);
      moved := moved + 1;
    END LOOP;
  END LOOP;

  RETURN moved;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.retry_dlq_emails() FROM PUBLIC, anon, authenticated;

-- Re-run now so the batch that bounced back a moment ago gets a proper retry.
SELECT public.retry_dlq_emails();