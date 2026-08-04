create or replace function public.list_public_clinic_slugs()
returns table (slug text)
language sql
stable
security definer
set search_path = public
as $$
  select p.slug::text
  from public.profiles p
  where p.slug is not null and length(trim(p.slug)) > 0
  order by p.slug
$$;

grant execute on function public.list_public_clinic_slugs() to anon, authenticated, service_role;