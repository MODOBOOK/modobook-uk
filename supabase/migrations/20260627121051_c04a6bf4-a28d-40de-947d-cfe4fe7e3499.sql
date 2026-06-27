create or replace view public.public_profile_view
with (security_invoker = false) as
select
  id,
  slug,
  full_name,
  clinic_name,
  tagline,
  about,
  bio,
  avatar_url,
  hero_url,
  brand_color,
  address,
  social_links,
  specialties,
  qualifications,
  timeline,
  active,
  created_at,
  updated_at
from public.profiles
where active = true;

grant select on public.public_profile_view to anon;
grant select on public.public_profile_view to authenticated;

revoke select on public.profiles from anon;

drop policy if exists "Public read active profiles" on public.profiles;