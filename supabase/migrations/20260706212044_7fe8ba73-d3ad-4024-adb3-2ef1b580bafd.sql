
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_fee_bnpl_pass_to_patient boolean NOT NULL DEFAULT false;

UPDATE public.profiles
  SET stripe_fee_bnpl_pass_to_patient = stripe_fee_pass_to_patient
  WHERE stripe_fee_pass_to_patient = true;
