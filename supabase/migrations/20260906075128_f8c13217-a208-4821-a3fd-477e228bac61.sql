alter table public.prescriber_profiles
  add column if not exists signoff_pin_hash text,
  add column if not exists fee_per_prescription_pence integer,
  add column if not exists fee_per_consult_pence integer,
  add column if not exists fee_notes text;

comment on column public.prescriber_profiles.signoff_pin_hash is 'SHA-256 hash of the prescriber quick sign-off PIN, salted with user id. Never store plaintext.';