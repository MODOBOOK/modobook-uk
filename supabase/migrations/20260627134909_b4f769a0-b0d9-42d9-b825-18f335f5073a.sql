
-- 1. Extra patient fields on appointments
alter table public.appointments
  add column if not exists patient_dob date,
  add column if not exists patient_address jsonb;

-- 2. treatment_consents: many-to-many link treatments <> consent templates
create table if not exists public.treatment_consents (
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  consent_template_id uuid not null references public.consent_templates(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (treatment_id, consent_template_id)
);

grant select on public.treatment_consents to anon;
grant select, insert, update, delete on public.treatment_consents to authenticated;
grant all on public.treatment_consents to service_role;

alter table public.treatment_consents enable row level security;

create policy "Public read treatment consents" on public.treatment_consents
  for select to anon, authenticated using (true);
create policy "Owners manage treatment consents" on public.treatment_consents
  for all to authenticated
  using (public.is_profile_owner(profile_id))
  with check (public.is_profile_owner(profile_id));

-- 3. appointment_consents: per-booking consent form instances
create table if not exists public.appointment_consents (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  consent_template_id uuid not null references public.consent_templates(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'pending', -- pending | signed
  signature_name text,
  signature_data text,
  signed_at timestamptz,
  signed_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appt_consents_appt on public.appointment_consents(appointment_id);
create index if not exists idx_appt_consents_profile on public.appointment_consents(profile_id);

grant select, insert, update on public.appointment_consents to authenticated;
grant all on public.appointment_consents to service_role;

alter table public.appointment_consents enable row level security;

create policy "Practitioners read their appointment consents"
  on public.appointment_consents for select to authenticated
  using (public.is_profile_owner(profile_id));
create policy "Public can create appointment consents on insert"
  on public.appointment_consents for insert to anon, authenticated
  with check (public.is_active_profile(profile_id));

create trigger update_appointment_consents_updated_at
  before update on public.appointment_consents
  for each row execute function public.update_updated_at_column();

-- 4. Allow public booking inserts to land as 'confirmed' (auto-confirm)
drop policy if exists "Public can request appointments" on public.appointments;
create policy "Public can request appointments" on public.appointments
  for insert to anon, authenticated
  with check (
    public.is_active_profile(profile_id)
    and status in ('pending'::appointment_status, 'confirmed'::appointment_status)
    and payment_status = 'pending'::payment_status
    and package_purchase_id is null
    and stripe_payment_intent_id is null
  );

-- 5. Public RPC: fetch a consent form by token (for patient signing page)
create or replace function public.get_consent_by_token(p_token text)
returns table (
  consent_id uuid,
  appointment_id uuid,
  status text,
  template_name text,
  template_body text,
  requires_signature boolean,
  patient_name text,
  scheduled_date date,
  start_time time,
  treatment_name text,
  clinic_name text
)
language sql security definer set search_path = public as $$
  select
    ac.id, ac.appointment_id, ac.status,
    ct.name, ct.body_markdown, ct.requires_signature,
    a.patient_name, a.scheduled_date, a.start_time,
    t.name, p.clinic_name
  from public.appointment_consents ac
  join public.consent_templates ct on ct.id = ac.consent_template_id
  join public.appointments a on a.id = ac.appointment_id
  join public.treatments t on t.id = a.treatment_id
  join public.profiles p on p.id = ac.profile_id
  where ac.token = p_token
$$;

grant execute on function public.get_consent_by_token(text) to anon, authenticated;

-- 6. Public RPC: patient submits signed consent
create or replace function public.submit_consent(
  p_token text,
  p_signature_name text,
  p_signature_data text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.appointment_consents
   where token = p_token and status = 'pending';
  if v_id is null then return false; end if;
  update public.appointment_consents
     set status = 'signed',
         signature_name = p_signature_name,
         signature_data = p_signature_data,
         signed_at = now()
   where id = v_id;
  return true;
end;
$$;

grant execute on function public.submit_consent(text, text, text) to anon, authenticated;
