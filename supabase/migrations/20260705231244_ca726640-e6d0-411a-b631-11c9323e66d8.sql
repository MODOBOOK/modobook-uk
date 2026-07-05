
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS save_card_on_file boolean NOT NULL DEFAULT false;

ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_exp_month int,
  ADD COLUMN IF NOT EXISTS card_exp_year int,
  ADD COLUMN IF NOT EXISTS card_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_save_consent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clinic_clients_stripe_customer
  ON public.clinic_clients (profile_id, stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
