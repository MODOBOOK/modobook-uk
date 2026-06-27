create type public.app_role as enum ('practitioner', 'admin');
create type public.payment_mode as enum ('full', 'deposit', 'pay_in_clinic');
create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.payment_status as enum ('pending', 'paid', 'refunded', 'failed');

grant usage on type public.app_role to authenticated, anon, service_role;
grant usage on type public.payment_mode to authenticated, anon, service_role;
grant usage on type public.appointment_status to authenticated, anon, service_role;
grant usage on type public.payment_status to authenticated, anon, service_role;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'practitioner',
  clinic_name text,
  slug text unique,
  tagline text,
  about text,
  bio text,
  phone text,
  email text,
  address jsonb,
  social_links jsonb,
  hero_url text,
  brand_color text default '#3B82F6',
  active boolean default true,
  stripe_connect_account_id text,
  stripe_connect_onboarding_status text default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.profiles to anon;

alter table public.profiles enable row level security;

create policy "Practitioners manage own profile"
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public read active profiles"
  on public.profiles
  for select
  to anon
  using (active = true);

-- Ownership helper (created after profiles)

create or replace function public.is_profile_owner(_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _profile_id and user_id = auth.uid()
  );
$$;

-- Clinic gallery

create table public.clinic_gallery (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  display_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.clinic_gallery to authenticated;
grant all on public.clinic_gallery to service_role;
grant select on public.clinic_gallery to anon;

alter table public.clinic_gallery enable row level security;

create policy "Owners manage gallery"
  on public.clinic_gallery
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

create policy "Public read active clinic gallery"
  on public.clinic_gallery
  for select
  to anon
  using (exists (select 1 from public.profiles where id = profile_id and active = true));

-- Clinic testimonials

create table public.clinic_testimonials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  quote text not null,
  rating integer check (rating >= 1 and rating <= 5),
  display_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.clinic_testimonials to authenticated;
grant all on public.clinic_testimonials to service_role;
grant select on public.clinic_testimonials to anon;

alter table public.clinic_testimonials enable row level security;

create policy "Owners manage testimonials"
  on public.clinic_testimonials
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

create policy "Public read active clinic testimonials"
  on public.clinic_testimonials
  for select
  to anon
  using (exists (select 1 from public.profiles where id = profile_id and active = true));

-- Treatments

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  duration integer not null,
  price numeric(10,2) not null,
  picture_url text,
  consent_form_url text,
  timing_notes text,
  payment_mode public.payment_mode not null default 'full',
  deposit_amount numeric(10,2) default 0,
  is_consultation boolean default false,
  deductible_against uuid[] default '{}',
  deductible_window_days integer default 30,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.treatments to authenticated;
grant all on public.treatments to service_role;
grant select on public.treatments to anon;

alter table public.treatments enable row level security;

create policy "Owners manage treatments"
  on public.treatments
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

create policy "Public read active treatments"
  on public.treatments
  for select
  to anon
  using (active = true and exists (select 1 from public.profiles where id = profile_id and active = true));

-- Treatment add-ons

create table public.treatment_addons (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  addon_id uuid not null references public.treatments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (treatment_id, addon_id)
);

grant select, insert, update, delete on public.treatment_addons to authenticated;
grant all on public.treatment_addons to service_role;
grant select on public.treatment_addons to anon;

alter table public.treatment_addons enable row level security;

create policy "Owners manage treatment add-ons"
  on public.treatment_addons
  for all
  to authenticated
  using (public.is_profile_owner((select profile_id from public.treatments where id = treatment_id)))
  with check (public.is_profile_owner((select profile_id from public.treatments where id = treatment_id)));

create policy "Public read active treatment add-ons"
  on public.treatment_addons
  for select
  to anon
  using (
    exists (
      select 1 from public.treatments t
      where t.id = treatment_id and t.active = true
      and exists (select 1 from public.profiles p where p.id = t.profile_id and p.active = true)
    )
  );

-- Packages

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  treatment_id uuid references public.treatments(id) on delete set null,
  session_count integer not null,
  price numeric(10,2) not null,
  expiry_days integer,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.packages to authenticated;
grant all on public.packages to service_role;
grant select on public.packages to anon;

alter table public.packages enable row level security;

create policy "Owners manage packages"
  on public.packages
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

create policy "Public read active packages"
  on public.packages
  for select
  to anon
  using (active = true and exists (select 1 from public.profiles where id = profile_id and active = true));

-- Package purchases

create table public.package_purchases (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  package_id uuid not null references public.packages(id) on delete cascade,
  sessions_remaining integer not null,
  expires_at timestamptz,
  stripe_payment_intent_id text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.package_purchases to authenticated;
grant all on public.package_purchases to service_role;

alter table public.package_purchases enable row level security;

create policy "Owners manage package purchases"
  on public.package_purchases
  for all
  to authenticated
  using (public.is_profile_owner((select profile_id from public.packages where id = package_id)))
  with check (public.is_profile_owner((select profile_id from public.packages where id = package_id)));

-- Availability rules

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_interval integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.availability_rules to authenticated;
grant all on public.availability_rules to service_role;
grant select on public.availability_rules to anon;

alter table public.availability_rules enable row level security;

create policy "Owners manage availability rules"
  on public.availability_rules
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

create policy "Public read active availability rules"
  on public.availability_rules
  for select
  to anon
  using (exists (select 1 from public.profiles where id = profile_id and active = true));

-- Blocked dates

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.blocked_dates to authenticated;
grant all on public.blocked_dates to service_role;
grant select on public.blocked_dates to anon;

alter table public.blocked_dates enable row level security;

create policy "Owners manage blocked dates"
  on public.blocked_dates
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

create policy "Public read blocked dates for active clinics"
  on public.blocked_dates
  for select
  to anon
  using (exists (select 1 from public.profiles where id = profile_id and active = true));

-- Appointments

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  addon_ids uuid[] default '{}',
  patient_name text not null,
  patient_email text not null,
  patient_phone text,
  notes text,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  status public.appointment_status default 'pending',
  consent_signed_url text,
  payment_status public.payment_status default 'pending',
  payment_method text,
  base_amount numeric(10,2),
  surcharge_amount numeric(10,2),
  total_amount numeric(10,2),
  stripe_payment_intent_id text,
  package_purchase_id uuid references public.package_purchases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;

alter table public.appointments enable row level security;

create policy "Owners manage appointments"
  on public.appointments
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

-- Payments

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  package_purchase_id uuid references public.package_purchases(id) on delete set null,
  amount numeric(10,2) not null,
  stripe_payment_intent_id text,
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;

alter table public.payments enable row level security;

create policy "Owners manage payments"
  on public.payments
  for all
  to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

-- updated_at triggers

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();
create trigger update_clinic_gallery_updated_at before update on public.clinic_gallery
  for each row execute function public.update_updated_at_column();
create trigger update_clinic_testimonials_updated_at before update on public.clinic_testimonials
  for each row execute function public.update_updated_at_column();
create trigger update_treatments_updated_at before update on public.treatments
  for each row execute function public.update_updated_at_column();
create trigger update_treatment_addons_updated_at before update on public.treatment_addons
  for each row execute function public.update_updated_at_column();
create trigger update_packages_updated_at before update on public.packages
  for each row execute function public.update_updated_at_column();
create trigger update_package_purchases_updated_at before update on public.package_purchases
  for each row execute function public.update_updated_at_column();
create trigger update_availability_rules_updated_at before update on public.availability_rules
  for each row execute function public.update_updated_at_column();
create trigger update_blocked_dates_updated_at before update on public.blocked_dates
  for each row execute function public.update_updated_at_column();
create trigger update_appointments_updated_at before update on public.appointments
  for each row execute function public.update_updated_at_column();
create trigger update_payments_updated_at before update on public.payments
  for each row execute function public.update_updated_at_column();
