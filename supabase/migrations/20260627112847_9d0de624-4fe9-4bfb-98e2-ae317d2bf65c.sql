create or replace function public.is_object_owner(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := (split_part(path, '/', 1))::uuid;
  return public.is_profile_owner(pid);
exception when others then
  return false;
end;
$$;

create or replace function public.is_active_profile_path(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := (split_part(path, '/', 1))::uuid;
  return exists (select 1 from public.profiles where id = pid and active = true);
exception when others then
  return false;
end;
$$;

revoke execute on function public.is_object_owner(text) from public, anon, authenticated;
revoke execute on function public.is_active_profile_path(text) from public, anon, authenticated;

-- Clinic assets: owner can manage, public can read

create policy "Clinic assets owner manage"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'clinic-assets' and public.is_object_owner(name))
  with check (bucket_id = 'clinic-assets' and public.is_object_owner(name));

create policy "Clinic assets public read"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'clinic-assets' and public.is_active_profile_path(name));

-- Consent uploads: owner can manage

create policy "Consent uploads owner manage"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'consent-uploads' and public.is_object_owner(name))
  with check (bucket_id = 'consent-uploads' and public.is_object_owner(name));
