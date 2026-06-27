drop view if exists public.public_profile_view;

create or replace function public.get_public_profile_by_slug(p_slug text)
returns table(
  id uuid,
  slug text,
  full_name text,
  clinic_name text,
  tagline text,
  about text,
  bio text,
  avatar_url text,
  hero_url text,
  brand_color text,
  address jsonb,
  social_links jsonb,
  specialties text[],
  qualifications jsonb,
  timeline jsonb,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
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
  where slug = p_slug
    and active = true;
$$;

grant execute on function public.get_public_profile_by_slug(text) to anon;
grant execute on function public.get_public_profile_by_slug(text) to authenticated;

create or replace function public.is_slug_available(p_slug text, p_exclude_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where slug = p_slug
      and (p_exclude_id is null or id != p_exclude_id)
  );
$$;

grant execute on function public.is_slug_available(text, uuid) to anon;
grant execute on function public.is_slug_available(text, uuid) to authenticated;
