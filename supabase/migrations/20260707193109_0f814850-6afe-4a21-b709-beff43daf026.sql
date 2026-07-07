
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

grant select, insert, update, delete on public.device_push_tokens to authenticated;
grant all on public.device_push_tokens to service_role;

alter table public.device_push_tokens enable row level security;

drop policy if exists "own tokens read" on public.device_push_tokens;
create policy "own tokens read"
  on public.device_push_tokens for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "own tokens insert" on public.device_push_tokens;
create policy "own tokens insert"
  on public.device_push_tokens for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "own tokens update" on public.device_push_tokens;
create policy "own tokens update"
  on public.device_push_tokens for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own tokens delete" on public.device_push_tokens;
create policy "own tokens delete"
  on public.device_push_tokens for delete
  to authenticated
  using (user_id = auth.uid());

create index if not exists device_push_tokens_user_idx on public.device_push_tokens(user_id);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'deletion_requested_at'
  ) then
    alter table public.profiles add column deletion_requested_at timestamptz;
  end if;
end $$;
