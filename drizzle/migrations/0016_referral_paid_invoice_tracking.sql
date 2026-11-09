ALTER TABLE public.practitioner_referral_signups
  ADD COLUMN IF NOT EXISTS paid_invoice_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joiner_discount_ended_at timestamptz;