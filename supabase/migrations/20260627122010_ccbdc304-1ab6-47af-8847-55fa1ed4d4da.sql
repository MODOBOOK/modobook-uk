revoke select on public.profiles from anon;

drop policy if exists "Public reads active profiles" on public.profiles;