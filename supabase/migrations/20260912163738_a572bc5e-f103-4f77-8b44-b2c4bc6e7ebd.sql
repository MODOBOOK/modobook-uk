-- lovable-cron-fallback-reviewed: 288 runs/day; paced release of held bulk marketing emails must resume within minutes so booking emails keep priority; queue depth is checked cheaply and nothing is sent when the hold list is empty.
create table if not exists public.email_hold (
  id bigserial primary key,
  label text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

grant all on public.email_hold to service_role;
alter table public.email_hold enable row level security;

create or replace function public.hold_bulk_marketing_emails()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pgmq'
as $$
declare
  msg record;
  moved integer := 0;
begin
  for msg in select r.msg_id, r.message from pgmq.read('transactional_emails', 60, 500) r loop
    if coalesce(msg.message->>'label','') <> 'marketing-broadcast' then
      continue;
    end if;
    insert into public.email_hold(label, payload) values ('marketing-broadcast', msg.message);
    perform pgmq.delete('transactional_emails', msg.msg_id);
    moved := moved + 1;
  end loop;
  return moved;
end;
$$;

create or replace function public.release_held_emails()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pgmq'
as $$
declare
  h record;
  released integer := 0;
  depth integer;
  paused timestamptz;
begin
  if not exists (select 1 from public.email_hold) then
    return 0;
  end if;
  select count(*) into depth from pgmq.q_transactional_emails;
  select retry_after_until into paused from public.email_send_state where id = 1;
  if depth > 15 or (paused is not null and paused > now()) then
    return 0;
  end if;
  for h in select id, payload from public.email_hold order by id limit 10 loop
    perform pgmq.send('transactional_emails', jsonb_set(h.payload, '{queued_at}', to_jsonb(now())));
    delete from public.email_hold where id = h.id;
    released := released + 1;
  end loop;
  return released;
end;
$$;

revoke all on function public.hold_bulk_marketing_emails() from public, anon, authenticated;
revoke all on function public.release_held_emails() from public, anon, authenticated;

select cron.schedule('release-held-emails', '*/5 * * * *', $$select public.release_held_emails();$$);

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
      EXIT WHEN moved >= 30;
      IF msg.enqueued_at < now() - interval '48 hours' THEN CONTINUE; END IF;
      tmpl := COALESCE(msg.message->>'label', '');
      IF tmpl = 'marketing-broadcast' THEN CONTINUE; END IF;
      attempts := COALESCE((msg.message->>'_resend_count')::integer, 0);
      IF attempts >= 2 THEN CONTINUE; END IF;
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