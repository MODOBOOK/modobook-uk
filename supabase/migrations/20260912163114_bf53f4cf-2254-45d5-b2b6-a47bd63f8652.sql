update public.email_send_state set transactional_email_ttl_minutes = 240, updated_at = now() where id = 1;

create or replace function public.retry_dlq_emails()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pgmq'
as $function$
DECLARE
  pair RECORD;
  msg RECORD;
  moved integer := 0;
  attempts integer;
  tmpl text;
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
      EXIT WHEN moved >= 50;

      IF msg.enqueued_at < now() - interval '48 hours' THEN
        CONTINUE;
      END IF;

      tmpl := COALESCE(msg.message->>'template_name', msg.message->>'templateName', '');
      -- Never auto-resend bulk marketing; it floods the queue ahead of booking emails.
      IF tmpl = 'marketing-broadcast' THEN
        CONTINUE;
      END IF;

      attempts := COALESCE((msg.message->>'_resend_count')::integer, 0);
      IF attempts >= 2 THEN
        CONTINUE;
      END IF;

      new_payload := jsonb_set(msg.message, '{_resend_count}', to_jsonb(attempts + 1));
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
$function$;

revoke all on function public.retry_dlq_emails() from public, anon, authenticated;