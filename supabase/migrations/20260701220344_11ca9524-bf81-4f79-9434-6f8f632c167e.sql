
ALTER TABLE public.client_prescriptions
  ADD COLUMN IF NOT EXISTS strength text,
  ADD COLUMN IF NOT EXISTS form text,
  ADD COLUMN IF NOT EXISTS quantity text,
  ADD COLUMN IF NOT EXISTS route text,
  ADD COLUMN IF NOT EXISTS prescriber_name text,
  ADD COLUMN IF NOT EXISTS prescriber_reg_number text,
  ADD COLUMN IF NOT EXISTS prescriber_address text,
  ADD COLUMN IF NOT EXISTS patient_address_snapshot text,
  ADD COLUMN IF NOT EXISTS patient_dob date,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;
